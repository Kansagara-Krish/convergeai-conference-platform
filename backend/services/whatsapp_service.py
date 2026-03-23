import mimetypes
import os
import time
from typing import Any, Dict, List, Optional

import requests
from flask import current_app


class WhatsAppServiceError(Exception):
    """Raised when WhatsApp Cloud API request fails."""

    def __init__(self, message: str, status_code: int = 500, payload: Any = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.payload = payload


def _get_config_value(name: str, default: str = "") -> str:
    value = current_app.config.get(name, default)
    return str(value or default).strip()


def _get_graph_api_base_url() -> str:
    api_version = _get_config_value("WHATSAPP_API_VERSION", "v23.0")
    return f"https://graph.facebook.com/{api_version}"


def _get_whatsapp_config() -> Dict[str, str]:
    return {
        "access_token": _get_config_value("WHATSAPP_ACCESS_TOKEN"),
        "phone_number_id": _get_config_value("WHATSAPP_PHONE_NUMBER_ID"),
    }


def _normalize_whatsapp_number(raw_number: str) -> str:
    cleaned = "".join(ch for ch in str(raw_number or "") if ch.isdigit() or ch == "+")
    if cleaned.startswith("+"):
        cleaned = cleaned[1:]
    return cleaned


def _raise_if_missing_config() -> None:
    cfg = _get_whatsapp_config()
    missing = []
    if not cfg["access_token"]:
        missing.append("WHATSAPP_ACCESS_TOKEN")
    if not cfg["phone_number_id"]:
        missing.append("WHATSAPP_PHONE_NUMBER_ID")

    if missing:
        raise WhatsAppServiceError(
            f"WhatsApp integration is not configured. Missing: {', '.join(missing)}",
            status_code=500,
        )


def _extract_meta_error(response_payload: Any) -> str:
    if not isinstance(response_payload, dict):
        return "WhatsApp API request failed"

    error_obj = response_payload.get("error")
    if not isinstance(error_obj, dict):
        return "WhatsApp API request failed"

    code = error_obj.get("code")
    message = str(error_obj.get("message") or "WhatsApp API request failed").strip()

    # Meta OAuthException code for expired or invalid token.
    if code == 190:
        return "WhatsApp access token is invalid or expired. Please reconnect Meta credentials."

    return message


def _post_json(endpoint_url: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    cfg = _get_whatsapp_config()
    headers = {
        "Authorization": f"Bearer {cfg['access_token']}",
        "Content-Type": "application/json",
        "Connection": "close",
    }

    response = _post_with_retry(
        endpoint_url,
        headers=headers,
        json_payload=payload,
        timeout=45,
    )

    parsed_payload: Any
    try:
        parsed_payload = response.json()
    except ValueError:
        parsed_payload = {"raw": response.text}

    if response.status_code >= 400:
        raise WhatsAppServiceError(
            _extract_meta_error(parsed_payload),
            status_code=response.status_code,
            payload=parsed_payload,
        )

    if not isinstance(parsed_payload, dict):
        parsed_payload = {"data": parsed_payload}

    return parsed_payload


def _post_with_retry(
    endpoint_url: str,
    headers: Dict[str, str],
    timeout: int,
    json_payload: Dict[str, Any] = None,
    form_data: Dict[str, Any] = None,
    files: Dict[str, Any] = None,
) -> requests.Response:
    """Retry transient network errors (connection reset, timeout, etc.)."""
    max_attempts = 3
    backoff_seconds = 0.8
    last_exception: Any = None

    for attempt in range(1, max_attempts + 1):
        try:
            return requests.post(
                endpoint_url,
                headers=headers,
                json=json_payload,
                data=form_data,
                files=files,
                timeout=timeout,
            )
        except requests.RequestException as exc:
            last_exception = exc
            if attempt >= max_attempts:
                break
            time.sleep(backoff_seconds * attempt)

    raise WhatsAppServiceError(
        f"Unable to reach WhatsApp API: {last_exception}",
        status_code=502,
    ) from last_exception


def _build_image_message_payload(to_number: str, image_payload: Dict[str, Any], caption: str = "") -> Dict[str, Any]:
    template_name = _get_config_value("WHATSAPP_TEMPLATE_NAME")
    
    if not template_name:
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to_number,
            "type": "image",
            "image": image_payload,
        }
        if caption:
            payload["image"]["caption"] = str(caption).strip()
        return payload

    template_lang = _get_config_value("WHATSAPP_TEMPLATE_LANGUAGE", "en")
    
    components = [
        {
            "type": "header",
            "parameters": [
                {
                    "type": "image",
                    "image": image_payload
                }
            ]
        }
    ]
    
    if caption:
        # Note: If the template has NO body variables defined in Meta, passing a body parameter might cause an error.
        # We assume the template was created with 1 body variable for the caption (e.g. {{1}}).
        components.append({
            "type": "body",
            "parameters": [
                {
                    "type": "text",
                    "text": str(caption).strip()
                }
            ]
        })
        
    payload = {
        "messaging_product": "whatsapp",
        "to": to_number,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {
                "code": template_lang
            },
            "components": components
        }
    }
    return payload


def send_whatsapp_image(to_number: str, image_url: str, caption: str = "") -> Dict[str, Any]:
    """Send image by public URL using Meta Cloud API /messages endpoint."""
    _raise_if_missing_config()

    normalized_to = _normalize_whatsapp_number(to_number)
    if not normalized_to:
        raise WhatsAppServiceError("Recipient WhatsApp number is required", status_code=400)

    link = str(image_url or "").strip()
    if not link:
        raise WhatsAppServiceError("Image URL is required", status_code=400)

    cfg = _get_whatsapp_config()
    endpoint_url = f"{_get_graph_api_base_url()}/{cfg['phone_number_id']}/messages"

    image_payload: Dict[str, Any] = {"link": link}
    payload = _build_image_message_payload(normalized_to, image_payload, caption)

    try:
        return _post_json(endpoint_url, payload)
    except WhatsAppServiceError as e:
        # If sending template fails because body parameters were not expected by the template,
        # retry without the body parameters to be safe.
        if e.payload and isinstance(e.payload, dict):
            error_data = e.payload.get("error", {})
            if "parameter" in str(error_data.get("message", "")).lower() or error_data.get("code") == 100:
                # Retry without caption as body parameter
                fallback_payload = _build_image_message_payload(normalized_to, image_payload, "")
                return _post_json(endpoint_url, fallback_payload)
        raise e


def upload_whatsapp_media(file_path: str) -> Dict[str, Any]:
    """Upload local media and return Meta media response with media id."""
    _raise_if_missing_config()

    normalized_path = os.path.abspath(str(file_path or "").strip())
    if not normalized_path or not os.path.isfile(normalized_path):
        raise WhatsAppServiceError("Image file not found for WhatsApp upload", status_code=400)

    cfg = _get_whatsapp_config()
    endpoint_url = f"{_get_graph_api_base_url()}/{cfg['phone_number_id']}/media"
    mime_type = mimetypes.guess_type(normalized_path)[0] or "application/octet-stream"

    headers = {
        "Authorization": f"Bearer {cfg['access_token']}",
        "Connection": "close",
    }

    with open(normalized_path, "rb") as file_handle:
        files = {
            "file": (os.path.basename(normalized_path), file_handle, mime_type),
        }
        data = {
            "messaging_product": "whatsapp",
            "type": "image",
        }

        response = _post_with_retry(
            endpoint_url,
            headers=headers,
            form_data=data,
            files=files,
            timeout=90,
        )

    try:
        parsed_payload: Any = response.json()
    except ValueError:
        parsed_payload = {"raw": response.text}

    if response.status_code >= 400:
        raise WhatsAppServiceError(
            _extract_meta_error(parsed_payload),
            status_code=response.status_code,
            payload=parsed_payload,
        )

    if not isinstance(parsed_payload, dict):
        parsed_payload = {"data": parsed_payload}

    return parsed_payload


def send_whatsapp_image_by_media_id(
    to_number: str,
    media_id: str,
    caption: str = "",
) -> Dict[str, Any]:
    """Send image by uploaded media id using Meta Cloud API /messages endpoint."""
    _raise_if_missing_config()

    normalized_to = _normalize_whatsapp_number(to_number)
    normalized_media_id = str(media_id or "").strip()

    if not normalized_to:
        raise WhatsAppServiceError("Recipient WhatsApp number is required", status_code=400)

    if not normalized_media_id:
        raise WhatsAppServiceError("Media id is required", status_code=400)

    cfg = _get_whatsapp_config()
    endpoint_url = f"{_get_graph_api_base_url()}/{cfg['phone_number_id']}/messages"

    image_payload: Dict[str, Any] = {"id": normalized_media_id}
    payload = _build_image_message_payload(normalized_to, image_payload, caption)

    try:
        return _post_json(endpoint_url, payload)
    except WhatsAppServiceError as e:
        if e.payload and isinstance(e.payload, dict):
            error_data = e.payload.get("error", {})
            if "parameter" in str(error_data.get("message", "")).lower() or error_data.get("code") == 100:
                fallback_payload = _build_image_message_payload(normalized_to, image_payload, "")
                return _post_json(endpoint_url, fallback_payload)
        raise e


def send_whatsapp_text(to_number: str, text: str) -> Dict[str, Any]:
    """Send plain text message using Meta Cloud API /messages endpoint."""
    _raise_if_missing_config()

    normalized_to = _normalize_whatsapp_number(to_number)
    body = str(text or "").strip()

    if not normalized_to:
        raise WhatsAppServiceError("Recipient WhatsApp number is required", status_code=400)

    if not body:
        raise WhatsAppServiceError("Message text is required", status_code=400)

    cfg = _get_whatsapp_config()
    endpoint_url = f"{_get_graph_api_base_url()}/{cfg['phone_number_id']}/messages"

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": normalized_to,
        "type": "text",
        "text": {
            "preview_url": False,
            "body": body,
        },
    }

    return _post_json(endpoint_url, payload)


def send_whatsapp_text_template(
    to_number: str,
    template_name: str,
    template_language: str,
    body_variables: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Send approved text-only template message with optional body variables."""
    _raise_if_missing_config()

    normalized_to = _normalize_whatsapp_number(to_number)
    normalized_template_name = str(template_name or "").strip()
    normalized_language = str(template_language or "").strip() or "en"

    if not normalized_to:
        raise WhatsAppServiceError("Recipient WhatsApp number is required", status_code=400)

    if not normalized_template_name:
        raise WhatsAppServiceError("Template name is required", status_code=500)

    components: List[Dict[str, Any]] = []
    clean_body_vars = [str(item).strip() for item in (body_variables or []) if str(item).strip()]
    if clean_body_vars:
        components.append(
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": body_var}
                    for body_var in clean_body_vars
                ],
            }
        )

    cfg = _get_whatsapp_config()
    endpoint_url = f"{_get_graph_api_base_url()}/{cfg['phone_number_id']}/messages"

    template_payload: Dict[str, Any] = {
        "name": normalized_template_name,
        "language": {"code": normalized_language},
    }
    if components:
        template_payload["components"] = components

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": normalized_to,
        "type": "template",
        "template": template_payload,
    }

    return _post_json(endpoint_url, payload)


def send_whatsapp_template_image(
    to_number: str,
    template_name: str,
    template_language: str,
    image_link: Optional[str] = None,
    image_media_id: Optional[str] = None,
    body_variables: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Send approved template with image header and optional body variables."""
    _raise_if_missing_config()

    normalized_to = _normalize_whatsapp_number(to_number)
    normalized_template_name = str(template_name or "").strip()
    normalized_language = str(template_language or "").strip() or "en"
    normalized_link = str(image_link or "").strip()
    normalized_media_id = str(image_media_id or "").strip()

    if not normalized_to:
        raise WhatsAppServiceError("Recipient WhatsApp number is required", status_code=400)

    if not normalized_template_name:
        raise WhatsAppServiceError("WHATSAPP_TEMPLATE_NAME is required", status_code=500)

    if not normalized_link and not normalized_media_id:
        raise WhatsAppServiceError(
            "Template image header requires image_link or image_media_id",
            status_code=400,
        )

    image_header: Dict[str, str]
    if normalized_link:
        image_header = {"link": normalized_link}
    else:
        image_header = {"id": normalized_media_id}

    components: List[Dict[str, Any]] = [
        {
            "type": "header",
            "parameters": [
                {
                    "type": "image",
                    "image": image_header,
                }
            ],
        }
    ]

    clean_body_vars = [str(item).strip() for item in (body_variables or []) if str(item).strip()]
    if clean_body_vars:
        components.append(
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": body_var}
                    for body_var in clean_body_vars
                ],
            }
        )

    cfg = _get_whatsapp_config()
    endpoint_url = f"{_get_graph_api_base_url()}/{cfg['phone_number_id']}/messages"

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": normalized_to,
        "type": "template",
        "template": {
            "name": normalized_template_name,
            "language": {"code": normalized_language},
            "components": components,
        },
    }

    return _post_json(endpoint_url, payload)
