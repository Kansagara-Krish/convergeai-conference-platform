import os
import sys
from google.oauth2 import service_account
from googleapiclient.discovery import build

# Add backend directory to path
backend_dir = os.path.dirname(os.path.abspath(__file__))

def check_drive_info():
    SERVICE_ACCOUNT_FILE = os.path.join(backend_dir, "credentials.json")
    DRIVE_FOLDER_ID = "1oSCnGOPHszp_fOzJU2yCLcnZ8NdmmSUd"
    
    if not os.path.exists(SERVICE_ACCOUNT_FILE):
        print(f"Credentials file not found at {SERVICE_ACCOUNT_FILE}")
        return

    scopes = ["https://www.googleapis.com/auth/drive"]
    creds = service_account.Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=scopes)
    service = build("drive", "v3", credentials=creds)

    print("--- Service Account Info ---")
    try:
        about = service.about().get(fields="user, storageQuota").execute()
        print(f"User: {about.get('user', {}).get('displayName')} ({about.get('user', {}).get('emailAddress')})")
        quota = about.get('storageQuota', {})
        limit = int(quota.get('limit', 0)) / (1024**3)
        usage = int(quota.get('usage', 0)) / (1024**3)
        print(f"Storage: {usage:.2f}GB / {limit:.2f}GB used")
    except Exception as e:
        print(f"Could not get 'about' info: {e}")

    print("\n--- Target Folder Info ---")
    try:
        folder = service.files().get(fileId=DRIVE_FOLDER_ID, fields="id, name, owners").execute()
        print(f"Folder Name: {folder.get('name')}")
        owners = folder.get('owners', [])
        for owner in owners:
            print(f"Owner: {owner.get('displayName')} ({owner.get('emailAddress')})")
    except Exception as e:
        print(f"Could not access folder {DRIVE_FOLDER_ID}: {e}")

if __name__ == "__main__":
    check_drive_info()
