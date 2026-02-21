from backend.app import create_app
from backend.models import db, Guest, Chatbot

app = create_app()
with app.app_context():
    # Check if there are any guests
    existing = Guest.query.first()
    if not existing:
        # Create a test guest
        guest = Guest(
            name='John Smith',
            email='john.smith@example.com',
            title='Lead Speaker',
            description='Expert in AI and Machine Learning with 10+ years of experience',
            organization='Tech Corp Inc',
            is_speaker=True,
            is_moderator=False
        )
        db.session.add(guest)
        db.session.commit()
        print(f"✓ Created test guest: {guest.name} (ID: {guest.id})")
    else:
        print(f"✓ Guest already exists: {existing.name} (ID: {existing.id})")
    
    # List all guests
    all_guests = Guest.query.all()
    print(f"\nTotal guests in database: {len(all_guests)}")
    for g in all_guests:
        print(f"  - {g.name} ({g.email})")
