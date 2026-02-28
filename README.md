# 🤖 ConvergeAI Conference Chatbot System

A comprehensive, enterprise-grade web platform for managing AI-powered chatbots at academic conferences and professional events. Built with Flask, PostgreSQL, and modern web technologies, this system enables seamless interaction between conference attendees and AI assistants powered by Google's Gemini API.

## 🌟 Overview

The ConvergeAI Conference Chatbot System is designed to enhance conference experiences by providing intelligent, context-aware chatbots that can assist attendees with information about speakers, schedules, and event details. Administrators can easily create and manage multiple chatbots for different events, while users enjoy a modern, intuitive chat interface.

## ✨ Key Features

### 🔧 Admin Panel
- **Dashboard Overview**: Real-time statistics and insights
  - Total chatbots, active events, registered users
  - Upcoming events and engagement metrics
  - System health monitoring
- **Chatbot Management**: Complete lifecycle control
  - Create, edit, delete, and configure chatbots
  - Toggle Active/Inactive status
  - Configure Gemini AI system prompts
  - Manage background images and visual assets
  - Set event start/end dates (supports infinite end dates)
- **Guest Management**: Expert and speaker profiles
  - Add/remove guest speakers and moderators
  - Upload guest photos and biographies
  - Active/Inactive guest status control
  - Bulk import via Excel/CSV
- **User Management**: Complete user administration
  - View, create, edit, and deactivate users
  - Role-based access control (Admin/User)
  - Password reset functionality
  - Bulk user import from Excel
- **Import System**: Streamlined data import
  - Excel/CSV bulk user import
  - Guest list batch upload
  - Automated credential generation
- **Notification System**: Admin bell notifications for system events

### 👤 User Panel
- **Dashboard**: Browse and discover events
  - View available conference chatbots
  - Join events and start conversations
  - Track active and upcoming conferences
- **Chat Interface**: Modern AI-powered conversations
  - Real-time messaging with Gemini AI
  - Multiple conversation threads per chatbot
  - Message history and persistence
  - Intuitive, responsive chat UI
- **Profile Management**: User account control
  - Update personal information
  - Change password securely
  - View participation history

### 🎨 Design Features
- **Glassmorphism UI**: Modern frosted glass aesthetic
- **Gradient Themes**: Deep blue, purple, and cyan color scheme
- **Smooth Animations**: Fluid transitions and interactions
- **Responsive Design**: Mobile-first approach, works on all devices
- **Dark Mode**: Eye-friendly dark theme optimized for extended use
- **Professional Components**: Custom badges, cards, modals, and forms

## 📁 Project Structure

```
convergeai_conference_chatbot_system/
├── frontend/                           # Frontend files (HTML/CSS/JS)
│   ├── index.html                     # Login/Registration page
│   ├── forgot-password.html           # Password recovery
│   ├── test-delete.html               # Testing utilities
│   ├── admin/                         # Admin panel pages
│   │   ├── dashboard.html             # Admin dashboard with stats
│   │   ├── create-chatbot.html        # Create new chatbot
│   │   ├── chatbot-list.html          # List all chatbots
│   │   ├── import-excel.html          # Bulk user import
│   │   ├── user-management.html       # User administration
│   │   ├── guest-management.html      # Guest/Speaker management
│   │   ├── profile.html               # Admin profile
│   │   └── settings.html              # System settings
│   ├── user/                          # User panel pages
│   │   ├── dashboard.html             # User dashboard
│   │   ├── chat.html                  # Chat interface
│   │   └── profile.html               # User profile
│   ├── css/                           # Stylesheets
│   │   ├── style.css                  # Main styles with glassmorphism
│   │   ├── admin.css                  # Admin dashboard styles
│   │   ├── user.css                   # User panel styles
│   │   └── chat.css                   # Chat interface styles
│   ├── js/                            # JavaScript modules
│   │   ├── main.js                    # Main application logic
│   │   ├── admin.js                   # Admin functionality
│   │   ├── forgot-password.js         # Password recovery
│   │   └── utils.js                   # Utility functions & API calls
│   └── assets/                        # Static assets
│       └── images/                    # Images and media files
├── backend/                           # Flask backend application
│   ├── app.py                         # Flask application factory
│   ├── config.py                      # Environment configuration
│   ├── models.py                      # SQLAlchemy database models
│   ├── requirements.txt               # Python dependencies
│   ├── migrations/                    # Flask-Migrate database migrations
│   ├── routes/                        # API route blueprints
│   │   ├── __init__.py
│   │   ├── auth.py                    # Authentication & registration
│   │   ├── admin.py                   # Admin endpoints
│   │   ├── user.py                    # User endpoints
│   │   └── chatbot.py                 # Chatbot management endpoints
│   └── uploads/                       # User-uploaded files
│       ├── backgrounds/               # Chatbot background images
│       ├── guests/                    # Guest profile photos
│       └── guest_lists/               # CSV import files
├── database/                          # Database utilities
│   └── init_db.py                     # Database initialization
├── dev-scripts/                       # Development utility scripts
│   ├── check_guests_schema.py         # Verify guest table schema
│   ├── create_test_guest.py           # Generate test guest data
│   ├── create_test_users.py           # Generate test users
│   ├── diagnose.py                    # System diagnostics
│   ├── list_admins.py                 # List admin users
│   └── temp_gemini_test.py            # Gemini API testing
├── testing_data/                      # Test data files
├── add_guests_active_column.py        # Migration: Add guests.active column
├── cleanup_keep_admin_only.py         # Database cleanup script
├── reset_admin.py                     # Reset admin credentials
├── seed_db.py                         # Seed initial database data
├── test_delete_conversation.py        # Test conversation deletion
├── requirements-dev.txt               # Development dependencies
├── docker-compose.yml                 # Docker Compose configuration
├── Dockerfile                         # Docker image definition
├── wsgi.py                            # WSGI entry point (production)
├── info_text.txt                      # Project notes
├── .env                               # Environment variables (not in repo)
└── README.md                          # This file
```

## 🚀 Getting Started

### Prerequisites

- **Python 3.8+** (Recommended: Python 3.11)
- **PostgreSQL 13+** (Database server)
- **Modern web browser** (Chrome 90+, Firefox 88+, Safari 14+)
- **Git** (for cloning repository)
- **pip** (Python package manager)

### Installation Steps

#### 1. Clone the Repository
```bash
git clone <repository-url>
cd convergeai_conference_chatbot_system
```

#### 2. Set Up Python Virtual Environment
```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows PowerShell:
.\venv\Scripts\Activate.ps1

# Windows CMD:
venv\Scripts\activate.bat

# Linux/Mac:
source venv/bin/activate
```

#### 3. Install Backend Dependencies
```bash
# Install production dependencies
pip install -r backend/requirements.txt

# Optional: Install development dependencies
pip install -r requirements-dev.txt
```

#### 4. Configure Environment Variables
Create a `.env` file in the project root:

```env
# Flask Configuration
FLASK_ENV=development
FLASK_DEBUG=True
SECRET_KEY=your-secret-key-change-in-production

# Database Configuration
DATABASE_URL=postgresql+psycopg2://username:password@localhost:5432/convergeai_db

# JWT Configuration
JWT_SECRET_KEY=your-jwt-secret-key

# File Upload Configuration
MAX_CONTENT_LENGTH=52428800
UPLOAD_FOLDER=uploads

# Email/SMTP Configuration (Optional)
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_DEFAULT_SENDER=your-email@gmail.com
MAIL_USE_TLS=true

# Google Gemini API (Set per chatbot via admin panel)
# GEMINI_API_KEY=your-gemini-api-key
```

#### 5. Set Up PostgreSQL Database
```bash
# Create database
psql -U postgres
CREATE DATABASE convergeai_db;
\q
```

#### 6. Initialize Database
```bash
# Run initialization script
cd database
python init_db.py
cd ..

# Or use Flask-Migrate
cd backend
set FLASK_APP=app:create_app
flask db init
flask db migrate -m "Initial migration"
flask db upgrade
cd ..
```

#### 7. (Optional) Seed Database with Test Data
```bash
python seed_db.py
```

This creates:
- Admin user: `admin` / `password`
- Test users and sample chatbots

#### 8. Start the Backend Server

```bash
cd backend
python app.py
```

The backend will start on `http://localhost:5000`

#### 9. Access the Frontend

**Option A: Direct File Access**
```bash
# Navigate to frontend directory
cd frontend

# Open index.html in your browser
start index.html   # Windows
open index.html    # Mac
xdg-open index.html # Linux
```

**Option B: Local HTTP Server (Recommended)**
```bash
cd frontend

# Python 3
python -m http.server 8000

# Or use any other static server
# npm i -g http-server && http-server -p 8000
```

Navigate to: `http://localhost:8000`

### 🐳 Docker Deployment (Alternative)

If you prefer Docker:

```bash
# Build and start containers
docker-compose up -d

# View logs
docker-compose logs -f

# Stop containers
docker-compose down
```

The application will be available at `http://localhost:5000`

## 🔐 Default Credentials

After running `seed_db.py`, use these credentials to log in:

| Role  | Username | Password | Access Level |
|-------|----------|----------|--------------|
| Admin | admin    | password | Full administrative access |
| User  | user     | password | Standard user access |

**⚠️ Important**: Change these credentials immediately in production!

## 📚 API Documentation

All API endpoints are prefixed with `/api`

### Authentication Endpoints (`/api/auth`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/login` | User login with username/password | No |
| POST | `/auth/register` | Register new user account | No |
| POST | `/auth/logout` | Logout and invalidate token | Yes |
| GET | `/auth/verify` | Verify authentication token | Yes |
| PUT | `/auth/change-password` | Change user password | Yes |
| POST | `/auth/forgot-password` | Request password reset | No |
| POST | `/auth/reset-password` | Reset password with token | No |

### Admin Endpoints (`/api/admin`)

| Method | Endpoint | Description | Admin Required |
|--------|----------|-------------|----------------|
| GET | `/admin/dashboard/stats` | Get dashboard statistics | Yes |
| GET | `/admin/users` | List all users | Yes |
| POST | `/admin/users` | Create new user | Yes |
| PUT | `/admin/users/<id>` | Update user details | Yes |
| DELETE | `/admin/users/<id>` | Delete user account | Yes |
| POST | `/admin/users/<id>/toggle-active` | Toggle user active status | Yes |
| POST | `/admin/import/excel` | Bulk import users from Excel | Yes |
| GET | `/admin/chatbots` | List all chatbots (with filters) | Yes |
| POST | `/admin/chatbots` | Create new chatbot | Yes |
| PUT | `/admin/chatbots/<id>` | Update chatbot configuration | Yes |
| DELETE | `/admin/chatbots/<id>` | Delete chatbot | Yes |
| POST | `/admin/chatbots/<id>/toggle-active` | Toggle chatbot active status | Yes |
| GET | `/admin/chatbots/<id>/guests` | List chatbot guests | Yes |
| POST | `/admin/chatbots/<id>/guests` | Add guest to chatbot | Yes |
| PUT | `/admin/guests/<id>` | Update guest details | Yes |
| DELETE | `/admin/guests/<id>` | Remove guest | Yes |
| POST | `/admin/guests/<id>/toggle-active` | Toggle guest active status | Yes |
| GET | `/admin/notifications` | Get admin notifications | Yes |
| POST | `/admin/notifications/<id>/read` | Mark notification as read | Yes |

### User Endpoints (`/api/user`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/user/profile` | Get user profile | Yes |
| PUT | `/user/profile` | Update user profile | Yes |
| GET | `/user/chatbots` | Get available chatbots for user | Yes |
| POST | `/user/chatbots/<id>/join` | Join a chatbot/event | Yes |
| GET | `/user/chatbots/<id>/messages` | Get conversation messages | Yes |
| POST | `/user/chatbots/<id>/messages` | Send message to chatbot | Yes |
| GET | `/user/conversations` | List user's conversations | Yes |
| GET | `/user/conversations/<id>` | Get specific conversation | Yes |
| DELETE | `/user/conversations/<id>` | Delete conversation | Yes |

### Chatbot Endpoints (`/api/chatbots`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/chatbots` | List all active chatbots | No/Yes |
| GET | `/chatbots/<id>` | Get chatbot details | Yes |
| GET | `/chatbots/<id>/stats` | Get chatbot statistics | Admin |
| GET | `/chatbots/<id>/guests` | Get chatbot guests | Yes |
| POST | `/chatbots/<id>/chat` | Send chat message (Gemini AI) | Yes |
| GET | `/chatbots/<id>/participants` | Get participant list | Admin |

### File Upload Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/uploads/<path>` | Serve uploaded files (images, etc.) | No |
| POST | `/admin/upload/background` | Upload chatbot background | Admin |
| POST | `/admin/upload/guest-photo` | Upload guest profile photo | Admin |
| POST | `/admin/upload/guest-list` | Upload guest list CSV | Admin |

### System Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/health` | Health check endpoint | No |

### Request/Response Examples

**Login Request:**
```json
POST /api/auth/login
{
  "username": "admin",
  "password": "password"
}
```

**Login Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "name": "Admin User",
    "role": "admin"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Create Chatbot Request:**
```json
POST /api/admin/chatbots
Authorization: Bearer <token>
Content-Type: multipart/form-data

{
  "name": "AI Summit 2024",
  "event_name": "International AI Conference",
  "description": "Annual AI summit featuring industry leaders",
  "start_date": "2024-06-01",
  "end_date": "2024-06-03",
  "system_prompt": "You are a helpful conference assistant...",
  "gemini_api_key": "AIza...",
  "background_image": <file>,
  "active": true
}
```

## 🎨 Design System

### Color Palette
- **Primary**: `#4f46e5` (Indigo)
- **Secondary**: `#9333ea` (Purple)
- **Accent**: `#06b6d4` (Cyan)
- **Dark BG**: `#0f1419`
- **Card BG**: `rgba(26, 31, 46, 0.7)` (with glassmorphism)

### Typography
- **Font**: Inter, Poppins, or system sans-serif
- **Headings**: 600-700 weight
- **Body**: 400-500 weight
- **Mono**: Fira Code for code snippets

### Components
- **Cards**: Glassmorphism effect with backdrop blur
- **Buttons**: Gradient fills with hover animations
- **Inputs**: Subtle focus states with border highlights
- **Badges**: Colored backgrounds for status indicators
- **Modals**: Centered with backdrop blur

## �️ Technology Stack

### Backend
- **Framework**: Flask 2.3.2
- **Database ORM**: SQLAlchemy 2.0.19
- **Database**: PostgreSQL 13+ (with psycopg2)
- **Authentication**: Flask-JWT-Extended 4.4.4, Werkzeug password hashing
- **Migrations**: Flask-Migrate 4.0.4 (Alembic)
- **API Security**: Flask-CORS 4.0.0
- **AI Integration**: Google Gemini API (via requests)
- **Excel Processing**: openpyxl 3.1.2
- **Production Server**: Gunicorn 21.2.0
- **Environment Management**: python-dotenv 1.0.0

### Frontend
- **Languages**: HTML5, CSS3, JavaScript (ES6+)
- **UI Framework**: Custom (No framework dependencies)
- **Design System**: Glassmorphism with gradient themes
- **HTTP Client**: Fetch API
- **Authentication**: Token-based (localStorage)
- **Icons**: Custom SVG icons
- **Fonts**: Inter, Poppins (fallback to system sans-serif)

### Development Tools
- **Testing**: pytest, pytest-flask, pytest-cov
- **Code Quality**: black, flake8, pylint, isort, mypy
- **API Documentation**: flask-restx (optional)
- **Debugging**: python-debugpy, ipython, flask-debugtoolbar
- **Containerization**: Docker, Docker Compose

### Infrastructure
- **Web Server**: Gunicorn (production) / Flask dev server (development)
- **Database**: PostgreSQL with connection pooling
- **File Storage**: Local filesystem (uploads/)
- **Session Management**: Server-side sessions with SQLAlchemy
- **CORS**: Configured for frontend-backend separation

## 🔧 Configuration Details

### Environment Variables Reference

```env
# ============================================
# Flask Configuration
# ============================================
FLASK_ENV=development                    # Options: development, production, testing
FLASK_DEBUG=True                         # Enable debug mode (dev only)
SECRET_KEY=your-secret-key-here          # Flask secret key (generate strong key)

# ============================================
# Database Configuration
# ============================================
DATABASE_URL=postgresql+psycopg2://user:pass@host:port/dbname
DB_POOL_SIZE=10                          # Connection pool size
DB_MAX_OVERFLOW=20                       # Max overflow connections
DB_POOL_TIMEOUT=30                       # Pool timeout in seconds

# ============================================
# JWT Authentication
# ============================================
JWT_SECRET_KEY=your-jwt-secret           # JWT signing key
JWT_ACCESS_TOKEN_EXPIRES=2592000         # Token expiry (seconds, default: 30 days)

# ============================================
# File Upload Configuration
# ============================================
MAX_CONTENT_LENGTH=52428800              # Max upload size in bytes (50MB)
UPLOAD_FOLDER=uploads                    # Upload directory path
ALLOWED_EXTENSIONS=xlsx,csv,png,jpg,jpeg,gif,pdf

# ============================================
# Email/SMTP Configuration
# ============================================
MAIL_SERVER=smtp.gmail.com               # SMTP server
MAIL_PORT=587                            # SMTP port (587 for TLS, 465 for SSL)
MAIL_USERNAME=your-email@gmail.com       # SMTP username
MAIL_PASSWORD=your-app-password          # SMTP password (use app password for Gmail)
MAIL_DEFAULT_SENDER=noreply@example.com  # Default sender email
MAIL_USE_TLS=true                        # Use TLS encryption
MAIL_USE_SSL=false                       # Use SSL encryption

# ============================================
# Google Gemini API
# ============================================
# Note: Gemini API keys are configured per-chatbot via admin panel
# You can set a default key here if needed
# GEMINI_API_KEY=your-gemini-api-key
```

### Configuration Presets

The system supports three configuration environments:

1. **Development** (`FLASK_ENV=development`)
   - Debug mode enabled
   - SQLAlchemy query logging
   - Detailed error pages
   - CORS allows all origins
   - Cookie security relaxed

2. **Production** (`FLASK_ENV=production`)
   - Debug mode disabled
   - Minimal logging
   - Generic error pages
   - CORS restricted
   - Secure cookies (HTTPS only)
   - Environment validation enforced

3. **Testing** (`FLASK_ENV=testing`)
   - Uses in-memory SQLite
   - Test fixtures enabled
   - No external API calls

### Database Connection Pool

The application uses SQLAlchemy connection pooling for optimal database performance:

- **pool_size**: 10 connections (configurable)
- **max_overflow**: 20 additional connections under load
- **pool_recycle**: 300 seconds (5 minutes)
- **pool_pre_ping**: True (validates connections before use)

### Flask-Migrate Commands

```bash
# Set Flask app
set FLASK_APP=backend.app:create_app    # Windows
export FLASK_APP=backend.app:create_app  # Linux/Mac

# Initialize migrations (first time only)
flask db init

# Generate migration from model changes
flask db migrate -m "Description of changes"

# Apply migrations to database
flask db upgrade

# Rollback last migration
flask db downgrade

# Show migration history
flask db history

# Show current revision
flask db current
```

## �️ Database Schema

The system uses PostgreSQL with SQLAlchemy ORM. Below is a detailed explanation of each table and its purpose:

### 1. **users** - User Accounts
Stores all user accounts including admins and regular users.

| Column | Type | Description |
|--------|------|-------------|
| id | Integer | Primary key |
| username | String(120) | Unique username for login |
| email | String(255) | Unique email address |
| password_hash | String(255) | Hashed password (Werkzeug) |
| name | String(255) | User's display name |
| role | String(50) | User role: 'admin', 'user', 'speaker' |
| active | Boolean | Account active status |
| created_at | DateTime | Account creation timestamp |
| last_login | DateTime | Last login timestamp |

**Purpose**: Central authentication and user management. Supports role-based access control.

### 2. **chatbots** - Conference Chatbot Definitions
Stores chatbot configurations for different events and conferences.

| Column | Type | Description |
|--------|------|-------------|
| id | Integer | Primary key |
| name | String(255) | Chatbot display name |
| event_name | String(255) | Associated event/conference name |
| description | Text | Detailed description |
| start_date | Date | Event start date |
| end_date | Date | Event end date (9999-12-31 for infinite) |
| system_prompt | Text | AI system prompt for chatbot behavior |
| single_person_prompt | Text | Prompt for single guest image generation |
| multiple_person_prompt | Text | Prompt for group image generation |
| gemini_api_key | String(255) | Google Gemini API key |
| background_image | String(255) | Path to background image |
| public | Boolean | Public visibility flag |
| active | Boolean | Active status (admin toggle) |
| created_by_id | Integer | FK to users.id (creator) |
| created_at | DateTime | Creation timestamp |

**Purpose**: Defines chatbot configuration, AI behavior, and event details. Supports image generation prompts for guest profiles.

### 3. **guests** - Event Speakers and Experts
Manages guest speakers, moderators, and experts associated with chatbots.

| Column | Type | Description |
|--------|------|-------------|
| id | Integer | Primary key |
| chatbot_id | Integer | FK to chatbots.id |
| user_id | Integer | Optional FK to users.id |
| name | String(255) | Guest's full name |
| photo | String(255) | Path to profile photo |
| active | Boolean | Active status on platform |
| created_at | DateTime | Creation timestamp |

**Purpose**: Links speakers and moderators to specific events. Can optionally link to user accounts.

### 4. **conversations** - User Chat Sessions
Tracks individual conversation threads between users and chatbots.

| Column | Type | Description |
|--------|------|-------------|
| id | Integer | Primary key |
| chatbot_id | Integer | FK to chatbots.id |
| user_id | Integer | FK to users.id |
| title | String(255) | Conversation title/subject |
| created_at | DateTime | Creation timestamp |
| updated_at | DateTime | Last update timestamp |

**Purpose**: Organizes chat messages into separate conversation threads. Allows users to have multiple concurrent conversations with the same chatbot.

### 5. **messages** - Chat Messages
Stores all chat messages between users and AI chatbots.

| Column | Type | Description |
|--------|------|-------------|
| id | Integer | Primary key |
| chatbot_id | Integer | FK to chatbots.id |
| user_id | Integer | FK to users.id |
| conversation_id | Integer | Optional FK to conversations.id |
| content | Text | Message content |
| is_user_message | Boolean | True if from user, False if from bot |
| created_at | DateTime | Message timestamp |

**Purpose**: Stores complete message history for all conversations. Enables chat persistence and history retrieval.

### 6. **chatbot_participants** - Event Participation Tracking
Tracks which users have joined which chatbots and their activity.

| Column | Type | Description |
|--------|------|-------------|
| id | Integer | Primary key |
| chatbot_id | Integer | FK to chatbots.id |
| user_id | Integer | FK to users.id |
| joined_at | DateTime | When user joined the chatbot |
| last_active | DateTime | Last interaction timestamp |
| message_count | Integer | Total messages sent |

**Purpose**: Analytics and tracking. Shows user engagement with events. Unique constraint on (chatbot_id, user_id).

### 7. **admin_notifications** - Admin Dashboard Notifications
Notification system for admin panel bell icon.

| Column | Type | Description |
|--------|------|-------------|
| id | Integer | Primary key |
| title | String(255) | Notification title |
| message | Text | Notification content |
| entity_type | String(50) | Type: 'system', 'user', 'chatbot', etc. |
| entity_id | Integer | Related entity ID |
| is_read | Boolean | Read status |
| created_at | DateTime | Creation timestamp |
| read_at | DateTime | When notification was read |

**Purpose**: Keeps admins informed about system events, new users, chatbot activity, etc.

### 8. **session_tokens** - API Authentication
Manages API session tokens for user authentication.

| Column | Type | Description |
|--------|------|-------------|
| id | Integer | Primary key |
| user_id | Integer | FK to users.id |
| token | String(255) | Secure session token |
| expires_at | DateTime | Token expiration time |
| created_at | DateTime | Creation timestamp |

**Purpose**: Secure API authentication. Tokens expire after 30 days by default. Alternative to JWT for stateful sessions.

### Database Relationships

```
┌─────────┐         ┌──────────┐         ┌──────────┐
│  users  │────┬───→│ chatbots │────┬───→│  guests  │
└─────────┘    │    └──────────┘    │    └──────────┘
    │          │         │           │
    │          │         │           │
    ↓          │         ↓           │
┌──────────────┐   ┌───────────────────┐
│session_tokens│   │chatbot_participants│
└──────────────┘   └───────────────────┘
    │                    │
    │         ┌───────────────┐
    └────────→│conversations  │
              └───────────────┘
                     │
                     ↓
              ┌──────────┐
              │ messages │
              └──────────┘
```

## 🚢 Production Deployment

### Prerequisites for Production
- Ubuntu 20.04+ or similar Linux distribution
- PostgreSQL 13+ (managed or self-hosted)
- Python 3.8+ with pip
- Nginx (for reverse proxy)
- SSL certificate (Let's Encrypt recommended)
- Domain name

### Deployment with Gunicorn

#### 1. Install and Configure
```bash
# Install Gunicorn
pip install gunicorn

# Create systemd service file
sudo nano /etc/systemd/system/convergeai.service
```

**Service configuration:**
```ini
[Unit]
Description=ConvergeAI Conference Chatbot System
After=network.target postgresql.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/convergeai
Environment="PATH=/var/www/convergeai/venv/bin"
Environment="FLASK_ENV=production"
ExecStart=/var/www/convergeai/venv/bin/gunicorn \
    --workers 4 \
    --bind unix:/var/www/convergeai/convergeai.sock \
    --timeout 120 \
    --access-logfile /var/log/convergeai/access.log \
    --error-logfile /var/log/convergeai/error.log \
    wsgi:app

[Install]
WantedBy=multi-user.target
```

#### 2. Start and Enable Service
```bash
# Create log directory
sudo mkdir /var/log/convergeai
sudo chown www-data:www-data /var/log/convergeai

# Start service
sudo systemctl start convergeai
sudo systemctl enable convergeai

# Check status
sudo systemctl status convergeai
```

#### 3. Configure Nginx
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Frontend files
    location / {
        root /var/www/convergeai/frontend;
        index index.html;
        try_files $uri $uri/ =404;
    }

    # API endpoints
    location /api {
        proxy_pass http://unix:/var/www/convergeai/convergeai.sock;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
    }

    # Uploaded files
    location /uploads {
        proxy_pass http://unix:/var/www/convergeai/convergeai.sock;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    client_max_body_size 50M;
}
```

### 🐳 Docker Deployment

The project includes Docker support for easy deployment.

#### Docker Files Structure
- `Dockerfile` - Backend container definition
- `docker-compose.yml` - Multi-container orchestration

#### Quick Start with Docker
```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down

# Rebuild after changes
docker-compose up -d --build
```

#### Docker Compose Services
- **backend**: Flask application with Gunicorn
- **db**: PostgreSQL database
- **nginx**: Reverse proxy (if configured)

#### Production Docker Commands
```bash
# Build production image
docker build -t convergeai:latest .

# Run with environment file
docker run -d \
  --name convergeai \
  --env-file .env.production \
  -p 5000:5000 \
  -v $(pwd)/uploads:/app/backend/uploads \
  convergeai:latest

# Check container logs
docker logs -f convergeai

# Execute database migrations
docker exec convergeai flask db upgrade
```

### Environment-Specific Deployment

#### Development
```bash
cd backend
python app.py
```

#### Staging
```bash
cd backend
gunicorn -w 2 -b 0.0.0.0:5000 --reload wsgi:app
```

#### Production
```bash
gunicorn -w 4 \
  -b unix:/var/www/convergeai/convergeai.sock \
  --timeout 120 \
  --max-requests 1000 \
  --max-requests-jitter 50 \
  wsgi:app
```

### Performance Tuning

#### Gunicorn Workers
```bash
# Calculate optimal workers: (2 x CPU cores) + 1
# For 4 CPU cores: (2 x 4) + 1 = 9 workers
gunicorn -w 9 -b 0.0.0.0:5000 wsgi:app
```

#### Database Optimization
- Enable connection pooling (default: 10 connections)
- Add database indexes on frequently queried columns
- Enable PostgreSQL query caching
- Use read replicas for analytics queries

#### Caching Strategy
Consider adding Redis for:
- Session storage
- API response caching
- Celery task queue (for async operations)

### Monitoring and Logging

#### Application Logs
```bash
# View Gunicorn logs
tail -f /var/log/convergeai/access.log
tail -f /var/log/convergeai/error.log

# View systemd logs
journalctl -u convergeai -f
```

#### Database Monitoring
```bash
# Connect to PostgreSQL
psql -U username -d convergeai_db

# Check active connections
SELECT * FROM pg_stat_activity;

# Check database size
SELECT pg_size_pretty(pg_database_size('convergeai_db'));
```

### Backup Strategy

#### Database Backup
```bash
# Create backup
pg_dump -U username convergeai_db > backup_$(date +%Y%m%d).sql

# Automated daily backup (crontab)
0 2 * * * pg_dump -U username convergeai_db > /backups/db_$(date +\%Y\%m\%d).sql
```

#### File Uploads Backup
```bash
# Backup uploads directory
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz backend/uploads/

# Sync to remote storage
rsync -avz backend/uploads/ user@backup-server:/backups/uploads/
```

## 🎨 Design System & UI Guidelines

### Color Palette

#### Primary Colors
```css
--primary-indigo: #4f46e5      /* Primary actions, buttons */
--primary-purple: #9333ea      /* Accents, highlights */
--primary-cyan: #06b6d4        /* Links, info elements */
```

#### Dark Theme Colors
```css
--dark-bg-main: #0f1419        /* Main background */
--dark-bg-secondary: #1a1f2e   /* Card backgrounds */
--dark-bg-tertiary: #252b3b    /* Elevated surfaces */
--dark-text-primary: #e5e7eb   /* Main text */
--dark-text-secondary: #9ca3af /* Secondary text */
--dark-border: #374151         /* Borders and dividers */
```

#### Status Colors
```css
--success-green: #10b981       /* Success states */
--warning-yellow: #f59e0b      /* Warning states */
--error-red: #ef4444           /* Error states */
--info-blue: #3b82f6           /* Informational */
```

#### Glassmorphism
```css
.glass-card {
  background: rgba(26, 31, 46, 0.7);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}
```

### Typography

#### Font Stack
```css
font-family: 'Inter', 'Poppins', -apple-system, BlinkMacSystemFont, 
             'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
```

#### Font Weights & Type Scale
- **Headings**: 600-700 weight
- **Body**: 400-500 weight
- **Labels**: 500-600 weight
- **Sizes**: 12px (small) → 16px (base) → 20px (large) → 30px (hero)

### UI Components
- **Cards**: Glassmorphism effect with backdrop blur
- **Buttons**: Gradient fills with hover animations
- **Inputs**: Subtle focus states with border highlights
- **Badges**: Colored backgrounds for status indicators
- **Modals**: Centered with backdrop blur and smooth transitions

## 🛠️ Technology Stack

### Backend
- **Framework**: Flask 2.3.2
- **Database ORM**: SQLAlchemy 2.0.19
- **Database**: PostgreSQL 13+ with psycopg2-binary
- **Authentication**: Flask-JWT-Extended 4.4.4 + Werkzeug password hashing
- **Migrations**: Flask-Migrate 4.0.4 (Alembic)
- **API Security**: Flask-CORS 4.0.0
- **AI Integration**: Google Gemini API via requests
- **Excel Processing**: openpyxl 3.1.2
- **Production Server**: Gunicorn 21.2.0
- **Environment**: python-dotenv 1.0.0

### Frontend
- **Languages**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **UI Design**: Custom Glassmorphism with gradient themes
- **HTTP Client**: Fetch API
- **Authentication**: JWT token-based (localStorage)
- **No framework dependencies** - lightweight and fast

### Development Tools
- pytest, pytest-flask (testing)
- black, flake8, pylint (code quality)
- mypy (type checking)
- Docker, Docker Compose (containerization)

## 🔒 Security Features & Best Practices

### Authentication & Authorization
✅ **Password Hashing**: Werkzeug PBKDF2-SHA256  
✅ **JWT Token Authentication**: 30-day expiration  
✅ **Session Management**: Server-side tokens  
✅ **Role-Based Access Control**: Admin vs User  
✅ **Account Security**: Failed login protection ready  

### API Security
✅ **CORS Protection**: Configured allowed origins  
✅ **SQL Injection Prevention**: SQLAlchemy parameterized queries  
✅ **XSS Protection**: Input sanitization  
✅ **CSRF Ready**: Token-based protection (implement for state changes)  
✅ **Input Validation**: Server-side validation  

### Data Protection
✅ **HTTPS Enforcement**: SSL/TLS in production  
✅ **Secure Cookies**: HTTPOnly, Secure, SameSite flags  
✅ **Environment Variables**: Secrets in .env  
✅ **File Upload Validation**: Type and size restrictions  
✅ **Path Traversal Prevention**: Safe file handling  

### Security Checklist
- [ ] Change default credentials (admin/password)
- [ ] Generate strong SECRET_KEY and JWT_SECRET_KEY
- [ ] Enable HTTPS in production (Let's Encrypt)
- [ ] Restrict CORS to specific origins
- [ ] Implement rate limiting
- [ ] Enable database backups
- [ ] Monitor logs for suspicious activity
- [ ] Keep dependencies updated
- [ ] Use prepared statements for raw SQL
- [ ] Validate all user inputs

### Recommended Security Headers
```nginx
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
Content-Security-Policy: default-src 'self'
```

## 🐛 Troubleshooting

### Common Issues

**Database Connection Errors**
```
psycopg2.OperationalError: could not connect to server
```
- Verify PostgreSQL is running: `sudo systemctl status postgresql`
- Check `DATABASE_URL` in `.env`
- Ensure database exists: `psql -U postgres -l`

**Import Errors**
```
ImportError: No module named 'flask_sqlalchemy'
```
- Activate virtual environment
- Install dependencies: `pip install -r backend/requirements.txt`

**CORS Errors**
```
Access blocked by CORS policy
```
- Check Flask-CORS configuration in `app.py`
- Verify frontend URL matches allowed origins
- Clear browser cache

**File Upload Failures (413)**
- Increase `MAX_CONTENT_LENGTH` in config
- Update Nginx `client_max_body_size`

**Gemini API Errors (403)**
- Verify API key is valid
- Check API quota and billing
- Ensure Gemini API enabled in Google Cloud

### Debug Mode
```env
FLASK_ENV=development
FLASK_DEBUG=True
SQLALCHEMY_ECHO=True  # Log all SQL queries
```

## 📱 Browser Support
- **Chrome/Edge**: 90+
- **Firefox**: 88+
- **Safari**: 14+
- **Mobile**: iOS Safari 14+, Chrome Mobile 90+
- **Features**: ES6+, CSS Grid, Flexbox, Fetch API, WebSockets ready

## 🚀 Performance Optimization
- ⚡ Lazy loading for images
- ⚡ Efficient database queries with SQLAlchemy ORM
- ⚡ CSS animations using GPU acceleration (`transform`, `opacity`)
- ⚡ Database connection pooling (10-30 connections)
- ⚡ Minified assets in production
- ⚡ CDN-ready for static files
- ⚡ Responsive images with proper sizing

## 🤝 Contributing

We welcome contributions! Here's how to get started:

### Development Workflow
1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** and test thoroughly
4. **Follow code style**:
   - Python: PEP 8 (use `black` formatter)
   - JavaScript: ESLint standards
   - Write clear commit messages
5. **Run tests**: `pytest backend/tests/`
6. **Submit a Pull Request**

### Code Quality Standards
```bash
# Format Python code
black backend/

# Lint Python code
flake8 backend/
pylint backend/

# Sort imports
isort backend/

# Type checking
mypy backend/
```

### Areas for Contribution
- 🐛 Bug fixes and issue resolution
- ✨ New features (discuss in issues first)
- 📝 Documentation improvements
- 🧪 Test coverage expansion
- 🎨 UI/UX enhancements
- 🌐 Internationalization (i18n)
- ♿ Accessibility improvements

## 📝 License

**MIT License**

Copyright (c) 2026 ConvergeAI Conference Chatbot System

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## 🆘 Support & Contact

### Getting Help
- 📖 **Documentation**: Read this README thoroughly
- 🐛 **Bug Reports**: Open an issue on GitHub
- 💡 **Feature Requests**: Discuss in GitHub Issues
- 💬 **Questions**: Check existing issues or create a new one

### Resources
- **Live Demo**: (Add your demo URL)
- **Documentation**: (Add docs URL if available)
- **API Reference**: See API Documentation section above
- **Community**: (Add Discord/Slack if available)

## 🙏 Acknowledgments

- **Flask**: Micro web framework
- **PostgreSQL**: Robust database system
- **Google Gemini**: AI conversation engine
- **SQLAlchemy**: Python SQL toolkit
- **Inter & Poppins**: Beautiful typography
- **Contributors**: Thank you to all contributors!

---

## 📊 Project Statistics

- **Backend**: Python Flask with 8 database models
- **Frontend**: 15+ HTML pages with custom CSS/JS
- **API Endpoints**: 40+ RESTful endpoints
- **Database Tables**: 8 tables with full relationships
- **Features**: Role-based auth, AI chat, file uploads, bulk import
- **Deployment**: Docker-ready, production-tested with Gunicorn

---

<div align="center">

**Built with ❤️ using Flask, PostgreSQL, and Google Gemini AI**

⭐ **Star this repo if you find it useful!** ⭐

[Report Bug](../../issues) · [Request Feature](../../issues) · [Documentation](#)

</div>
