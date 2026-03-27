import secrets
from datetime import datetime, timedelta
from urllib.parse import urlencode, urlsplit, urlunsplit, parse_qsl

import requests
from flask import Blueprint, current_app, jsonify, redirect, request
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

try:
    from models import User, UserGoogleToken, db
    from routes.auth import token_required
except ImportError:
    from backend.models import User, UserGoogleToken, db
    from backend.routes.auth import token_required


google_bp = Blueprint("google_oauth", __name__)

GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file"
_GOOGLE_AUTH_BASE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
_STATE_SALT = "google-oauth-state-v1"


def _oauth_serializer():
    secret = str(current_app.config.get("SECRET_KEY") or "")
    return URLSafeTimedSerializer(secret_key=secret, salt=_STATE_SALT)


def _append_query_params(url: str, params: dict) -> str:
    try:
        parts = urlsplit(url)
        existing = dict(parse_qsl(parts.query, keep_blank_values=True))
        existing.update(params)
        query = urlencode(existing)
        return urlunsplit((parts.scheme, parts.netloc, parts.path, query, parts.fragment))
    except Exception:
        return url


def _build_redirect_uri() -> str:
    configured = str(current_app.config.get("GOOGLE_OAUTH_REDIRECT_URI") or "").strip()
    if configured:
        return configured
    return request.host_url.rstrip("/") + "/api/google/auth/callback"


def _require_google_oauth_config():
    client_id = str(current_app.config.get("GOOGLE_OAUTH_CLIENT_ID") or "").strip()
    client_secret = str(current_app.config.get("GOOGLE_OAUTH_CLIENT_SECRET") or "").strip()
    missing = []

    if not client_id:
        missing.append("GOOGLE_OAUTH_CLIENT_ID")
    if not client_secret:
        missing.append("GOOGLE_OAUTH_CLIENT_SECRET")

    if missing:
        error_response = (
            jsonify({
                "success": False,
                "message": "Google OAuth is not configured.",
                "missing": missing,
            }),
            400,
        )
        return None, None, error_response

    return client_id, client_secret, None


def _build_google_auth_url(*, user, popup=False, return_to=""):
    client_id = str(current_app.config.get("GOOGLE_OAUTH_CLIENT_ID") or "").strip()
    redirect_uri = _build_redirect_uri()

    payload = {
        "nonce": secrets.token_urlsafe(12),
        "user_id": int(user.id),
        "popup": bool(popup),
        "return_to": str(return_to or "").strip(),
        "created_at": datetime.utcnow().isoformat(),
    }

    state = _oauth_serializer().dumps(payload)

    prompt_value = "consent"
    if hasattr(user, "role") and str(user.role).strip().lower() == "volunteer":
        prompt_value = "select_account consent"

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": GOOGLE_DRIVE_SCOPE,
        "access_type": "offline",
        "include_granted_scopes": "true",
        "prompt": prompt_value,
        "state": state,
    }

    return f"{_GOOGLE_AUTH_BASE_URL}?{urlencode(params)}"


def _popup_callback_html(success: bool, message: str):
    safe_message = str(message or "").replace("</", "<\\/")
    payload = "true" if success else "false"
    return f"""
<!doctype html>
<html>
  <head><meta charset=\"utf-8\"><title>Google Drive Connection</title></head>
  <body style=\"font-family:Arial,sans-serif;background:#0f172a;color:#e2e8f0;padding:20px;\">
    <h3>{'Google Drive connected' if success else 'Google Drive connection failed'}</h3>
    <p>{safe_message}</p>
    <p>This window will close automatically.</p>
    <script>
      try {{
        if (window.opener) {{
          window.opener.postMessage({{ type: 'google-drive-connected', success: {payload}, message: {safe_message!r} }}, window.location.origin);
        }}
      }} catch (e) {{}}
      setTimeout(function() {{ window.close(); }}, 500);
    </script>
  </body>
</html>
"""


@google_bp.route("/auth/status", methods=["GET"])
@token_required
def google_auth_status(user):
    token_row = UserGoogleToken.query.filter_by(user_id=user.id).first()

    connected = bool(token_row and token_row.refresh_token)
    expires_at = token_row.token_expiry.isoformat() if token_row and token_row.token_expiry else None

    return jsonify({
        "success": True,
        "data": {
            "connected": connected,
            "token_expiry": expires_at,
        },
    }), 200


@google_bp.route("/auth/login", methods=["GET"])
@token_required
def google_auth_login(user):
    client_id, client_secret, error_response = _require_google_oauth_config()
    if error_response:
        return error_response

    mode = str(request.args.get("mode") or "redirect").strip().lower()
    popup = str(request.args.get("popup") or "0").strip().lower() in {"1", "true", "yes"}
    return_to = str(request.args.get("return_to") or "").strip()

    auth_url = _build_google_auth_url(user=user, popup=popup, return_to=return_to)

    if mode == "json":
        return jsonify({
            "success": True,
            "data": {
                "auth_url": auth_url,
            },
        }), 200

    return redirect(auth_url, code=302)


@google_bp.route("/auth/callback", methods=["GET"])
def google_auth_callback():
    code = str(request.args.get("code") or "").strip()
    state = str(request.args.get("state") or "").strip()
    oauth_error = str(request.args.get("error") or "").strip()

    if oauth_error:
        return _popup_callback_html(False, f"OAuth error: {oauth_error}"), 200

    if not code or not state:
        return _popup_callback_html(False, "Missing OAuth code/state"), 400

    try:
        payload = _oauth_serializer().loads(state, max_age=900)
    except SignatureExpired:
        return _popup_callback_html(False, "OAuth request expired. Please try again."), 400
    except BadSignature:
        return _popup_callback_html(False, "Invalid OAuth state."), 400

    user_id = payload.get("user_id")
    popup = bool(payload.get("popup", False))
    return_to = str(payload.get("return_to") or "").strip()

    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        user_id = None

    if not user_id:
        return _popup_callback_html(False, "Invalid user context in OAuth state."), 400

    user = User.query.get(user_id)
    if not user:
        return _popup_callback_html(False, "User not found for OAuth callback."), 404

    client_id = str(current_app.config.get("GOOGLE_OAUTH_CLIENT_ID") or "").strip()
    client_secret = str(current_app.config.get("GOOGLE_OAUTH_CLIENT_SECRET") or "").strip()
    redirect_uri = _build_redirect_uri()

    if not client_id or not client_secret:
        return _popup_callback_html(False, "Google OAuth configuration is missing."), 400

    try:
        token_response = requests.post(
            _GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
            timeout=20,
        )
    except requests.RequestException as exc:
        current_app.logger.warning("Google token exchange request failed: %s", exc)
        return _popup_callback_html(False, "Failed to connect to Google token endpoint."), 502

    token_data = token_response.json() if token_response.content else {}
    if token_response.status_code >= 400:
        message = token_data.get("error_description") or token_data.get("error") or "Google token exchange failed"
        current_app.logger.warning("Google token exchange failed: %s", message)
        return _popup_callback_html(False, str(message)), 400

    access_token = str(token_data.get("access_token") or "").strip()
    refresh_token = str(token_data.get("refresh_token") or "").strip()
    expires_in = int(token_data.get("expires_in") or 3600)
    scope = str(token_data.get("scope") or GOOGLE_DRIVE_SCOPE).strip()

    if not access_token:
        return _popup_callback_html(False, "Google OAuth did not return an access token."), 400

    expires_at = datetime.utcnow() + timedelta(seconds=max(expires_in - 60, 60))

    row = UserGoogleToken.query.filter_by(user_id=user.id).first()
    if not row:
        row = UserGoogleToken(user_id=user.id)
        db.session.add(row)

    row.access_token = access_token
    if refresh_token:
        row.refresh_token = refresh_token
    row.token_expiry = expires_at
    row.scope = scope

    db.session.commit()

    current_app.logger.info("Google Drive connected for user_id=%s", user.id)

    if popup:
        return _popup_callback_html(True, "Google Drive connected successfully."), 200

    if return_to:
        redirect_url = _append_query_params(return_to, {"google_drive": "connected"})
        return redirect(redirect_url, code=302)

    return jsonify({"success": True, "message": "Google Drive connected"}), 200
