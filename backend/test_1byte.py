import os
import sys
import io
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

backend_dir = r"c:\Users\kansa\OneDrive\Desktop\convergeai_conference_chatbot_system\backend"

def test_1byte():
    SERVICE_ACCOUNT_FILE = os.path.join(backend_dir, "credentials.json")
    DRIVE_FOLDER_ID = "1oSCnGOPHszp_fOzJU2yCLcnZ8NdmmSUd"
    scopes = ["https://www.googleapis.com/auth/drive"]
    creds = service_account.Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=scopes)
    service = build("drive", "v3", credentials=creds)

    print(f"Testing 1-byte upload to {DRIVE_FOLDER_ID}...")
    file_metadata = {
        "name": "one_byte_test.txt",
        "parents": [DRIVE_FOLDER_ID]
    }
    media = MediaIoBaseUpload(io.BytesIO(b"a"), mimetype="text/plain")
    
    try:
        f = service.files().create(body=file_metadata, media_body=media, fields="id").execute()
        print(f"Success! 1-byte id: {f.get('id')}")
    except Exception as e:
        print(f"1-byte upload failed: {e}")

if __name__ == "__main__":
    test_1byte()
