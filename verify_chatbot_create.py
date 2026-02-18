
import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:5000/api"

def login():
    response = requests.post(f"{BASE_URL}/auth/login", json={
        "username": "admin",
        "password": "password"
    })
    if response.status_code == 200:
        return response.json()['token']
    else:
        print(f"Login failed: {response.text}")
        return None

def create_chatbot(token):
    headers = {"Authorization": f"Bearer {token}"}
    data = {
        "name": "API Test Chatbot",
        "event_name": "API Test Event",
        "description": "Created via API verification script",
        "start_date": datetime.now().date().isoformat(),
        "end_date": (datetime.now() + timedelta(days=5)).date().isoformat(),
        "system_prompt": "You are a test bot.",
        "active": True
    }
    
    print("Attempting to create chatbot...")
    response = requests.post(f"{BASE_URL}/chatbots", json=data, headers=headers)
    
    if response.status_code == 201:
        print("✅ Chatbot created successfully!")
        print(json.dumps(response.json(), indent=2))
        return response.json()['data']['id']
    else:
        print(f"❌ Creation failed: {response.text}")
        return None

def delete_chatbot(token, chatbot_id):
    if not chatbot_id: return
    
    headers = {"Authorization": f"Bearer {token}"}
    print(f"Cleaning up chatbot {chatbot_id}...")
    response = requests.delete(f"{BASE_URL}/chatbots/{chatbot_id}", headers=headers)
    
    if response.status_code == 200:
        print("✅ Cleanup successful.")
    else:
        print(f"❌ Cleanup failed: {response.text}")

if __name__ == "__main__":
    token = login()
    if token:
        chatbot_id = create_chatbot(token)
        # Uncomment to keep the chatbot for UI verification
        # delete_chatbot(token, chatbot_id)
