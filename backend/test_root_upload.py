import os
import sys
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

backend_dir = os.path.dirname(os.path.abspath(__file__))

def test_root_upload():
    SERVICE_ACCOUNT_FILE = os.path.join(backend_dir, "credentials.json")
    scopes = ["https://www.googleapis.com/auth/drive"]
    creds = service_account.Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=scopes)
    service = build("drive", "v3", credentials=creds)

    # Find ANY png
    sample_image = None
    for root, dirs, files in os.walk(backend_dir):
        for f in files:
            if f.endswith(".png"):
                sample_image = os.path.join(root, f)
                break
        if sample_image: break
    
    if not sample_image:
        print("No PNG found.")
        return

    print(f"Testing root upload of {sample_image}...")
    file_metadata = {"name": "test_root.png"}
    media = MediaFileUpload(sample_image, mimetype="image/png")
    
    try:
        f = service.files().create(body=file_metadata, media_body=media, fields="id").execute()
        print(f"Success! Root file id: {f.get('id')}")
    except Exception as e:
        print(f"Root upload failed: {e}")

if __name__ == "__main__":
    test_root_upload()
