# ConvergeAI Conference Chatbot System

## Project Overview
ConvergeAI is a full-stack conference chatbot platform for managing event assistants and attendee interactions.

It includes:
- An admin experience for chatbot setup, guest management, user management, and Excel-based onboarding
- A user experience for joining event chatbots, chatting, and managing profile data
- Role-based access control, conversation history, OTP-based password reset, notifications, and uploads
- Animated loading states and a polished conference-style dark UI

## Tech Stack
- Backend: Flask, SQLAlchemy, PostgreSQL, OpenPyXL
- Frontend: HTML, CSS, Vanilla JavaScript
- AI: Google Gemini API
- Deployment: Gunicorn + Docker Compose

## Screenshots
Add project screenshots here for GitHub presentation.

Suggested screenshots:
- Login page
- Admin dashboard
- Chatbot management page
- User chat interface

Example Markdown:

```md
![Admin Dashboard](docs/screenshots/admin-dashboard.png)
![User Chat](docs/screenshots/user-chat.png)
```

## Features
### Admin Features
- Dashboard stats (`/api/admin/dashboard/stats`)
- User management (create, update, delete, role/active controls)
- Excel user import with preview and credential generation (`.xlsx`)
- Chatbot management (create, update, delete, prompts, API keys, event dates)
- Guest management with image upload
- Admin notifications feed

### User Features
- Browse active/public chatbots
- Join chatbots and track joined events
- Multi-conversation chat per chatbot
- Text and image message support
- Gemini image generation usage tracking (`/api/user/usage`)
- Profile view and update

### Platform and UX Features
- Token-based auth with role checks (`token_required`, `admin_required`)
- Health endpoint (`/api/health`)
- Upload serving (`/uploads/<path>`)
- Frontend served by Flask in normal app startup
- Animated page skeleton loaders (admin bootstrapping)
- Conversation/message skeleton loaders in chat views
- Image generation loader during Gemini generation flows
- Button-level loaders for login, import, forgot-password, and reset actions

## User Roles and Access
Current supported roles (3):
- `admin`
- `user`
- `volunteer`

Role summary:
- `admin`: Full admin panel access (users, chatbots, guests, import, notifications, dashboard)
- `user`: Standard user portal access (join events, chat, conversations, profile, usage limits)
- `volunteer`: User portal access with elevated image-generation allowance (unlimited behavior in UI)

## Repository Structure
```text
convergeai_conference_chatbot_system/
|-- backend/
|   |-- app.py
|   |-- config.py
|   |-- models.py
|   |-- requirements.txt
|   |-- routes/
|   |   |-- __init__.py
|   |   |-- admin.py
|   |   |-- auth.py
|   |   |-- chatbot.py
|   |   `-- user.py
|   `-- static/
|       `-- generated/
|-- database/
|   `-- init_db.py
|-- dev-scripts/
|   |-- check_guests_schema.py
|   |-- diagnose.py
|   `-- list_admins.py
|-- frontend/
|   |-- index.html
|   |-- forgot-password.html
|   |-- test-delete.html
|   |-- admin/
|   |-- user/
|   |-- css/
|   `-- js/
|-- uploads/
|   |-- backgrounds/
|   |-- guest_lists/
|   |-- guests/
|   `-- messages/
|-- Dockerfile
|-- docker-compose.yml
|-- requirements-dev.txt
|-- wsgi.py
`-- README.md
```

## Requirements
- Python 3.11 (recommended)
- PostgreSQL 13+
- `pip`
- Optional: Docker + Docker Compose

## Environment Variables
Create a `.env` file in the project root.

```env
FLASK_ENV=development
FLASK_DEBUG=True
SECRET_KEY=change-this
JWT_SECRET_KEY=change-this-too

DATABASE_URL=postgresql+psycopg2://username:password@localhost:5432/convergeai_db

# Upload / limits
MAX_CONTENT_LENGTH=52428800
UPLOAD_FOLDER=uploads

# Email (used for OTP and credential/reset mails)
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=you@example.com
MAIL_PASSWORD=app-password
MAIL_DEFAULT_SENDER=you@example.com
MAIL_USE_TLS=true
MAIL_USE_SSL=false

# Optional global Gemini fallback key
GEMINI_API_KEY=
GOOGLE_API_KEY=
GEMINI_IMAGE_MODEL=gemini-2.0-flash-exp
```

Notes:
- In production mode, `DATABASE_URL`, `SECRET_KEY`, and `JWT_SECRET_KEY` are validated.
- Chatbots can store per-chatbot `gemini_api_key` values.
- Never commit `.env`, API keys, or real secrets.

## Installation
### Local Setup (Windows PowerShell)
1. Clone the repository and enter the project folder.

```powershell
git clone <your-repo-url>
cd convergeai_conference_chatbot_system
```

2. Create and activate a virtual environment.

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

3. Install dependencies.

```powershell
pip install -r backend/requirements.txt
pip install -r requirements-dev.txt
```

4. Add a `.env` file (see the Environment Variables section).

5. Initialize the database.

```powershell
python database/init_db.py
```

6. Run the application.

```powershell
python backend/app.py
```

Local URLs:
- App (Flask + frontend): `http://localhost:5050/`
- Health check: `http://localhost:5050/api/health`

### Docker Setup
Build and start services:

```powershell
docker-compose up -d --build
```

Default ports:
- Frontend container: `http://localhost:8000`
- Backend API container: `http://localhost:5000`
- PostgreSQL: `localhost:5432`

Stop services:

```powershell
docker-compose down
```

## API Summary
Base prefixes:
- `/api/auth`
- `/api/admin`
- `/api/user`
- `/api/chatbots`

### Auth (`/api/auth`)
- `POST /login`
- `POST /register`
- `POST /logout`
- `GET /verify`
- `PUT /change-password`
- `POST /forgot-password/request-otp`
- `POST /forgot-password/reset`
- `POST /users/<user_id>/reset-password` (admin)

### Admin (`/api/admin`)
- `GET /dashboard/stats`
- `GET /notifications`
- `PUT /notifications/read`
- `GET /users`
- `POST /users`
- `GET /users/<user_id>`
- `PUT /users/<user_id>`
- `DELETE /users/<user_id>`
- `GET /chatbots`
- `GET /chatbots/<chatbot_id>`
- `DELETE /chatbots/<chatbot_id>`
- `GET /chatbots/<chatbot_id>/guests`
- `POST /chatbots/<chatbot_id>/guests`
- `GET /guests`
- `POST /guests`
- `GET /guests/<guest_id>`
- `PUT /guests/<guest_id>`
- `DELETE /guests/<guest_id>`
- `POST /import/excel/preview`
- `POST /import/excel`

### User (`/api/user`)
- `GET /guests?chatbot_id=<id>`
- `GET /chatbots`
- `GET /usage`
- `POST /chatbots/<chatbot_id>/image-contacts`
- `POST /chatbots/<chatbot_id>/join`
- `GET /my-chatbots`
- `GET /profile`
- `PUT /profile`
- `GET /chatbots/<chatbot_id>/conversations`
- `POST /chatbots/<chatbot_id>/conversations`
- `PUT /chatbots/<chatbot_id>/conversations/<conversation_id>`
- `DELETE /chatbots/<chatbot_id>/conversations/<conversation_id>`
- `GET /chatbots/<chatbot_id>/conversations/<conversation_id>/messages`
- `GET /chatbots/<chatbot_id>/messages`
- `POST /chatbots/<chatbot_id>/messages`

### Chatbots (`/api/chatbots`)
- `POST /` (admin)
- `PUT /<chatbot_id>` (admin)
- `GET /<chatbot_id>`
- `GET /<chatbot_id>/settings` (admin)
- `GET /<chatbot_id>/stats`

### System
- `GET /api/health`
- `GET /uploads/<path>`

## Import File Format
User import endpoint expects `.xlsx` files.

Required columns:
- `email`
- `username`

Optional columns:
- `name`
- `role`
- `password`
- `active`

Recommendation:
- Always provide a `password` column during import to avoid weak temporary defaults.

## Utility Scripts
Top-level scripts:
- `database/init_db.py`: Initializes database schema and seeds local development data
- `wsgi.py`: WSGI entry point for production servers

Diagnostic scripts (`dev-scripts/`):
- `diagnose.py`
- `check_guests_schema.py`
- `list_admins.py`

## Testing
Add project tests under a dedicated `tests/` folder and run them with your preferred test runner.

```powershell
python test_delete_conversation.py
```

## Security Notes
- Use strong `SECRET_KEY` and `JWT_SECRET_KEY` values.
- Restrict CORS and protect SMTP credentials in production.
- Avoid publishing shared/default credentials in public docs.
- Rotate compromised tokens and keys immediately.

## Contribution
Contributions are welcome.

Suggested workflow:
1. Fork the repository.
2. Create a feature branch.
3. Make focused changes with clear commit messages.
4. Run tests and basic manual checks.
5. Open a Pull Request with a clear description.

## Future Improvements
- Add automated test coverage for key API and frontend flows
- Add API documentation with request/response examples
- Add CI/CD checks (lint, tests, security scanning)
- Add production deployment documentation and hardening checklist

## License
No license file is currently included.

Before public open-source distribution, add a `LICENSE` file (for example, MIT/Apache-2.0) and update this section accordingly.
