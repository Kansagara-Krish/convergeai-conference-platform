import sys
import os

# add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from app import create_app
from models import db, Chatbot
from services.google_drive_service import upload_to_drive

app = create_app()

with app.app_context():
    image_path = r"C:\Users\kansa\OneDrive\Desktop\convergeai_conference_chatbot_system\burj.jpg"
    
    if not os.path.exists(image_path):
        print(f"ERROR: Could not find image at {image_path}")
        sys.exit(1)
        
    with open(image_path, "rb") as f:
        test_image_bytes = f.read()
    
    chatbot = Chatbot.query.first()
    if not chatbot:
        print("ERROR: No chatbot found in database!")
        sys.exit(1)
        
    print(f"Starting upload test for Chatbot ID={chatbot.id} using file '{os.path.basename(image_path)}'...")
    try:
        result = upload_to_drive(test_image_bytes, chatbot.id, "TEST_ADMIN_UPLOAD")
        print("\n================== UPLOAD RESULT ==================")
        print(result)
        print("===================================================\n")
        
        if not result or 'error' in result:
            print("FAILURE: upload_to_drive returned an error. Inspect app.log or standard out.")
        else:
            print(f"SUCCESS! View your image here: {result.get('link')}")
            
    except Exception as e:
        import traceback
        traceback.print_exc()
