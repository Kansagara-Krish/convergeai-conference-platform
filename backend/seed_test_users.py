"""
Seed script to create test users and volunteers with 2024 and 2025 registration dates.
All users get default password: 123456
Run:  python backend/seed_test_users.py
"""

import os
import sys
import random
import string
from datetime import datetime

# Ensure backend package is importable
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from models import db, User

FIRST_NAMES = [
    "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun",
    "Reyansh", "Sai", "Arnav", "Dhruv", "Kabir",
    "Ananya", "Diya", "Myra", "Sara", "Aadhya",
    "Isha", "Kavya", "Riya", "Priya", "Neha",
]

LAST_NAMES = [
    "Sharma", "Patel", "Gupta", "Singh", "Kumar",
    "Mehta", "Joshi", "Verma", "Reddy", "Nair",
    "Iyer", "Kapoor", "Malhotra", "Rao", "Das",
]


def random_phone():
    return f"+91{random.randint(7000000000, 9999999999)}"


def random_username(first, last):
    tag = ''.join(random.choices(string.digits, k=3))
    return f"{first.lower()}.{last.lower()}{tag}"


def seed_users():
    app = create_app()
    with app.app_context():
        created = []

        test_users = [
            # --- 2024 users ---
            {"role": "user",      "year": 2024, "month": 2},
            {"role": "user",      "year": 2024, "month": 5},
            {"role": "user",      "year": 2024, "month": 8},
            {"role": "volunteer", "year": 2024, "month": 3},
            {"role": "volunteer", "year": 2024, "month": 10},
            # --- 2025 users ---
            {"role": "user",      "year": 2025, "month": 1},
            {"role": "user",      "year": 2025, "month": 4},
            {"role": "user",      "year": 2025, "month": 7},
            {"role": "volunteer", "year": 2025, "month": 6},
            {"role": "volunteer", "year": 2025, "month": 11},
        ]

        for entry in test_users:
            first = random.choice(FIRST_NAMES)
            last = random.choice(LAST_NAMES)
            uname = random_username(first, last)

            # Make sure username and email are unique
            while User.query.filter_by(username=uname).first():
                uname = random_username(first, last)

            email = f"{uname}@testmail.com"
            while User.query.filter_by(email=email).first():
                uname = random_username(first, last)
                email = f"{uname}@testmail.com"

            name = f"{first} {last}"
            phone = random_phone()
            created_at = datetime(
                entry["year"],
                entry["month"],
                random.randint(1, 28),
                random.randint(8, 20),
                random.randint(0, 59),
            )

            user = User(
                username=uname,
                email=email,
                name=name,
                whatsapp_number=phone,
                role=entry["role"],
                active=True,
                created_at=created_at,
            )
            user.set_password("123456")

            db.session.add(user)
            created.append(
                f"  {entry['role']:10s}  {name:22s}  {uname:24s}  {phone}  {created_at.strftime('%Y-%m-%d')}"
            )

        db.session.commit()

        print(f"\n✅ Created {len(created)} test users:\n")
        print(f"  {'Role':10s}  {'Name':22s}  {'Username':24s}  {'Phone':15s}  {'Registered'}")
        print(f"  {'-'*10}  {'-'*22}  {'-'*24}  {'-'*15}  {'-'*10}")
        for line in created:
            print(line)
        print(f"\n  Default password for all: 123456\n")


if __name__ == "__main__":
    seed_users()
