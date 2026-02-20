import sys
sys.path.append('backend')

from app import create_app
from models import db, User, SessionToken

app = create_app()

with app.app_context():
    # Find admin user
    admin = User.query.filter_by(username='admin').first()
    
    if not admin:
        print("❌ Admin user not found!")
        sys.exit(1)
    
    # Get all users
    all_users = User.query.all()
    users_to_delete = [u for u in all_users if u.id != admin.id]
    
    print(f"\n{'='*60}")
    print(f"KEEPING:")
    print(f"{'='*60}")
    print(f"✓ ID {admin.id}: {admin.username} - {admin.email} - {admin.role}")
    
    print(f"\n{'='*60}")
    print(f"DELETING ({len(users_to_delete)} users):")
    print(f"{'='*60}")
    
    # First, delete all session tokens for these users
    tokens_deleted = 0
    for u in users_to_delete:
        user_tokens = SessionToken.query.filter_by(user_id=u.id).all()
        for token in user_tokens:
            db.session.delete(token)
            tokens_deleted += 1
    
    print(f"\n  Deleted {tokens_deleted} session tokens")
    
    # Now delete the users
    for u in users_to_delete:
        print(f"✗ ID {u.id}: {u.username} - {u.email} - {u.role}")
        db.session.delete(u)
    
    # Commit the changes
    db.session.commit()
    
    # Verify
    remaining = User.query.count()
    print(f"\n{'='*60}")
    print(f"✅ Successfully deleted {len(users_to_delete)} users!")
    print(f"✅ Remaining users in database: {remaining}")
    print(f"{'='*60}\n")
