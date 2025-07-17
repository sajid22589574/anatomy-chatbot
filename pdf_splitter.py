import os
from PyPDF2 import PdfReader, PdfWriter

def split_pdf(input_pdf_path, output_folder="output_pdfs", pages_per_split=50):
    """
    Splits a large PDF file into smaller PDF files.

    Args:
        input_pdf_path (str): The path to the input PDF file.
        output_folder (str): The folder where the split PDF files will be saved.
        pages_per_split (int): The maximum number of pages per split PDF file.
    """
    if not os.path.exists(input_pdf_path):
        print(f"Error: Input PDF file not found at '{input_pdf_path}'")
        return

    os.makedirs(output_folder, exist_ok=True)

    try:
        pdf_reader = PdfReader(input_pdf_path)
        total_pages = len(pdf_reader.pages)
        input_filename = os.path.splitext(os.path.basename(input_pdf_path))[0]

        print(f"Splitting '{input_pdf_path}' ({total_pages} pages) into parts...")

        for i in range(0, total_pages, pages_per_split):
            pdf_writer = PdfWriter()
            output_pdf_path = os.path.join(output_folder, f"{input_filename}_part_{i // pages_per_split + 1}.pdf")

            for page_num in range(i, min(i + pages_per_split, total_pages)):
                pdf_writer.add_page(pdf_reader.pages[page_num])

            with open(output_pdf_path, 'wb') as output_file:
                pdf_writer.write(output_file)
            print(f"Created: '{output_pdf_path}' (pages {i+1}-{min(i + pages_per_split, total_pages)})")

        print(f"PDF splitting complete. Split files saved in '{output_folder}'")

    except Exception as e:
        print(f"An error occurred during PDF splitting: {e}")

if __name__ == "__main__":
    # Example usage:
    # Replace 'your_large_document.pdf' with the actual path to your PDF file
    # You can also adjust pages_per_split as needed.
    # For instance, if you want roughly 100,000 tokens per part and each page has ~500 tokens,
    # then pages_per_split could be around 200.
    
    # Example: Split 'docs/1664343909.bd-chaurasias-human-anatomy-volume-1_compressed.pdf'
    # into parts, each with a maximum of 50 pages.
    
    # IMPORTANT: Before running, ensure you have PyPDF2 installed:
    # pip install PyPDF2

    input_file = "docs/BD_Chaurasia’s_Human_Anatomy, Volume 3 - Head-Neck and Brain 6th Edition_unlocked.pdf"
    output_dir = "docs/bd_chaurasia_parts"
    pages_per_part = 50 # Adjust this value based on your needs and token limits

    split_pdf(input_file, output_dir, pages_per_part)
