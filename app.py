from flask import Flask, render_template, request, jsonify
from rag_chatbot_v3 import RAGChatbot
import logging
import os
from werkzeug.utils import secure_filename

app = Flask(__name__, template_folder='templates')

# Configure upload folder
UPLOAD_FOLDER = 'docs/'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# Initialize the chatbot
try:
    # Ensure the chatbot is initialized with the correct path
    chatbot = RAGChatbot(app.config['UPLOAD_FOLDER'])
    print("Chatbot initialized successfully!")
except Exception as e:
    print(f"Error initializing chatbot: {str(e)}")
    chatbot = None

# Global chat history for the session (for simplicity, in a real app this would be per-user)
chat_history = []

@app.route('/')
def home():
    global chat_history
    chat_history = [] # Clear chat history on page load
    return render_template('index.html')

from flask import Response

@app.route('/ask', methods=['POST'])
def ask():
    global chat_history
    if not chatbot:
        return jsonify({'error': 'Chatbot not initialized properly'}), 500
    
    try:
        question = request.json.get('question')
        if not question:
            return jsonify({'error': 'No question provided'}), 400
        
        def generate():
            full_response = ""
            for chunk in chatbot.ask_stream(question, chat_history):
                full_response += chunk
                yield chunk.replace('\n', '<br>')
        
            # Update chat history once after the full response is generated
            chat_history.append({"role": "user", "content": question})
            chat_history.append({"role": "bot", "content": full_response})

        return Response(generate(), mimetype='text/plain')

    except Exception as e:
        logging.error(f"Error processing question: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/upload_pdf', methods=['POST'])
def upload_pdf():
    if not chatbot:
        return jsonify({'error': 'Chatbot not initialized properly'}), 500

    if 'file' not in request.files:
        return jsonify({'error': 'No file part in the request'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and file.filename.endswith('.pdf'):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        try:
            # Add the newly uploaded document to the chatbot's knowledge base
            # This assumes RAGChatbot has a method to add documents
            chatbot.add_document(filepath)
            return jsonify({'message': f'File {filename} uploaded and processed successfully!'}), 200
        except Exception as e:
            logging.error(f"Error processing uploaded file: {str(e)}")
            return jsonify({'error': f'Failed to process file: {str(e)}'}), 500
    else:
        return jsonify({'error': 'Invalid file type. Please upload a PDF file.'}), 400

if __name__ == '__main__':
    # Running in production mode, disable debug and reloader for stability
    app.run(debug=False, use_reloader=False, port=5000)
