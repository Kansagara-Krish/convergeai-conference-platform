
import os
import sys
from datetime import datetime, timedelta

# Add the current directory to sys.path
sys.path.append(os.getcwd())

from backend.app import create_app
from backend.models import db, User, Chatbot, Guest

app = create_app('development')

with app.app_context():
    print("Seeding database with demo data...")
    
    # Get Admin
    admin = User.query.filter_by(username='admin').first()
    if not admin:
        print("Admin not found, creating...")
        admin = User(username='admin', email='admin@convergeai.com', role='admin')
        admin.set_password('password')
        db.session.add(admin)
        db.session.commit()

    # Create Demo Chatbot if none exist
    if Chatbot.query.count() == 0:
        print("Creating demo chatbot...")
        bot = Chatbot(
            name="TechConf 2026 Assistant",
            event_name="Global Tech Summit 2026",
            description="Official AI assistant for the Global Tech Summit.",
            start_date=datetime.now().date(),
            end_date=(datetime.now() + timedelta(days=3)).date(),
            system_prompt="You are a helpful assistant.",
            created_by_id=admin.id
        )
        db.session.add(bot)
        db.session.commit()
    else:
        bot = Chatbot.query.first()
        print("Chatbot already exists.")

    # Create Demo Guests if none exist
    if Guest.query.count() == 0:
        print("Creating demo guests...")
        guests = [
            Guest(
                chatbot_id=bot.id,
                name="Sarah Connor",
                email="sarah@techconf.com",
                is_speaker=True,
                title="AI Safety Researcher",
                organization="Cyberdyne Systems"
            ),
            Guest(
                chatbot_id=bot.id,
                name="John Smith",
                email="john@example.com",
                is_speaker=False,
                title="Attendee",
                organization="Tech Corp"
            )
        ]
        db.session.add_all(guests)
        db.session.commit()
        print(f"Added {len(guests)} guests.")
    else:
        print("Guests already exist.")
        
    print("Seeding complete.")
