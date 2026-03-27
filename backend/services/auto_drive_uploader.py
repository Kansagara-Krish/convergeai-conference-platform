import os
from datetime import datetime
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

SERVICE_ACCOUNT_FILE = "credentials.json"
DRIVE_FOLDER_ID = "1oSCnGOPHszp_fOzJU2yCLcnZ8NdmmSUd"

def upload_to_drive(file_path, username):
    """
    Authenticates and uploads a generated image file to Google Drive.
    """
    try:
        # Resolve the path to credentials.json in the backend directory
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        cred_path = os.path.join(base_dir, SERVICE_ACCOUNT_FILE)
        
        if not os.path.exists(cred_path):
            error_msg = f"Credentials file not found at {cred_path}"
            print(error_msg)
            return None, error_msg
            
        scopes = ["https://www.googleapis.com/auth/drive"]
        creds = service_account.Credentials.from_service_account_file(cred_path, scopes=scopes)
        service = build("drive", "v3", credentials=creds, cache_discovery=False)

        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        safe_username = str(username).replace(" ", "_")
        filename = f"{safe_username}_{timestamp}.png"

        file_metadata = {
            "name": filename
        }
        if DRIVE_FOLDER_ID:
            file_metadata["parents"] = [DRIVE_FOLDER_ID]

        media = MediaFileUpload(file_path, mimetype="image/png", resumable=True)
        
        # Upload file
        uploaded_file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields="id"
        ).execute()
        
        file_id = uploaded_file.get("id")
        
        if not file_id:
            return None, "Google Drive API returned no file ID"

        # Set permission: anyone with link -> reader
        service.permissions().create(
            fileId=file_id,
            body={"role": "reader", "type": "anyone"}
        ).execute()

        # Generate shareable link
        link = f"https://drive.google.com/file/d/{file_id}/view"
        return link, None

    except Exception as e:
        error_msg = str(e)
        if "storageQuotaExceeded" in error_msg:
            error_msg = (
                "Google Drive Storage Quota Exceeded for this Service Account (Limit: 0GB). "
                "ACTION REQUIRED: Please enable Billing on your Google Cloud Project or "
                "ensure the Service Account has a storage limit allocated in the Cloud Console."
            )
        print(f"Failed to upload {file_path} to Google Drive: {error_msg}")
        return None, error_msg

def log_metadata(username, link):
    """
    Logs the metadata of the uploaded image.
    """
    if not link:
        return None
        
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    metadata = {
        "username": username,
        "timestamp": timestamp,
        "link": link
    }
    
    # Store metadata in a simple print statement (as requested: no DB required yet)
    print("\n--- NEW GENERATED IMAGE UPLOADED ---")
    print(f"Username : {metadata['username']}")
    print(f"Timestamp: {metadata['timestamp']}")
    print(f"Drive Link: {metadata['link']}")
    print("------------------------------------\n")
    
    return metadata
