"""Centralized email templates for easier maintenance by developers."""


def _clean_items(values):
    if not values or not isinstance(values, list):
        return []
    cleaned = []
    for value in values:
        text = str(value or "").strip()
        if text and text not in cleaned:
            cleaned.append(text)
    return cleaned


def build_user_credentials_email(*, role, username, email, password, allowed_events=None, allowed_chatbots=None):
    """Return subject/body for newly-created user credentials email."""
    events = _clean_items(allowed_events)
    chatbots = _clean_items(allowed_chatbots)

    events_line = ", ".join(events) if events else "Not assigned yet"
    chatbots_line = ", ".join(chatbots) if chatbots else "Not assigned yet"

    subject = "Your Account Credentials"
    body = (
        "Hello,\n\n"
        "Your account has been created successfully.\n\n"
        f"Role: {role}\n"
        f"Username: {username}\n"
        f"Email: {email}\n"
        f"Password: {password}\n\n"
        f"Allowed Event(s): {events_line}\n"
        f"Allowed Chatbot(s): {chatbots_line}\n\n"
        "Please login and change your password after first login.\n\n"
        "Regards,\nAdmin Team"
    )

    return {
        "subject": subject,
        "body": body,
    }
