"""Simple Gemini chatbot tester.

Run this script and provide your Gemini API key when prompted. It will then enter a loop
where you can type messages and receive responses from the Gemini model. Typing
"exit" or pressing Ctrl+C will end the session.
"""

import requests
import sys

# default model, can be changed interactively later; 'free' will map to a flash model
GEMINI_MODEL = "gemini-flash-latest"

# Optionally hardcode your API key and model here for non-interactive testing:
# API_KEY = "YOUR_KEY_HERE"
# STATIC_MODEL = "gemini-flash-latest"  # or any supported model


def list_models(api_key: str):
    """Retrieve and print available Gemini models for the given key."""
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
    resp = requests.get(endpoint, timeout=20)
    if resp.status_code >= 400:
        print(f"Failed to list models ({resp.status_code}): {resp.text}")
        return []
    data = resp.json() or {}
    models = data.get("models") or []
    names = []
    print("Available models:")
    for m in models:
        name = m.get("name")
        if name:
            names.append(name)
            print(f" - {name} (\"{m.get('displayName', '')}\")")
    return names


def call_gemini(api_key: str, user_text: str, model: str) -> str:
    """Send a simple text prompt to Gemini and return the generated reply."""

    if not api_key:
        raise ValueError("API key is required")
    if not model:
        raise ValueError("Model name is required")

    endpoint = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    )

    prompt = user_text.strip() or "Hello"

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ],
        "generationConfig": {
            "temperature": 0.7,
            "topP": 0.9,
            "maxOutputTokens": 512,
        },
    }

    resp = requests.post(endpoint, json=payload, timeout=30)
    if resp.status_code >= 400:
        # on 404 try listing models for user
        if resp.status_code == 404:
            print("Model not found or unsupported for generateContent.")
            list_models(api_key)
        raise RuntimeError(f"Gemini API error {resp.status_code}: {resp.text}")

    data = resp.json()
    candidates = data.get("candidates") or []
    if not candidates:
        raise RuntimeError("No response candidate returned by Gemini")

    parts = (candidates[0].get("content") or {}).get("parts") or []
    text = "\n".join(p.get("text", "") for p in parts if p.get("text"))
    return text.strip()


def main():
    # support hardcoding key/model at top
    try:
        api_key = API_KEY  # type: ignore
    except NameError:
        api_key = input("Enter Gemini API key: ").strip()
    if not api_key:
        print("No API key provided, exiting.")
        sys.exit(1)

    # determine model
    try:
        model = STATIC_MODEL  # type: ignore
    except NameError:
        while True:
            model_input = input(f"Model name [{GEMINI_MODEL}] (or type 'free' for a free model): ").strip()
            if not model_input:
                model = GEMINI_MODEL
                break
            if model_input.lower() == "free":
                model = "gemini-flash-latest"
                break
            if " " in model_input:
                print("Model name appears to contain spaces; please enter a valid model identifier.")
                continue
            model = model_input
            break
    print(f"Using model: {model}\n")

    print("Type your messages below. Enter 'exit' to quit.")
    while True:
        try:
            user_msg = input("You: ")
        except (KeyboardInterrupt, EOFError):
            print("\nGoodbye")
            break
        if user_msg.lower() in ("exit", "quit"):
            print("Goodbye")
            break
        try:
            reply = call_gemini(api_key, user_msg, model)
            print("Bot:", reply)
        except Exception as e:
            print("Error:", e)
            # If model not found, allow user to pick another one
            if isinstance(e, RuntimeError) and "404" in str(e):
                new_model = input("Enter a different model name (or type 'free' for flash, blank to quit): ").strip()
                if new_model.lower() == "free":
                    model = "gemini-flash-latest"
                    continue
                if new_model:
                    model = new_model
                    continue
            break


if __name__ == "__main__":
    main()
