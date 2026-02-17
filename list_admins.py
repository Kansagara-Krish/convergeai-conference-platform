
import os
import sys
sys.path.append(os.getcwd())
from backend.app import create_app
from backend.models import User

app = create_app('development')
with app.app_context():
    admins = User.query.filter_by(role='admin').all()
    print("Admin Users:")
    for admin in admins:
        print(f"- Username: {admin.username}, Email: {admin.email}")
