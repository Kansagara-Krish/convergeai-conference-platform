import os
from pathlib import Path
from urllib.parse import urlparse

from flask import Blueprint, current_app, jsonify, request

try:
    from models import Chatbot, ChatbotParticipant, DriveImageBackup, Message, db
    from routes.auth import token_required
    from services.google_drive_service import (
        GoogleDriveServiceError,
        ensure_chatbot_folder,
        get_folder_options,
        upload_user_file_to_drive,
        upload_file,
    )
except ImportError:
    from backend.models import Chatbot, ChatbotParticipant, DriveImageBackup, Message, db
    from backend.routes.auth import token_required
    from backend.services.google_drive_service import (
        GoogleDriveServiceError,
        ensure_chatbot_folder,
        get_folder_options,
        upload_user_file_to_drive,
        upload_file,
    )


drive_bp = Blueprint("drive", __name__)

_ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
_ALLOWED_PREFIXES = (
    "static/generated/",
    "uploads/messages/",
)


def _is_allowed_generated_path(normalized_path: str) -> bool:
    return any(normalized_path.startswith(prefix) for prefix in _ALLOWED_PREFIXES)


def _normalize_local_image_path(raw_value: str) -> str:
    value = str(raw_value or "").strip().replace("\\", "/")
    if not value:
        return ""

    if value.startswith("http://") or value.startswith("https://"):
        parsed = urlparse(value)
        value = str(parsed.path or "").strip()

    value = value.lstrip("/")
    if "/uploads/" in value:
        value = value.split("/uploads/", 1)[1]
        value = f"uploads/{value}"
    elif "/static/generated/" in value:
        value = value.split("/static/generated/", 1)[1]
        value = f"static/generated/{value}"

    if not _is_allowed_generated_path(value):
        return ""

    extension = Path(value).suffix.lower()
    if extension not in _ALLOWED_EXTENSIONS:
        return ""

    return value


def _resolve_image_absolute_path(raw_value: str) -> str:
    normalized = _normalize_local_image_path(raw_value)
    if not normalized:
        return ""

    absolute_path = os.path.abspath(
        os.path.join(current_app.root_path, normalized.replace("/", os.sep)),
    )

    app_root = os.path.abspath(current_app.root_path)
    if not absolute_path.startswith(app_root + os.sep):
        return ""

    if not os.path.isfile(absolute_path):
        return ""

    return absolute_path


def _user_can_access_chatbot(user, chatbot_id: int) -> bool:
    if not chatbot_id or not user:
        return False

    user_role = str(getattr(user, "role", "") or "").strip().lower()
    if user_role == "admin":
        return True

    user_id = getattr(user, "id", None)
    if user_id is None:
        return False

    participant = ChatbotParticipant.query.filter_by(
        chatbot_id=chatbot_id,
        user_id=user_id,
    ).first()
    return participant is not None


@drive_bp.route("/folders", methods=["GET"])
@token_required
def list_drive_folders(user):
    chatbot_id = request.args.get("chatbot_id", type=int)

    chatbot_name = None
    if chatbot_id:
        chatbot = Chatbot.query.get(chatbot_id)
        if chatbot:
            if not _user_can_access_chatbot(user, chatbot.id):
                return jsonify({"success": False, "message": "Access denied for chatbot"}), 403
            chatbot_name = chatbot.name or f"Chatbot {chatbot.id}"

    options = get_folder_options(chatbot_name=chatbot_name)

    return jsonify({
        "success": True,
        "data": options,
    }), 200


@drive_bp.route("/save-image", methods=["POST"])
@token_required
def save_image_to_drive(user):
    data = request.get_json(silent=True) or {}

    chatbot_id = data.get("chatbot_id")
    image_value = str(data.get("image_url") or data.get("image_path") or "").strip()
    drive_folder_id = str(data.get("drive_folder_id") or "").strip()
    create_chatbot_folder = bool(data.get("create_chatbot_folder", False))

    try:
        chatbot_id = int(chatbot_id)
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "Valid chatbot_id is required"}), 400

    chatbot = Chatbot.query.get(chatbot_id)
    if not chatbot:
        return jsonify({"success": False, "message": "Chatbot not found"}), 404

    if not _user_can_access_chatbot(user, chatbot.id):
        return jsonify({"success": False, "message": "Access denied for chatbot"}), 403

    absolute_image_path = _resolve_image_absolute_path(image_value)
    if not absolute_image_path:
        return jsonify(
            {
                "success": False,
                "message": "Only valid generated image files can be saved to Drive",
            }
        ), 400

    normalized_image_path = _normalize_local_image_path(image_value)

    try:
        target_folder_id = drive_folder_id
        if create_chatbot_folder or target_folder_id == "__chatbot_auto__":
            folder = ensure_chatbot_folder(chatbot.name or f"Chatbot {chatbot.id}")
            target_folder_id = str(folder.get("id") or "").strip()

        if not target_folder_id:
            return jsonify(
                {
                    "success": False,
                    "message": "Drive folder is required. Select a folder first.",
                }
            ), 400

        uploaded = upload_file(
            local_file_path=absolute_image_path,
            drive_folder_id=target_folder_id,
            desired_filename=os.path.basename(absolute_image_path),
        )

        backup = DriveImageBackup(
            chatbot_id=chatbot.id,
            user_id=getattr(user, "id", None),
            image_path=normalized_image_path,
            drive_file_id=uploaded["file_id"],
            drive_folder_id=target_folder_id,
            drive_link=uploaded["link"],
        )
        db.session.add(backup)
        db.session.commit()

        current_app.logger.info(
            "Drive backup created for chatbot_id=%s user_id=%s file_id=%s",
            chatbot.id,
            getattr(user, "id", None),
            uploaded["file_id"],
        )

        return jsonify(
            {
                "success": True,
                "message": "Image saved to Google Drive",
                "data": backup.to_dict(),
            }
        ), 201
    except GoogleDriveServiceError as exc:
        db.session.rollback()
        current_app.logger.warning("Drive backup failed: %s", exc.message)
        return jsonify({"success": False, "message": exc.message}), exc.status_code
    except Exception as exc:
        db.session.rollback()
        current_app.logger.exception("Unexpected Drive backup error: %s", exc)
        return jsonify({"success": False, "message": "Failed to save image to Drive"}), 500


@drive_bp.route("/upload-generated-image", methods=["POST"])
@token_required
def upload_generated_image_to_user_drive(user):
    data = request.get_json(silent=True) or {}

    chatbot_id = data.get("chatbot_id")
    image_value = str(data.get("image_url") or data.get("image_path") or "").strip()
    image_id = data.get("image_id")

    message_record = None
    if not image_value and image_id is not None:
        try:
            image_id = int(image_id)
        except (TypeError, ValueError):
            image_id = None

        if image_id:
            message_record = Message.query.get(image_id)
            if message_record and message_record.image_url:
                image_value = str(message_record.image_url).strip()
            elif message_record and message_record.content:
                image_value = str(message_record.content).strip()

    if not image_value:
        return jsonify({"success": False, "message": "image_url, image_path, or image_id is required"}), 400

    if chatbot_id is None and message_record is not None:
        chatbot_id = message_record.chatbot_id

    if chatbot_id is None:
        return jsonify({"success": False, "message": "chatbot_id is required"}), 400

    try:
        chatbot_id = int(chatbot_id)
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "Invalid chatbot_id"}), 400

    chatbot = Chatbot.query.get(chatbot_id)
    if not chatbot:
        return jsonify({"success": False, "message": "Chatbot not found"}), 404
    if not _user_can_access_chatbot(user, chatbot.id):
        return jsonify({"success": False, "message": "Access denied for chatbot"}), 403

    absolute_image_path = _resolve_image_absolute_path(image_value)
    if not absolute_image_path:
        return jsonify({"success": False, "message": "Only valid generated image files can be uploaded"}), 400

    normalized_image_path = _normalize_local_image_path(image_value)

    try:
        uploaded = upload_user_file_to_drive(
            user=user,
            file_path=absolute_image_path,
            filename=os.path.basename(absolute_image_path),
        )

        backup = DriveImageBackup(
            chatbot_id=chatbot_id,
            user_id=getattr(user, "id", None),
            image_path=normalized_image_path,
            drive_file_id=uploaded["drive_file_id"],
            drive_folder_id=uploaded.get("folder_id") or "root",
            drive_link=uploaded["drive_link"],
        )

        db.session.add(backup)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Image uploaded to Google Drive",
            "data": {
                "drive_file_id": uploaded["drive_file_id"],
                "drive_link": uploaded["drive_link"],
                "chatbot_id": chatbot_id,
            },
        }), 200
    except GoogleDriveServiceError as exc:
        db.session.rollback()
        return jsonify({"success": False, "message": exc.message}), exc.status_code
    except Exception as exc:
        db.session.rollback()
        current_app.logger.exception("Unexpected user drive upload error: %s", exc)
        return jsonify({"success": False, "message": "Failed to upload image to Google Drive"}), 500
