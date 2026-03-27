import os
import sys
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

backend_dir = os.path.dirname(os.path.abspath(__file__))

def test_supports_all_drives():
    SERVICE_ACCOUNT_FILE = os.path.join(backend_dir, "credentials.json")
    DRIVE_FOLDER_ID = "1oSCnGOPHszp_fOzJU2yCLcnZ8NdmmSUd"
    scopes = ["https://www.googleapis.com/auth/drive"]
    creds = service_account.Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=scopes)
    service = build("drive", "v3", credentials=creds)

    sample_image = None
    for root, dirs, files in os.walk(backend_dir):
        for f in files:
            if f.endswith(".png"):
                sample_image = os.path.join(root, f)
                break
        if sample_image: break
    
    if not sample_image: return

    print(f"Testing upload with supportsAllDrives=True of {sample_image}...")
    file_metadata = {
        "name": "test_supports.png",
        "parents": [DRIVE_FOLDER_ID]
    }
    media = MediaFileUpload(sample_image, mimetype="image/png")
    
    try:
        # supportsAllDrives=True allows uploading to Shared Drives (Team Drives) 
        # and using their quota if available.
        f = service.files().create(
            body=file_metadata, 
            media_body=media, 
            fields="id",
            supportsAllDrives=True
        ).execute()
        print(f"Success! file id: {f.get('id')}")
    except Exception as e:
        print(f"Upload failed: {e}")

if __name__ == "__main__":
    test_supports_all_drives()
