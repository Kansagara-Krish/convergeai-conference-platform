import json
import mimetypes
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import requests
from flask import current_app

try:
    from models import UserGoogleToken, db
except ImportError:
    from backend.models import UserGoogleToken, db


class GoogleDriveServiceError(Exception):
    def __init__(self, message: str, status_code: int = 500, payload: Any = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.payload = payload


GOOGLE_DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file"
_GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
_GOOGLE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files"


def _get_config_value(name: str, default: str = "") -> str:
    value = current_app.config.get(name, default)
    return str(value or default).strip()


def _parse_predefined_folders() -> List[Dict[str, str]]:
    raw = _get_config_value("GOOGLE_DRIVE_PREDEFINED_FOLDERS", "[]")
    if not raw:
        return []

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []

    if not isinstance(data, list):
        return []

    folders: List[Dict[str, str]] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        folder_id = str(item.get("id") or "").strip()
        name = str(item.get("name") or "").strip()
        if not folder_id or not name:
            continue
        folders.append({"id": folder_id, "name": name})
    return folders


def _build_drive_client():
    try:
        from google.oauth2 import service_account
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build
    except Exception as exc:
        raise GoogleDriveServiceError(
            "Google Drive dependencies are missing. Install google-api-python-client and google-auth packages.",
            status_code=500,
        ) from exc

    scopes = ["https://www.googleapis.com/auth/drive"]

    service_account_json = _get_config_value("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON")
    service_account_file = _get_config_value("GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE")
    oauth_access_token = _get_config_value("GOOGLE_DRIVE_OAUTH_ACCESS_TOKEN")

    credentials = None

    if service_account_json:
        try:
            info = json.loads(service_account_json)
            credentials = service_account.Credentials.from_service_account_info(
                info,
                scopes=scopes,
            )
        except Exception as exc:
            raise GoogleDriveServiceError(
                "Invalid GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON value.",
                status_code=500,
            ) from exc
    elif service_account_file:
        absolute_path = service_account_file
        if not os.path.isabs(absolute_path):
            absolute_path = os.path.abspath(
                os.path.join(current_app.root_path, "..", service_account_file),
            )

        if not os.path.exists(absolute_path):
            raise GoogleDriveServiceError(
                f"Google Drive credentials file not found: {absolute_path}",
                status_code=500,
            )

        try:
            credentials = service_account.Credentials.from_service_account_file(
                absolute_path,
                scopes=scopes,
            )
        except Exception as exc:
            raise GoogleDriveServiceError(
                "Failed to load Google Drive service account credentials file.",
                status_code=500,
            ) from exc
    elif oauth_access_token:
        # Minimal OAuth fallback if access token is managed externally.
        credentials = Credentials(token=oauth_access_token, scopes=scopes)
    else:
        raise GoogleDriveServiceError(
            "Google Drive is not configured. Set GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON, GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE, or GOOGLE_DRIVE_OAUTH_ACCESS_TOKEN.",
            status_code=500,
        )

    try:
        return build("drive", "v3", credentials=credentials, cache_discovery=False)
    except Exception as exc:
        raise GoogleDriveServiceError(
            "Failed to initialize Google Drive API client.",
            status_code=500,
        ) from exc


def list_folders(parent_id: Optional[str] = None, page_size: int = 100) -> List[Dict[str, str]]:
    service = _build_drive_client()

    query_parts = [
        "mimeType='application/vnd.google-apps.folder'",
        "trashed=false",
    ]

    if parent_id:
        query_parts.append(f"'{parent_id}' in parents")

    query = " and ".join(query_parts)

    try:
        response = (
            service.files()
            .list(
                q=query,
                pageSize=max(1, min(int(page_size or 100), 1000)),
                fields="files(id,name,webViewLink)",
                orderBy="name",
            )
            .execute()
        )
    except Exception as exc:
        raise GoogleDriveServiceError(
            "Failed to fetch Google Drive folders.",
            status_code=502,
        ) from exc

    folders: List[Dict[str, str]] = []
    for item in response.get("files", []) if isinstance(response, dict) else []:
        folder_id = str(item.get("id") or "").strip()
        folder_name = str(item.get("name") or "").strip()
        if not folder_id or not folder_name:
            continue
        folders.append(
            {
                "id": folder_id,
                "name": folder_name,
                "link": str(item.get("webViewLink") or "").strip(),
            }
        )

    return folders


def get_folder_options(chatbot_name: Optional[str] = None) -> List[Dict[str, str]]:
    predefined = _parse_predefined_folders()
    folders = list(predefined)

    root_folder_id = _get_config_value("GOOGLE_DRIVE_ROOT_FOLDER_ID")
    if root_folder_id:
        folders.insert(0, {"id": root_folder_id, "name": "Root Backup Folder"})

    if chatbot_name:
        folders.append({"id": "__chatbot_auto__", "name": f"Create/use chatbot folder ({chatbot_name})"})

    seen = set()
    unique: List[Dict[str, str]] = []
    for item in folders:
        key = f"{item.get('id')}::{item.get('name')}"
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)

    return unique


def create_folder(folder_name: str, parent_id: Optional[str] = None) -> Dict[str, str]:
    service = _build_drive_client()

    body: Dict[str, Any] = {
        "name": str(folder_name or "").strip(),
        "mimeType": "application/vnd.google-apps.folder",
    }
    if parent_id:
        body["parents"] = [parent_id]

    try:
        result = (
            service.files()
            .create(body=body, fields="id,name,webViewLink")
            .execute()
        )
    except Exception as exc:
        raise GoogleDriveServiceError(
            "Failed to create Google Drive folder.",
            status_code=502,
        ) from exc

    return {
        "id": str(result.get("id") or "").strip(),
        "name": str(result.get("name") or "").strip(),
        "link": str(result.get("webViewLink") or "").strip(),
    }


def ensure_chatbot_folder(chatbot_name: str) -> Dict[str, str]:
    safe_name = str(chatbot_name or "").strip() or "chatbot-backups"
    folder_name = f"Chatbot Backup - {safe_name}"

    root_folder_id = _get_config_value("GOOGLE_DRIVE_ROOT_FOLDER_ID")
    existing = list_folders(parent_id=root_folder_id)
    for folder in existing:
        if str(folder.get("name") or "").strip().lower() == folder_name.lower():
            return folder

    return create_folder(folder_name, parent_id=root_folder_id or None)


def get_or_create_chatbot_folder(chatbot_name: str) -> Dict[str, str]:
    """Return chatbot folder metadata; create folder named exactly as chatbot name when missing."""
    folder_name = str(chatbot_name or "").strip() or "chatbot"
    root_folder_id = _get_config_value("GOOGLE_DRIVE_ROOT_FOLDER_ID")

    existing = list_folders(parent_id=root_folder_id or None)
    for folder in existing:
        if str(folder.get("name") or "").strip().lower() == folder_name.lower():
            return folder

    return create_folder(folder_name, parent_id=root_folder_id or None)


def upload_image_to_folder(file_path: str, folder_id: str, filename: str) -> Dict[str, str]:
    """Upload an image file into a specific Drive folder using admin credentials."""
    uploaded = upload_file(
        local_file_path=file_path,
        drive_folder_id=folder_id,
        desired_filename=filename,
    )
    return {
        "file_id": str(uploaded.get("file_id") or "").strip(),
        "link": str(uploaded.get("link") or "").strip(),
        "name": str(uploaded.get("name") or filename).strip(),
        "folder_id": str(folder_id or "").strip(),
    }


def upload_file(local_file_path: str, drive_folder_id: str, desired_filename: Optional[str] = None) -> Dict[str, str]:
    if not local_file_path or not os.path.isfile(local_file_path):
        raise GoogleDriveServiceError("Image file not found for Drive upload.", status_code=400)

    folder_id = str(drive_folder_id or "").strip()
    if not folder_id:
        raise GoogleDriveServiceError("Drive folder id is required.", status_code=400)

    try:
        from googleapiclient.http import MediaFileUpload
    except Exception as exc:
        raise GoogleDriveServiceError(
            "Google Drive upload dependency is missing.",
            status_code=500,
        ) from exc

    service = _build_drive_client()

    filename = str(desired_filename or "").strip() or os.path.basename(local_file_path)
    mime_type = mimetypes.guess_type(local_file_path)[0] or "application/octet-stream"

    metadata: Dict[str, Any] = {
        "name": filename,
        "parents": [folder_id],
    }

    media = MediaFileUpload(local_file_path, mimetype=mime_type, resumable=False)

    try:
        result = (
            service.files()
            .create(body=metadata, media_body=media, fields="id,name,webViewLink,webContentLink")
            .execute()
        )
    except Exception as exc:
        raise GoogleDriveServiceError(
            "Failed to upload file to Google Drive.",
            status_code=502,
        ) from exc

    file_id = str(result.get("id") or "").strip()
    if not file_id:
        raise GoogleDriveServiceError("Google Drive upload returned no file id.", status_code=502)

    if current_app.config.get("GOOGLE_DRIVE_SHARE_PUBLIC", False):
        try:
            service.permissions().create(
                fileId=file_id,
                body={"role": "reader", "type": "anyone"},
            ).execute()
            result = (
                service.files()
                .get(fileId=file_id, fields="id,name,webViewLink,webContentLink")
                .execute()
            )
        except Exception:
            # Sharing is optional; keep uploaded file metadata even if permission update fails.
            pass

    link = str(result.get("webViewLink") or result.get("webContentLink") or "").strip()
    if not link:
        link = f"https://drive.google.com/file/d/{file_id}/view"

    return {
        "file_id": file_id,
        "name": str(result.get("name") or filename).strip(),
        "link": link,
    }


def _get_oauth_client_config() -> Dict[str, str]:
    client_id = _get_config_value("GOOGLE_OAUTH_CLIENT_ID")
    client_secret = _get_config_value("GOOGLE_OAUTH_CLIENT_SECRET")

    if not client_id or not client_secret:
        raise GoogleDriveServiceError(
            "Google OAuth client is not configured.",
            status_code=500,
        )

    return {
        "client_id": client_id,
        "client_secret": client_secret,
    }


def _get_user_token_row(user) -> Optional[UserGoogleToken]:
    user_id = getattr(user, "id", None)
    if user_id is None:
        return None
    return UserGoogleToken.query.filter_by(user_id=user_id).first()


def _refresh_user_access_token(token_row: UserGoogleToken) -> UserGoogleToken:
    refresh_token = str(token_row.refresh_token or "").strip()
    if not refresh_token:
        raise GoogleDriveServiceError(
            "Google Drive refresh token is missing. Please connect Google Drive again.",
            status_code=401,
        )

    oauth_cfg = _get_oauth_client_config()

    try:
        response = requests.post(
            _GOOGLE_TOKEN_URL,
            data={
                "client_id": oauth_cfg["client_id"],
                "client_secret": oauth_cfg["client_secret"],
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
            timeout=20,
        )
    except requests.RequestException as exc:
        raise GoogleDriveServiceError(
            "Failed to refresh Google Drive access token.",
            status_code=502,
        ) from exc

    payload = response.json() if response.content else {}
    if response.status_code >= 400:
        message = payload.get("error_description") or payload.get("error") or "Google token refresh failed"
        raise GoogleDriveServiceError(str(message), status_code=401, payload=payload)

    new_access_token = str(payload.get("access_token") or "").strip()
    expires_in = int(payload.get("expires_in") or 3600)
    scope = str(payload.get("scope") or token_row.scope or GOOGLE_DRIVE_FILE_SCOPE).strip()

    if not new_access_token:
        raise GoogleDriveServiceError(
            "Google token refresh returned no access token.",
            status_code=502,
            payload=payload,
        )

    token_row.access_token = new_access_token
    token_row.token_expiry = datetime.utcnow() + timedelta(seconds=max(expires_in - 60, 60))
    token_row.scope = scope
    db.session.commit()

    return token_row


def _get_valid_user_access_token(user) -> str:
    token_row = _get_user_token_row(user)
    if not token_row:
        raise GoogleDriveServiceError("Connect Google Drive first.", status_code=400)

    if token_row.is_access_token_valid(buffer_seconds=60):
        return str(token_row.access_token or "").strip()

    refreshed = _refresh_user_access_token(token_row)
    return str(refreshed.access_token or "").strip()


def upload_user_file_to_drive(user, file_path: str, filename: str, folder_id: Optional[str] = None) -> Dict[str, str]:
    local_file_path = os.path.abspath(str(file_path or "").strip())
    if not os.path.isfile(local_file_path):
        raise GoogleDriveServiceError("Image file not found for upload.", status_code=400)

    resolved_filename = str(filename or "").strip() or os.path.basename(local_file_path)
    resolved_folder_id = str(folder_id or "").strip()
    mime_type = mimetypes.guess_type(local_file_path)[0] or "application/octet-stream"

    metadata: Dict[str, Any] = {
        "name": resolved_filename,
    }
    if resolved_folder_id:
        metadata["parents"] = [resolved_folder_id]

    def _send_upload(access_token: str):
        with open(local_file_path, "rb") as file_handle:
            files = [
                (
                    "metadata",
                    (
                        "metadata",
                        json.dumps(metadata),
                        "application/json; charset=UTF-8",
                    ),
                ),
                ("file", (resolved_filename, file_handle, mime_type)),
            ]

            return requests.post(
                f"{_GOOGLE_UPLOAD_URL}?uploadType=multipart&fields=id,webViewLink",
                headers={
                    "Authorization": f"Bearer {access_token}",
                },
                files=files,
                timeout=60,
            )

    access_token = _get_valid_user_access_token(user)

    try:
        response = _send_upload(access_token)
    except requests.RequestException as exc:
        raise GoogleDriveServiceError("Failed to upload image to Google Drive.", status_code=502) from exc

    if response.status_code == 401:
        # Retry once after refresh.
        token_row = _get_user_token_row(user)
        if not token_row:
            raise GoogleDriveServiceError("Connect Google Drive first.", status_code=400)
        refreshed = _refresh_user_access_token(token_row)
        try:
            response = _send_upload(str(refreshed.access_token or ""))
        except requests.RequestException as exc:
            raise GoogleDriveServiceError("Failed to upload image to Google Drive.", status_code=502) from exc

    payload = response.json() if response.content else {}
    if response.status_code >= 400:
        message = "Google Drive upload failed."
        if isinstance(payload, dict):
            error_obj = payload.get("error") if isinstance(payload.get("error"), dict) else {}
            message = str(error_obj.get("message") or message)
        raise GoogleDriveServiceError(message, status_code=502, payload=payload)

    file_id = str(payload.get("id") or "").strip()
    if not file_id:
        raise GoogleDriveServiceError("Google Drive upload returned no file id.", status_code=502, payload=payload)

    link = str(payload.get("webViewLink") or "").strip() or f"https://drive.google.com/file/d/{file_id}/view"

    return {
        "drive_file_id": file_id,
        "drive_link": link,
        "folder_id": resolved_folder_id or "root",
    }


def _get_or_create_convergeai_backup_folder() -> str:
    env_root_id = _get_config_value("GOOGLE_DRIVE_ROOT_FOLDER_ID")
    if env_root_id:
        import re
        # If user pasted a whole URL, pull out the ID
        match = re.search(r'folders/([a-zA-Z0-9_-]+)', env_root_id)
        if match:
            env_root_id = match.group(1)
        # remove spaces or quotes
        env_root_id = str(env_root_id).strip(" '\"=")
        return env_root_id

    service = _build_drive_client()
    query = "name='ConvergeAI_Backup' and mimeType='application/vnd.google-apps.folder' and trashed=false and 'root' in parents"
    result = service.files().list(q=query, fields="files(id, name)").execute()
    files = result.get('files', [])
    if files:
        return files[0]['id']
    
    body = {"name": "ConvergeAI_Backup", "mimeType": "application/vnd.google-apps.folder"}
    res = service.files().create(body=body, fields="id").execute()
    return res.get('id')


def _get_or_create_chatbot_auto_folder(chatbot, root_id: str) -> str:
    chatbot_folder_name = f"chatbot_{chatbot.id}"
    query = f"name='{chatbot_folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false and '{root_id}' in parents"
    service = _build_drive_client()
    result = service.files().list(q=query, fields="files(id, name)").execute()
    files = result.get('files', [])
    if files:
        folder_id = files[0]['id']
    else:
        body = {"name": chatbot_folder_name, "mimeType": "application/vnd.google-apps.folder", "parents": [root_id]}
        res = service.files().create(body=body, fields="id", supportsAllDrives=True).execute()
        folder_id = res.get('id')
    
    try:
        chatbot.drive_folder_id = folder_id
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        current_app.logger.warning(f"Failed to save drive folder id to db: {e}")
        
    return folder_id


def upload_to_drive(image_bytes: bytes, chatbot_id: int, username: str) -> Dict[str, str]:
    """
    Auto-upload generated AI image to Google Drive with structured folder organization.
    Uses admin user OAuth natively to bypass restrictive Service Account storage quotas.
    """
    try:
        from models import Chatbot
        import io
        from googleapiclient.http import MediaIoBaseUpload
        from datetime import datetime

        chatbot = Chatbot.query.get(chatbot_id)
        if not chatbot:
            raise ValueError(f"Chatbot not found: {chatbot_id}")
            
        folder_id = str(chatbot.drive_folder_id or "").strip()
        if not folder_id:
            root_id = _get_or_create_convergeai_backup_folder()
            folder_id = _get_or_create_chatbot_auto_folder(chatbot, root_id)

        filename = f"{username}_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.png"

        service = _build_drive_client()
        metadata = {
            "name": filename,
            "parents": [folder_id],
        }
        
        fh = io.BytesIO(image_bytes)
        media = MediaIoBaseUpload(fh, mimetype='image/png', resumable=False)
        
        result = service.files().create(body=metadata, media_body=media, fields="id,name,webViewLink", supportsAllDrives=True).execute()
        
        return {
            "file_id": result.get("id"),
            "link": result.get("webViewLink"),
            "name": result.get("name"),
            "folder_id": folder_id,
        }
    except Exception as e:
        current_app.logger.warning(f"Failed to auto-upload generated image to drive: {e}")
        # Attach the error to the response temporarily for debugging
        return {"error": str(e)}
