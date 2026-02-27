#!/usr/bin/env python
"""Diagnostic script to check database and file integrity"""

import os
import sys
from datetime import datetime
from sqlalchemy import text

sys.path.insert(0, os.getcwd())

from backend.app import create_app
from backend.models import db, Chatbot, Guest, User, ChatbotParticipant

app = create_app('development')

def diagnose():
    with app.app_context():
        print("\n" + "="*80)
        print("CONVERGEAI DIAGNOSTIC REPORT")
        print("="*80 + "\n")
        
        # 1. Check Database Connection
        print("[1] DATABASE CONNECTION")
        try:
            db.session.execute(text("SELECT 1"))
            print("✓ Database connection OK\n")
        except Exception as e:
            print(f"✗ Database connection FAILED: {e}\n")
            return
        
        # 2. Check Users
        print("[2] USERS")
        users = User.query.all()
        print(f"Total users: {len(users)}")
        for u in users:
            print(f"  - {u.username} ({u.email}) | Role: {u.role} | Active: {u.active}")
        print()
        
        # 3. Check Chatbots
        print("[3] CHATBOTS")
        chatbots = Chatbot.query.all()
        print(f"Total chatbots: {len(chatbots)}\n")
        
        for bot in chatbots:
            print(f"ID {bot.id}: {bot.name}")
            print(f"  Event: {bot.event_name}")
            print(f"  Description: {bot.description}")
            
            # Check API Key
            if bot.gemini_api_key:
                key_preview = bot.gemini_api_key[:15] + "..." if len(bot.gemini_api_key) > 15 else bot.gemini_api_key
                print(f"  ✓ API Key: {key_preview}")
            else:
                print(f"  ✗ API Key: MISSING or EMPTY")
            
            # Check Background Image
            if bot.background_image:
                bg_path = os.path.join(app.root_path, bot.background_image)
                exists = os.path.exists(bg_path)
                status = "✓" if exists else "✗"
                print(f"  {status} Background: {bot.background_image} ({'exists' if exists else 'MISSING'})")
            else:
                print(f"  ✗ Background: NOT SET")
            
            # Check Guests
            guests = bot.guests
            print(f"  Guests: {len(guests)}")
            for guest in guests:
                if guest.photo:
                    photo_path = os.path.join(app.root_path, guest.photo)
                    exists = os.path.exists(photo_path)
                    status = "✓" if exists else "✗"
                    print(f"    - {guest.name}: {guest.photo} ({'exists' if exists else 'MISSING'})")
                else:
                    print(f"    - {guest.name}: NO PHOTO")
            
            # Check Participants
            participants = ChatbotParticipant.query.filter_by(chatbot_id=bot.id).all()
            print(f"  Participants: {len(participants)}")
            for p in participants:
                user = User.query.get(p.user_id)
                print(f"    - {user.username} (joined: {p.joined_at})")
            
            print()
        
        # 4. Summary & Recommendations
        print("[4] RECOMMENDATIONS")
        issues = []
        
        for bot in chatbots:
            if not bot.gemini_api_key or bot.gemini_api_key.strip() == "":
                issues.append(f"Chatbot '{bot.name}' (ID {bot.id}) has NO API KEY")
            
            if not bot.background_image:
                issues.append(f"Chatbot '{bot.name}' (ID {bot.id}) has NO BACKGROUND IMAGE")
            elif not os.path.exists(os.path.join(app.root_path, bot.background_image)):
                issues.append(f"Chatbot '{bot.name}' background image file MISSING: {bot.background_image}")
            
            for guest in bot.guests:
                if not guest.photo:
                    issues.append(f"Guest '{guest.name}' in '{bot.name}' has NO PHOTO")
                elif not os.path.exists(os.path.join(app.root_path, guest.photo)):
                    issues.append(f"Guest '{guest.name}' photo file MISSING: {guest.photo}")
        
        if issues:
            print(f"Found {len(issues)} issue(s):\n")
            for i, issue in enumerate(issues, 1):
                print(f"  {i}. {issue}")
        else:
            print("✓ All checks passed! No issues detected.")
        
        print("\n" + "="*80 + "\n")

if __name__ == "__main__":
    diagnose()
