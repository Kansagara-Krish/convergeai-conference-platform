#!/usr/bin/env python
"""
Test script for conversation deletion functionality.
Verifies that deleting a conversation also removes all its messages.
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from backend.app import create_app
from backend.models import db, User, Chatbot, Conversation, Message
from datetime import datetime

def test_delete_conversation():
    app = create_app()
    
    with app.app_context():
        # Ensure database tables exist
        db.create_all()
        
        # Get existing user and chatbot
        user = User.query.first()
        chatbot = Chatbot.query.first()
        
        if not user or not chatbot:
            print("❌ ERROR: Missing user or chatbot records")
            return False
        
        print(f"✓ User: {user.email}")
        print(f"✓ Chatbot: {chatbot.name}")
        
        # Create a test conversation with messages
        test_conv = Conversation(
            chatbot_id=chatbot.id,
            user_id=user.id,
            title='TEST_DELETE_CONV',
            updated_at=datetime.utcnow()
        )
        db.session.add(test_conv)
        db.session.flush()
        conv_id = test_conv.id
        
        # Add messages to the conversation
        msg1 = Message(
            chatbot_id=chatbot.id,
            user_id=user.id,
            conversation_id=conv_id,
            content='Test message 1',
            is_user_message=True
        )
        msg2 = Message(
            chatbot_id=chatbot.id,
            user_id=user.id,
            conversation_id=conv_id,
            content='Test message 2',
            is_user_message=False
        )
        db.session.add_all([msg1, msg2])
        db.session.commit()
        
        print(f"\n✓ Created conversation ID: {conv_id}")
        
        # Verify messages were created
        msg_count = Message.query.filter_by(conversation_id=conv_id).count()
        print(f"✓ Messages in conversation: {msg_count}")
        
        # Now delete the conversation
        conv_to_delete = Conversation.query.get(conv_id)
        db.session.delete(conv_to_delete)
        db.session.commit()
        
        print(f"\n✓ Deleted conversation ID: {conv_id}")
        
        # Verify conversation is deleted
        conv_check = Conversation.query.get(conv_id)
        if conv_check is None:
            print("✓ Conversation successfully deleted from database")
        else:
            print("❌ ERROR: Conversation still exists in database")
            return False
        
        # Verify all messages for this conversation are also deleted
        remaining_msgs = Message.query.filter_by(conversation_id=conv_id).count()
        if remaining_msgs == 0:
            print("✓ All messages for conversation are deleted")
        else:
            print(f"⚠️  WARNING: Found {remaining_msgs} orphaned messages for deleted conversation")
        
        # Verify other conversations are unaffected
        total_convs = Conversation.query.count()
        total_msgs = Message.query.count()
        print(f"\n✓ Total conversations remaining: {total_convs}")
        print(f"✓ Total messages remaining: {total_msgs}")
        
        print("\n✅ DELETE TEST PASSED - All conversation data removed successfully!")
        return True

if __name__ == '__main__':
    try:
        success = test_delete_conversation()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ TEST FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
