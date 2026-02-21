import requests
import json
from backend.app import create_app
from backend.models import db, Guest, SessionToken, User

# Create app context
app = create_app()
with app.app_context():
    # Get first guest from DB
    guest = Guest.query.first()
    if guest:
        print(f"✓ Found guest in DB: ID={guest.id}, Name={guest.name}")
        
        # Get an admin user to create a token
        admin = User.query.filter_by(is_admin=True).first()
        if admin:
            # Create a valid token
            token = SessionToken.create_token(admin.id)
            print(f"✓ Created token for admin: {admin.username}")
            
            # Test the GET endpoint
            headers = {"Authorization": f"Bearer {token}"}
            
            # First test list all guests
            response1 = requests.get("http://localhost:5000/api/admin/guests", headers=headers)
            print(f"\nGET /api/admin/guests → Status {response1.status_code}")
            
            # Then test get single guest
            url = f"http://localhost:5000/api/admin/guests/{guest.id}"
            response2 = requests.get(url, headers=headers)
            print(f"GET /api/admin/guests/{guest.id} → Status {response2.status_code}")
            print(f"Response: {json.dumps(response2.json(), indent=2)}")
        else:
            print("✗ No admin user found")
    else:
        print("✗ No guests in database")
