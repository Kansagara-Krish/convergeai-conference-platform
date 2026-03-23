import json
import os
import re
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
from urllib.parse import urljoin

from flask import Blueprint, current_app, jsonify, request

try:
    from models import WhatsAppSendHistory, db
    from routes.auth import token_required
    from services.whatsapp_service import (
        WhatsAppServiceError,
        send_whatsapp_template_image,
        send_whatsapp_text,
        upload_whatsapp_media,
    )
except ImportError:
    from backend.models import WhatsAppSendHistory, db
    from backend.routes.auth import token_required
    from backend.services.whatsapp_service import (
        WhatsAppServiceError,
        send_whatsapp_template_image,
        send_whatsapp_text,
        upload_whatsapp_media,
    )


whatsapp_bp = Blueprint("whatsapp", __name__)

WHATSAPP_NUMBER_PATTERN = re.compile(r"^\+?[1-9]\d{7,14}$")


def _normalize_whatsapp_number(raw_value: str) -> str:
    compact = re.sub(r"[^\d+]", "", str(raw_value or "").strip())
    if compact.startswith("+"):
        compact = compact[1:]
    return compact


def _is_valid_whatsapp_number(raw_value: str) -> bool:
    stripped = re.sub(r"[\s-]+", "", str(raw_value or "").strip())
    return bool(WHATSAPP_NUMBER_PATTERN.fullmatch(stripped))


def _extract_provider_message_id(response_payload: Dict[str, Any]) -> Optional[str]:
    messages = response_payload.get("messages") if isinstance(response_payload, dict) else None
    if isinstance(messages, list) and messages:
        first_message = messages[0]
        if isinstance(first_message, dict):
            message_id = first_message.get("id")
            if message_id:
                return str(message_id)
    return None


def _is_template_param_mismatch_error(exc: WhatsAppServiceError) -> bool:
    payload = exc.payload if isinstance(exc.payload, dict) else {}
    error_obj = payload.get("error") if isinstance(payload, dict) else None
    code = None
    if isinstance(error_obj, dict):
        code = error_obj.get("code")
    return code == 132000 or "132000" in str(exc.message or "")


def _is_path_within(candidate_path: Path, root_path: Path) -> bool:
    try:
        candidate_path.resolve().relative_to(root_path.resolve())
        return True
    except Exception:
        return False


def _resolve_allowed_local_image_path(raw_path: str) -> Optional[Path]:
    normalized = str(raw_path or "").strip().replace("\\", "/")
    if not normalized:
        return None

    if normalized.startswith("http://") or normalized.startswith("https://"):
        from urllib.parse import urlparse
        parsed = urlparse(normalized)
        normalized = parsed.path

    app_root = Path(current_app.root_path)
    static_generated_root = app_root / "static" / "generated"
    uploads_root = app_root / "uploads"

    candidates = []

    if normalized.startswith("/"):
        cleaned = normalized.lstrip("/")
        candidates.append(app_root / cleaned)
    else:
        candidates.append(app_root / normalized)

    if normalized.startswith("static/generated/"):
        candidates.append(static_generated_root / normalized.split("static/generated/", 1)[1])

    if normalized.startswith("/static/generated/"):
        candidates.append(static_generated_root / normalized.split("/static/generated/", 1)[1])

    if normalized.startswith("uploads/"):
        candidates.append(uploads_root / normalized.split("uploads/", 1)[1])

    if normalized.startswith("/uploads/"):
        candidates.append(uploads_root / normalized.split("/uploads/", 1)[1])

    if os.path.isabs(normalized):
        candidates.append(Path(normalized))

    for candidate in candidates:
        try:
            resolved = candidate.resolve()
        except Exception:
            continue

        if not resolved.is_file():
            continue

        allowed = _is_path_within(resolved, static_generated_root) or _is_path_within(resolved, uploads_root)
        if allowed:
            return resolved

    return None


def _to_absolute_image_url(raw_url: str) -> str:
    value = str(raw_url or "").strip()
    if not value:
        return ""

    if value.startswith("http://") or value.startswith("https://"):
        return value

    return urljoin(request.host_url, value.lstrip("/"))


def _to_public_image_url(raw_url: str) -> str:
    """Build externally reachable URL for local/static image paths."""
    value = str(raw_url or "").strip()
    if not value:
        return ""

    if value.startswith("http://") or value.startswith("https://"):
        return value

    public_base = str(current_app.config.get("PUBLIC_URL") or "").strip().rstrip("/")
    if public_base:
        return f"{public_base}/{value.lstrip('/')}"

    # Fallback keeps behavior for non-ngrok setups, but Meta cannot fetch localhost URLs.
    return _to_absolute_image_url(value)


def _local_path_to_relative_url(local_path: Path) -> Optional[str]:
    """Convert local app media file path to URL path when under static/uploads."""
    app_root = Path(current_app.root_path)

    static_generated_root = (app_root / "static" / "generated").resolve()
    uploads_root = (app_root / "uploads").resolve()
    resolved_local = local_path.resolve()

    if _is_path_within(resolved_local, static_generated_root):
        relative = resolved_local.relative_to(app_root / "static")
        return f"/static/{str(relative).replace(os.sep, '/')}"

    if _is_path_within(resolved_local, uploads_root):
        relative = resolved_local.relative_to(app_root)
        return f"/{str(relative).replace(os.sep, '/')}"

    return None


def _create_send_history(
    user_id: Optional[int],
    whatsapp_number: str,
    image_url: str,
    status: str,
    provider_message_id: Optional[str],
    payload: Any,
) -> None:
    history = WhatsAppSendHistory(
        user_id=user_id,
        whatsapp_number=whatsapp_number,
        image_url=image_url,
        status=status,
        provider_message_id=provider_message_id,
        response_payload=json.dumps(payload, ensure_ascii=True, default=str),
    )
    db.session.add(history)
    db.session.commit()


def _is_publicly_routable_url(candidate_url: str) -> bool:
    if not candidate_url:
        return False
    from urllib.parse import urlparse
    import ipaddress
    parsed = urlparse(candidate_url)
    if not parsed.hostname:
        return False
    if parsed.hostname in ("localhost", "127.0.0.1", "0.0.0.0"):
        return False
    try:
        ip_obj = ipaddress.ip_address(parsed.hostname)
        if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local:
            return False
    except ValueError:
        pass
    return True


def _send_image_using_template_strategy(
    to_number: str,
    image_url: str,
    image_path: str,
    template_name: str,
    template_language: str,
    body_variables: list,
) -> Tuple[Dict[str, Any], str]:
    # 1) Prefer public URL in template header image parameter.
    candidate_url = ""
    if image_url:
        candidate_url = _to_public_image_url(image_url)
    elif image_path:
        resolved_from_path = _resolve_allowed_local_image_path(image_path)
        if resolved_from_path:
            relative_url = _local_path_to_relative_url(resolved_from_path)
            if relative_url:
                candidate_url = _to_public_image_url(relative_url)

    if candidate_url and _is_publicly_routable_url(candidate_url):
        try:
            message_response = send_whatsapp_template_image(
                to_number=to_number,
                template_name=template_name,
                template_language=template_language,
                image_link=candidate_url,
                body_variables=body_variables,
            )
            return message_response, candidate_url
        except WhatsAppServiceError as url_error:
            current_app.logger.warning(
                "WhatsApp template URL send failed, attempting media upload fallback: %s",
                url_error.message,
            )

    # 2) Fallback to media upload and use media id in template header.
    resolved_local = None
    if image_path:
        resolved_local = _resolve_allowed_local_image_path(image_path)
    if not resolved_local and image_url:
        resolved_local = _resolve_allowed_local_image_path(image_url)

    if resolved_local:
        upload_response = upload_whatsapp_media(str(resolved_local))
        media_id = str(upload_response.get("id") or "").strip()
        if not media_id:
            raise WhatsAppServiceError(
                "Media upload did not return a media id",
                status_code=502,
                payload=upload_response,
            )

        message_response = send_whatsapp_template_image(
            to_number=to_number,
            template_name=template_name,
            template_language=template_language,
            image_media_id=media_id,
            body_variables=body_variables,
        )
        return message_response, str(resolved_local)

    # 3) No valid strategy available.
    if image_url:
        absolute_url = _to_public_image_url(image_url)
        if absolute_url:
            if not _is_publicly_routable_url(absolute_url):
                raise WhatsAppServiceError(
                    "Cannot send local or private URL to Meta API template header. Check PUBLIC_URL or file paths.",
                    status_code=400,
                )
            message_response = send_whatsapp_template_image(
                to_number=to_number,
                template_name=template_name,
                template_language=template_language,
                image_link=absolute_url,
                body_variables=body_variables,
            )
            return message_response, absolute_url

    raise WhatsAppServiceError(
        "Could not resolve a valid image source. Ensure image URL is public or file exists.",
        status_code=400,
    )


@whatsapp_bp.route("/webhook", methods=["GET"])
def verify_whatsapp_webhook():
    mode = str(request.args.get("hub.mode", "")).strip()
    verify_token = str(request.args.get("hub.verify_token", "")).strip()
    challenge = str(request.args.get("hub.challenge", "")).strip()

    expected_verify_token = str(current_app.config.get("WHATSAPP_VERIFY_TOKEN") or "").strip()

    if mode == "subscribe" and verify_token and verify_token == expected_verify_token:
        return challenge, 200

    return jsonify({"success": False, "message": "Webhook verification failed"}), 403


@whatsapp_bp.route("/webhook", methods=["POST"])
def receive_whatsapp_webhook():
    payload = request.get_json(silent=True) or {}

    try:
        entries = payload.get("entry") if isinstance(payload, dict) else None
        if not isinstance(entries, list):
            entries = []

        saved_count = 0

        for entry in entries:
            changes = entry.get("changes") if isinstance(entry, dict) else None
            if not isinstance(changes, list):
                continue

            for change in changes:
                value = change.get("value") if isinstance(change, dict) else None
                if not isinstance(value, dict):
                    continue

                statuses = value.get("statuses")
                if not isinstance(statuses, list):
                    continue

                for status_obj in statuses:
                    if not isinstance(status_obj, dict):
                        continue

                    status_value = str(status_obj.get("status") or "unknown").strip() or "unknown"
                    recipient_id = str(status_obj.get("recipient_id") or "").strip() or "unknown"
                    provider_message_id = str(status_obj.get("id") or "").strip() or None

                    history = WhatsAppSendHistory(
                        user_id=None,
                        whatsapp_number=recipient_id,
                        image_url="",
                        status=f"webhook:{status_value}",
                        provider_message_id=provider_message_id,
                        response_payload=json.dumps(status_obj, ensure_ascii=True, default=str),
                    )
                    db.session.add(history)
                    saved_count += 1

        if saved_count > 0:
            db.session.commit()

        current_app.logger.info("Received WhatsApp webhook payload")
        return jsonify({"success": True, "received": True, "saved": saved_count}), 200
    except Exception as exc:
        db.session.rollback()
        current_app.logger.exception("Failed to process WhatsApp webhook: %s", exc)
        return jsonify({"success": False, "message": "Failed to process webhook"}), 500


@whatsapp_bp.route("/send-history", methods=["GET"])
@token_required
def get_whatsapp_send_history(user):
    """Return recent WhatsApp send/webhook status records for diagnostics."""
    whatsapp_number = str(request.args.get("whatsapp_number") or request.args.get("whatsapp") or "").strip()
    provider_message_id = str(request.args.get("provider_message_id") or "").strip()

    try:
        limit = int(request.args.get("limit", 25))
    except (TypeError, ValueError):
        limit = 25

    if limit < 1:
        limit = 1
    if limit > 100:
        limit = 100

    query = WhatsAppSendHistory.query

    normalized_whatsapp = ""
    if whatsapp_number:
        if not _is_valid_whatsapp_number(whatsapp_number):
            return jsonify({"success": False, "message": "Please enter a valid WhatsApp number"}), 400
        normalized_whatsapp = _normalize_whatsapp_number(whatsapp_number)
        query = query.filter(WhatsAppSendHistory.whatsapp_number == normalized_whatsapp)

    if provider_message_id:
        query = query.filter(WhatsAppSendHistory.provider_message_id == provider_message_id)

    records = (
        query.order_by(WhatsAppSendHistory.created_at.desc())
        .limit(limit)
        .all()
    )

    sent_records = [item for item in records if str(item.status or "").startswith("sent:")]
    webhook_records = [item for item in records if str(item.status or "").startswith("webhook:")]
    failed_records = [item for item in records if str(item.status or "").startswith("failed:")]

    latest_by_provider_message_id = {}
    for item in records:
        message_id = str(item.provider_message_id or "").strip()
        if not message_id or message_id in latest_by_provider_message_id:
            continue
        latest_by_provider_message_id[message_id] = {
            "provider_message_id": message_id,
            "latest_status": item.status,
            "latest_created_at": item.created_at.isoformat() if item.created_at else None,
        }

    return jsonify(
        {
            "success": True,
            "message": "WhatsApp send history fetched successfully",
            "data": {
                "filters": {
                    "whatsapp_number": normalized_whatsapp or None,
                    "provider_message_id": provider_message_id or None,
                    "limit": limit,
                },
                "summary": {
                    "total": len(records),
                    "sent_count": len(sent_records),
                    "webhook_count": len(webhook_records),
                    "failed_count": len(failed_records),
                },
                "latest_by_provider_message_id": list(latest_by_provider_message_id.values()),
                "records": [item.to_dict() for item in records],
            },
        }
    ), 200


@whatsapp_bp.route("/send-image", methods=["POST"])
@token_required
def send_image_via_whatsapp(user):
    data = request.get_json(silent=True) or {}

    name = str(data.get("name") or "").strip()
    whatsapp_number = str(data.get("whatsapp_number") or data.get("whatsapp") or "").strip()
    image_url = str(data.get("image_url") or "").strip()
    image_path = str(data.get("image_path") or "").strip()
    template_name = str(data.get("template_name") or current_app.config.get("WHATSAPP_TEMPLATE_NAME") or "").strip()
    template_language = str(data.get("template_language") or current_app.config.get("WHATSAPP_TEMPLATE_LANGUAGE") or "en").strip() or "en"
    raw_body_variables = data.get("template_body_variables", data.get("body_variables", []))

    body_variables = []
    if isinstance(raw_body_variables, list):
        for item in raw_body_variables:
            text = str(item or "").strip()
            if text:
                body_variables.append(text)

    # Keep backward compatibility: if caller does not provide template vars,
    # use name as first body var when available.
    if not body_variables and name:
        body_variables = [name]

    if not _is_valid_whatsapp_number(whatsapp_number):
        return jsonify({"success": False, "message": "Please enter a valid WhatsApp number"}), 400

    if not image_url and not image_path:
        return jsonify({"success": False, "message": "image_url or image_path is required"}), 400

    if not template_name:
        return jsonify({"success": False, "message": "WHATSAPP_TEMPLATE_NAME is not configured"}), 500

    normalized_to = _normalize_whatsapp_number(whatsapp_number)

    try:
        try:
            api_response, logged_image_value = _send_image_using_template_strategy(
                to_number=normalized_to,
                image_url=image_url,
                image_path=image_path,
                template_name=template_name,
                template_language=template_language,
                body_variables=body_variables,
            )
        except WhatsAppServiceError as template_exc:
            if not _is_template_param_mismatch_error(template_exc):
                raise

            current_app.logger.warning(
                "Template parameter mismatch detected for template '%s'; retrying with fallback body vars",
                template_name,
            )

            fallback_candidates = []
            fallback_candidates.append([])
            if name:
                fallback_candidates.append([name])

            deduped_candidates = []
            seen = set()
            for candidate in fallback_candidates:
                key = tuple(candidate)
                if key in seen or candidate == body_variables:
                    continue
                seen.add(key)
                deduped_candidates.append(candidate)

            retried = False
            for candidate_vars in deduped_candidates:
                try:
                    api_response, logged_image_value = _send_image_using_template_strategy(
                        to_number=normalized_to,
                        image_url=image_url,
                        image_path=image_path,
                        template_name=template_name,
                        template_language=template_language,
                        body_variables=candidate_vars,
                    )
                    body_variables = candidate_vars
                    retried = True
                    break
                except WhatsAppServiceError as retry_exc:
                    if not _is_template_param_mismatch_error(retry_exc):
                        raise

            if not retried:
                raise template_exc

        provider_message_id = _extract_provider_message_id(api_response)

        _create_send_history(
            user_id=getattr(user, "id", None),
            whatsapp_number=normalized_to,
            image_url=logged_image_value,
            status="sent:template",
            provider_message_id=provider_message_id,
            payload={
                "type": "template",
                "template_name": template_name,
                "template_language": template_language,
                "body_variables": body_variables,
                "response": api_response,
            },
        )

        return jsonify(
            {
                "success": True,
                "message": "Template image message sent successfully",
                "data": {
                    "provider_message_id": provider_message_id,
                    "whatsapp_number": normalized_to,
                    "template_name": template_name,
                },
            }
        ), 200
    except WhatsAppServiceError as exc:
        error_payload = exc.payload if isinstance(exc.payload, (dict, list)) else {"message": str(exc)}

        try:
            _create_send_history(
                user_id=getattr(user, "id", None),
                whatsapp_number=normalized_to or "unknown",
                image_url=image_url or image_path,
                status="failed:template",
                provider_message_id=None,
                payload={
                    "type": "template",
                    "template_name": template_name,
                    "template_language": template_language,
                    "body_variables": body_variables,
                    "error": error_payload,
                },
            )
        except Exception:
            db.session.rollback()

        current_app.logger.warning("WhatsApp template send failed: %s", exc.message)
        return jsonify({"success": False, "message": exc.message, "error": error_payload}), exc.status_code
    except Exception as exc:
        db.session.rollback()
        current_app.logger.exception("Unexpected WhatsApp template send error: %s", exc)
        return jsonify({"success": False, "message": "Failed to send WhatsApp template image"}), 500


@whatsapp_bp.route("/send-text", methods=["POST"])
@token_required
def send_text_via_whatsapp(user):
    """Demo endpoint to validate WhatsApp outbound messaging with plain text."""
    data = request.get_json(silent=True) or {}

    whatsapp_number = str(data.get("whatsapp_number") or data.get("whatsapp") or "").strip()
    text = str(data.get("text") or "").strip()

    if not _is_valid_whatsapp_number(whatsapp_number):
        return jsonify({"success": False, "message": "Please enter a valid WhatsApp number"}), 400

    if not text:
        return jsonify({"success": False, "message": "text is required"}), 400

    normalized_to = _normalize_whatsapp_number(whatsapp_number)

    try:
        api_response = send_whatsapp_text(normalized_to, text)
        provider_message_id = _extract_provider_message_id(api_response)

        _create_send_history(
            user_id=getattr(user, "id", None),
            whatsapp_number=normalized_to,
            image_url="",
            status="sent:text",
            provider_message_id=provider_message_id,
            payload={
                "type": "text",
                "request": {
                    "text": text,
                },
                "response": api_response,
            },
        )

        return jsonify(
            {
                "success": True,
                "message": "Text message sent successfully",
                "data": {
                    "provider_message_id": provider_message_id,
                    "whatsapp_number": normalized_to,
                },
            }
        ), 200
    except WhatsAppServiceError as exc:
        error_payload = exc.payload if isinstance(exc.payload, (dict, list)) else {"message": str(exc)}

        try:
            _create_send_history(
                user_id=getattr(user, "id", None),
                whatsapp_number=normalized_to or "unknown",
                image_url="",
                status="failed:text",
                provider_message_id=None,
                payload={
                    "type": "text",
                    "request": {
                        "text": text,
                    },
                    "error": error_payload,
                },
            )
        except Exception:
            db.session.rollback()

        current_app.logger.warning("WhatsApp text send failed: %s", exc.message)
        return jsonify({"success": False, "message": exc.message, "error": error_payload}), exc.status_code
    except Exception as exc:
        db.session.rollback()
        current_app.logger.exception("Unexpected WhatsApp text send error: %s", exc)
        return jsonify({"success": False, "message": "Failed to send WhatsApp text"}), 500
