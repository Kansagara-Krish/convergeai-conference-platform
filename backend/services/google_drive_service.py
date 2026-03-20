import json
import mimetypes
import os
from typing import Any, Dict, List, Optional

from flask import current_app


class GoogleDriveServiceError(Exception):
    def __init__(self, message: str, status_code: int = 500, payload: Any = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.payload = payload


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
