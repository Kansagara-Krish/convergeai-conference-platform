# ConvergeAI Conference Chatbot System

ConvergeAI is a full-stack conference chatbot platform with:
- Admin tools for chatbot/event management, guest management, and bulk user import.
- User tools for joining events and chatting with Gemini-powered assistants.
- Conversation history, role-based access control, notifications, and file uploads.
- Animated loading states (skeletons, button loaders, generation loaders) and a modern conference-themed UI.

Tech stack:
- Backend: Flask, SQLAlchemy, PostgreSQL, OpenPyXL
- Frontend: HTML, CSS, Vanilla JavaScript
- AI: Google Gemini API
- Deploy: Gunicorn + Docker Compose

## Features

### Admin
- Dashboard stats (`/api/admin/dashboard/stats`)
- User management (create, update, delete, role/active controls)
- Excel user import with preview and credential generation (`.xlsx`)
- Chatbot management (create/update/delete, prompts, API keys, event dates)
- Guest management with image upload
- Admin notifications feed

### User
- Browse active/public chatbots
- Join chatbots and track joined events
- Multi-conversation chat per chatbot
- Text + image message support
- Gemini image generation usage endpoint (`/api/user/usage`)
- Profile view/update

### Platform
- Token auth with role checks (`token_required`, `admin_required`)
- Health endpoint (`/api/health`)
- Upload serving (`/uploads/<path>`)
- Frontend served by Flask in normal app startup

### UI/UX (Current Work)
- Animated page skeleton loaders on admin pages while data is bootstrapping
- Conversation and message skeleton loaders in chat screens
- Image generation loader shown during Gemini image creation
- Button-level loaders for login, import, forgot-password, and reset flows
- Conference-style dark visual theme with gradients, glass effects, and responsive layouts

## User Types (4) and Feature Access

Current roles supported in the system:
- `admin`
- `user`
- `speaker`
- `volunteer`

Feature summary by role:
- `admin`: Full admin panel access (dashboard, users, chatbot config, guest management, import tools, notifications)
- `user`: Standard user portal access (join events, chat, conversations, profile, image usage limits)
- `volunteer`: User portal access with elevated image-generation allowance (unlimited generation behavior in UI)
- `speaker`: Stored as a valid role in the system; currently follows standard user-level chat/profile flow unless custom policy is added

## Repository Structure

```text
convergeai_conference_chatbot_system/
|-- backend/
|   |-- app.py
|   |-- config.py
|   |-- models.py
|   |-- requirements.txt
|   |-- routes/
|   |   |-- auth.py
|   |   |-- admin.py
|   |   |-- user.py
|   |   `-- chatbot.py
|   `-- uploads/
|-- frontend/
|   |-- index.html
|   |-- admin/
|   |-- user/
|   |-- css/
|   `-- js/
|-- database/
|   `-- init_db.py
|-- dev-scripts/
|-- Dockerfile
|-- docker-compose.yml
|-- wsgi.py
`-- README.md
```

## Requirements

- Python 3.11 recommended
- PostgreSQL 13+
- pip
- Optional: Docker + Docker Compose

## Environment Variables

Create `.env` in the project root.

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
- Chatbots can also store their own per-chatbot `gemini_api_key`.

## Local Setup (Windows PowerShell)

1. Clone and enter project.

```powershell
git clone <your-repo-url>
cd convergeai_conference_chatbot_system
```

2. Create and activate venv.

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

3. Install dependencies.

```powershell
pip install -r backend/requirements.txt
pip install -r requirements-dev.txt
```

4. Configure `.env` (see above).

5. Initialize database.

```powershell
python database/init_db.py
```

Credential note:
- Do not use shared/default credentials in public or production deployments.
- Create unique accounts and strong passwords for each environment.
- Keep credentials out of GitHub commits and documentation.

6. Run app.

```powershell
python backend/app.py
```

Local backend URL:
- `http://localhost:5050`

Because Flask serves the frontend directory, you can open:
- `http://localhost:5050/`

## Docker Setup

```powershell
docker-compose up -d --build
```

Default compose ports:
- Frontend container: `http://localhost:8000`
- Backend API/container: `http://localhost:5000`
- Postgres: `localhost:5432`

Stop:

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
- Dashboard and notifications:
  - `GET /dashboard/stats`
  - `GET /notifications`
  - `PUT /notifications/read`
- Users:
  - `GET /users`
  - `POST /users`
  - `GET /users/<user_id>`
  - `PUT /users/<user_id>`
  - `DELETE /users/<user_id>`
- Chatbots and guests:
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
- Import:
  - `POST /import/excel/preview`
  - `POST /import/excel`

### User (`/api/user`)
- `GET /guests?chatbot_id=<id>`
- `GET /chatbots`
- `GET /usage`
- `POST /chatbots/<chatbot_id>/join`
- `GET /my-chatbots`
- `GET /profile`
- `PUT /profile`
- Conversations:
  - `GET /chatbots/<chatbot_id>/conversations`
  - `POST /chatbots/<chatbot_id>/conversations`
  - `PUT /chatbots/<chatbot_id>/conversations/<conversation_id>`
  - `DELETE /chatbots/<chatbot_id>/conversations/<conversation_id>`
  - `GET /chatbots/<chatbot_id>/conversations/<conversation_id>/messages`
- Messages:
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

User import endpoint expects `.xlsx`.

Minimum required columns per row:
- `email`
- `username`

Optional columns:
- `name`
- `role`
- `password`
- `active`

Always provide a `password` column during import to avoid weak/shared temporary credentials.

## Authentication and Credentials

- No default username/password should be relied on for real deployments.
- Login supports both username or email with password.
- Password reset supports OTP flow (`request-otp` -> `reset`).
- Admin can reset user passwords through admin-protected endpoints.

## Utility Scripts

Top-level scripts:
- `database/init_db.py`: initialize DB schema and seed local development data
- `wsgi.py`: WSGI entry point for production servers

Diagnostic/dev scripts (under `dev-scripts/`):
- `diagnose.py`
- `check_guests_schema.py`
- `list_admins.py`

Note:
- Some legacy helper scripts reference older model fields. Use `database/init_db.py` and active API routes as the source of truth.

## Testing

Add project tests under a dedicated `tests/` folder (recommended) and run them with your preferred test runner.

```powershell
python test_delete_conversation.py
```

## Security Notes

- Do not publish shared/default credentials in repository docs.
- Use strong `SECRET_KEY` and `JWT_SECRET_KEY`.
- Restrict CORS and secure SMTP credentials in production.
- Do not commit `.env`, API keys, or real secrets.

## License

Add your preferred license file and update this section.
