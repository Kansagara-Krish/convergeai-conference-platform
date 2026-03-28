
import sys
import os
import json

# Add the project root to sys.path
project_root = r'C:\Users\kansa\OneDrive\Desktop\convergeai_conference_chatbot_system'
backend_root = os.path.join(project_root, 'backend')
if backend_root not in sys.path:
    sys.path.append(backend_root)

from app import create_app
from models import WhatsAppSendHistory

app = create_app('development')
with app.app_context():
    print("Checking WhatsAppSendHistory...")
    records = WhatsAppSendHistory.query.order_by(WhatsAppSendHistory.created_at.desc()).limit(5).all()
    if not records:
        print("No WhatsApp history records found.")
    for r in records:
        print(f"ID: {r.id} | To: {r.whatsapp_number} | Status: {r.status} | Time: {r.created_at}")
        if r.response_payload:
            try:
                parsed = json.loads(r.response_payload)
                print(f"  Response: {json.dumps(parsed, indent=2)}")
            except:
                print(f"  Response: {r.response_payload}")
        print("-" * 60)
