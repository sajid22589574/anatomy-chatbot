from langchain_community.document_loaders import UnstructuredWordDocumentLoader, DirectoryLoader, PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
# Import Gemini specific classes
from langchain_cohere import CohereEmbeddings, ChatCohere
from langchain_pinecone import Pinecone as LangchainPinecone
from langchain.chains import RetrievalQA, create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate, PromptTemplate
from pinecone import Pinecone
import os
import logging
import time
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
import nltk
from nltk.corpus import wordnet, stopwords
from nltk.tokenize import word_tokenize
import string
import json

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Download NLTK data
try:
    nltk.data.find('corpora/wordnet')
except LookupError:
    nltk.download('wordnet')
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')
try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords')

class RAGChatbot:
    """
    A Retrieval-Augmented Generation (RAG) chatbot that uses Gemini models to answer questions
    based on provided documents.

    The chatbot uses:
    - Gemini Pro for question answering
    - Gemini embedding model for document embeddings
    - Pinecone vector database for similarity search

    Args:
        docs_path (str): Path to the directory containing the documents (.docx files)
    
    Environment Variables Required:
        - GEMINI_API_KEY: Google Gemini API key
        - PINECONE_API_KEY: Pinecone API key
        - PINECONE_ENV: Pinecone environment (e.g., "us-east-1")
        - PINECONE_INDEX_NAME: Name of the Pinecone index
        - PINECONE_HOST: Host URL for the Pinecone index
    """

    def __init__(self, docs_path: str):
        # Load and validate environment variables
        self.cohere_api_key = os.getenv("COHERE_API_KEY") # Load Cohere API key
        # Removed gemini_api_key loading
        self.pinecone_key = os.getenv("PINECONE_API_KEY")
        self.pinecone_env = os.getenv("PINECONE_ENV")
        self.pinecone_index = os.getenv("PINECONE_INDEX_NAME")
        self.pinecone_host = os.getenv("PINECONE_HOST")
        
        # Validate required environment variables
        required_vars = {
            "COHERE_API_KEY": self.cohere_api_key, # Check for Cohere API key
            "PINECONE_API_KEY": self.pinecone_key,
            "PINECONE_ENV": self.pinecone_env,
            "PINECONE_INDEX_NAME": self.pinecone_index,
            "PINECONE_HOST": self.pinecone_host
        }
        
        missing_vars = [k for k, v in required_vars.items() if not v]
        if missing_vars:
            raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")
        
        self.docs_path = Path(docs_path)
        # Initialize Pinecone client
        logger.info("Initializing Pinecone connection...")
        self.pc = Pinecone(
            api_key=self.pinecone_key,
            environment=self.pinecone_env
        )
        
        # Initialize embeddings
        self._setup_embeddings()
        
        # Initialize document processing components
        self._setup_document_processing_components()
        
        # Initialize vector store
        self._setup_vector_store()
        
        # Initialize QA chain
        self._setup_qa_chains()

        self.texts = [] # To store processed texts (still needed for add_document logic)

    def _setup_embeddings(self):
        """Initialize embedding model."""
        start_time = time.time()
        try:
            self.embeddings = CohereEmbeddings(
                model="embed-multilingual-v3.0", # User specified embedding model
                cohere_api_key=self.cohere_api_key
            )
            logger.info("Initialized Cohere embeddings")
        except Exception as e:
            logger.error(f"Error setting up embeddings: {str(e)}")
            raise

    def _setup_document_processing_components(self):
        """Initialize document processing components."""
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=500, # Reduced chunk size
            chunk_overlap=100, # Reduced chunk overlap
            separators=["\n\n", "\n", ". ", " ", ""]
        )
        logger.info("Initialized text splitter.")

    def _setup_vector_store(self):
        """Initialize Pinecone vector store."""
        start_time = time.time()
        try:
            # Check if any indexes exist
            indexes = self.pc.list_indexes()
            if not indexes.names():
                logger.error("No Pinecone indexes found. Please create one in the Pinecone Console.")
                raise ValueError("No Pinecone indexes available")

            # Check if our index exists
            if self.pinecone_index not in indexes.names():
                logger.info(f"Index '{self.pinecone_index}' does not exist. Creating it...")
                # Dimension should match the embedding model's output dimension.
                # Cohere's embed-multilingual-v3.0 has a dimension of 1024.
                self.pc.create_index(
                    name=self.pinecone_index,
                    dimension=1024,  # Update dimension for Cohere embeddings
                    metric="cosine",
                )
                logger.info(f"Index '{self.pinecone_index}' created successfully.")

            # Get the Pinecone index
            index = self.pc.Index(self.pinecone_index)
            logger.info(f"Using existing Pinecone index: {self.pinecone_index}")
            
            # Initialize vector store
            self.vectorstore = LangchainPinecone.from_existing_index(
                index_name=self.pinecone_index,
                embedding=self.embeddings,
                text_key="text"            )
            logger.info("Vector store initialized")
        except Exception as e:
            logger.error(f"Error setting up vector store: {str(e)}")
            raise

    def _setup_qa_chains(self):
        """Initialize QA chain with Cohere LLM."""
        start_time = time.time()
        try:
            # Define the system prompt with very explicit formatting instructions
            SYSTEM_PROMPT = """
You are a specialized RAG assistant for BD Chaurasia's Human Anatomy. Your task is to answer questions based *only* on the provided context.
Provide a detailed and comprehensive answer based on the following context:
{context}
"""
            # Create a custom prompt template for the chat model
            prompt = ChatPromptTemplate.from_messages([
                ("system", SYSTEM_PROMPT),
                ("human", "{input}")
            ])

            # Create a prompt for formatting each retrieved document to include metadata
            document_prompt = PromptTemplate.from_template(
                "Source: {source}, Page: {page}\\n\\n{page_content}"
            )

            # Initialize Cohere LLM
            self.cohere_llm = ChatCohere(
                model="command-r-plus",
                cohere_api_key=self.cohere_api_key
            )
            
            # Configure retriever with search parameters
            self.retriever = self.vectorstore.as_retriever(
                search_type="similarity",
                search_kwargs={"k": 10}
            )
            
            # Build the document chain with the document_prompt
            doc_chain = create_stuff_documents_chain(
                llm=self.cohere_llm, 
                prompt=prompt,
                document_prompt=document_prompt
            )
            
            from langchain_core.runnables import RunnablePassthrough

            self.qa_chain = create_retrieval_chain(self.retriever, doc_chain)
            logger.info("QA chain initialized with revised detailed formatting.")
            
        except Exception as e:
            logger.error(f"Error setting up QA chain: {str(e)}")
            raise

    def ask(self, question: str) -> str:
        """
        Ask a question, get a JSON response from the model, and format it.
        """
        start_time = time.time()
        try:
            logger.info(f"Asking question: {question}")

            # Get the raw JSON response from the model
            response = self.qa_chain.invoke({"input": question})
            raw_answer = response['answer']
            logger.info(f"Raw model response: {raw_answer}")

            # Remove asterisks from the response
            cleaned_answer = raw_answer.replace('*', '')
            
            return cleaned_answer.replace('\n', '<br>')

        except Exception as e:
            logger.error(f"Error generating response: {str(e)}")
            raise

    def get_synonyms(self, word):
        """
        Get synonyms for a word using WordNet.
        """
        synonyms = set()
        for syn in wordnet.synsets(word):
            for lemma in syn.lemmas():
                synonyms.add(lemma.name())
        return synonyms

    def add_document(self, filepath: str):
        """
        Loads a document from the given filepath, splits it into chunks,
        generates embeddings, and adds it to the Pinecone vector store.
        Initializes components if they haven't been already.
        """
        logger.info(f"Adding document: {filepath}")
        try:
            # Components are now initialized in __init__

            # Load the document
            loader = PyPDFLoader(filepath)
            documents = loader.load()
            logger.info(f"Loaded document: {len(documents)} pages/chunks from {filepath}")

            # Split the document into chunks
            texts = self.splitter.split_documents(documents)
            logger.info(f"Split document into {len(texts)} text chunks.")
            
            # Add texts to the vector store
            # The add_texts method expects a list of texts and optionally metadata.
            # We are passing the Document objects directly, which Langchain handles.
            self.vectorstore.add_texts([doc.page_content for doc in texts], metadatas=[doc.metadata for doc in texts])
            logger.info(f"Successfully added {len(texts)} chunks to Pinecone.")
            
            # Update the internal list of texts
            self.texts.extend(texts)
            
        except Exception as e:
            logger.error(f"Error adding document {filepath}: {str(e)}")
            raise

if __name__ == "__main__":
    try:
        # Initialize the chatbot with the docs path
        print("Initializing chatbot... This may take a moment.")
        chatbot = RAGChatbot("docs/")
        print("\nChatbot ready! You can now upload PDFs and ask questions.")
        print("Type 'quit' or 'exit' to end the conversation.\n")
        
        while True:
            # Get user input
            question = input("\nYour question: ").strip()
            
            # Check if user wants to quit
            if question.lower() in ['quit', 'exit']:
                print("\nThank you for using the chatbot. Goodbye!")
                break
            
            # Skip empty questions
            if not question:
                print("Please ask a question.")
                continue
            
            try:
                # Get and print the response
                response = chatbot.ask(question)
                print(f"\nAnswer: {response}")
            except Exception as e:
                print(f"\nError: Unable to get response - {str(e)}")
                
    except Exception as e:
        logger.error(f"Error in main execution: {str(e)}")
        raise
