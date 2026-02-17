# Project Architecture & Structure

Comprehensive guide to the Conference Chatbot Management System architecture and file organization.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client/Browser                       │
│  (HTML5, CSS3, Vanilla JavaScript - No Frameworks)         │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/JSON
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                   Flask REST API                            │
│  (Python, SQLAlchemy, Blueprint-based routes)              │
│  Authentication | Admin | User | Chatbot Endpoints        │
└──────────────────────┬──────────────────────────────────────┘
                       │ SQL Queries
                       ↓
┌─────────────────────────────────────────────────────────────┐
│               SQLAlchemy ORM Layer                          │
│  (Abstraction over database queries)                       │
└──────────────────────┬──────────────────────────────────────┘
                       │ Database Queries
                       ↓
┌─────────────────────────────────────────────────────────────┐
│            SQLite/MySQL/PostgreSQL                         │
│  (Data persistence layer)                                 │
└─────────────────────────────────────────────────────────────┘
```

## Directory Organization

### 📁 Root Level

```
convergeai_conference_chatbot_system/
├── .env                          # Environment configuration (git ignored)
├── .env.example                  # Environment template
├── .gitignore                    # Git ignore rules
├── README.md                     # Main documentation
├── QUICKSTART.md                 # Quick start guide
├── API.md                        # Complete API documentation
├── ARCHITECTURE.md               # This file
├── Dockerfile                    # Docker containerization
├── docker-compose.yml            # Multi-container orchestration
├── wsgi.py                       # Production WSGI entry point
├── requirements-dev.txt          # Development dependencies
│
├── frontend/                     # Frontend web application
├── backend/                      # Flask backend server
└── database/                     # Database utilities
```

---

## 📱 Frontend Structure

```
frontend/
├── index.html                    # Main login page
├── css/
│   ├── style.css                # Global styles (716 lines)
│   │   ├── CSS variables (design system)
│   │   ├── Typography hierarchy
│   │   ├── Component library (buttons, forms, cards)
│   │   ├── Layout utilities (grid, flex)
│   │   ├── Animation keyframes
│   │   └── Responsive breakpoints
│   ├── admin.css                # Admin panel styles (596 lines)
│   │   ├── Admin layout grid
│   │   ├── Sidebar navigation
│   │   ├── Dashboard components
│   │   ├── Forms and tables
│   │   └── Responsive adjustments
│   ├── user.css                 # User panel styles (715 lines)
│   │   ├── Login page layout
│   │   ├── User dashboard
│   │   ├── Chatbot cards
│   │   ├── Profile sections
│   │   └── Responsive rules
│   └── chat.css                 # Chat interface (420 lines)
│       ├── Chat container
│       ├── Message bubbles
│       ├── Typing indicators
│       ├── Input area
│       └── Empty states
│
├── js/
│   ├── utils.js                 # Utilities library (560 lines)
│   │   ├── NotificationManager  # Toast notifications
│   │   ├── ModalManager         # Modal dialogs
│   │   ├── FormValidator        # Form validation
│   │   ├── DateUtils            # Date handling
│   │   ├── API wrapper          # HTTP requests
│   │   ├── Storage wrapper      # LocalStorage
│   │   ├── Debounce/Throttle   # Performance
│   │   ├── DOM helpers          # DOM manipulation
│   │   ├── Animate helpers      # Animations
│   │   └── ThemeManager         # Dark mode
│   ├── main.js                  # User panel logic
│   │   ├── Dashboard page
│   │   ├── Chat interface
│   │   ├── Profile management
│   │   └── Event listeners
│   ├── admin.js                 # Admin panel logic
│   │   ├── Sidebar navigation
│   │   ├── Form handlers
│   │   ├── Table management
│   │   └── Modal interactions
│   └── chat.js                  # Chat specific logic (future)
│
├── admin/                        # Admin panel pages
│   ├── dashboard.html           # Admin dashboard overview
│   ├── create-chatbot.html      # Chatbot creation form
│   ├── chatbot-list.html        # Chatbot management list
│   ├── edit-chatbot.html        # Chatbot editing (pending)
│   ├── chatbot-settings.html    # Chatbot settings (pending)
│   ├── guest-management.html    # Guest/speaker management (pending)
│   ├── import-excel.html        # Excel user import
│   └── user-management.html     # User administration
│
├── user/                         # User panel pages
│   ├── dashboard.html           # User dashboard
│   ├── chat.html                # Chat interface
│   └── profile.html             # User profile & settings
│
└── assets/                       # Images, icons, media (future)
    ├── images/
    ├── icons/
    └── fonts/
```

### Frontend Technologies

**HTML5 Features:**
- Semantic markup (header, nav, main, footer, section, article)
- Form elements with validation attributes
- Data attributes for JavaScript hooks
- Accessibility attributes (aria-*, role, label)

**CSS3 System:**
- CSS Custom Properties (variables) for theming
- Glassmorphism effects (backdrop-filter, rgba)
- CSS Gradients (linear, radial)
- Flexbox for layout
- CSS Grid for card layouts
- Keyframe animations
- Mobile-first responsive design

**Vanilla JavaScript:**
- ES6+ syntax (arrow functions, destructuring, template literals)
- Module-like pattern with IIFE scopes
- Event delegation for dynamic elements
- Async/await for API calls
- LocalStorage for persistence
- No build step or transpilation required

---

## 🔧 Backend Structure

```
backend/
├── app.py                       # Flask application factory
│   ├── create_app(config_name)
│   ├── Database initialization
│   ├── Blueprint registration
│   ├── CORS configuration
│   └── Error handlers
│
├── config.py                    # Configuration management
│   ├── BaseConfig
│   ├── DevelopmentConfig
│   ├── ProductionConfig
│   ├── TestingConfig
│   └── Environment variables
│
├── models.py                    # SQLAlchemy ORM models (420 lines)
│   ├── User model               # Authentication & profiles
│   │   ├── username, email, password_hash
│   │   ├── name, role, active status
│   │   ├── created_at, updated_at
│   │   └── Relationships: chatbots, messages, guests
│   │
│   ├── Chatbot model            # Event management
│   │   ├── name, event_name, description
│   │   ├── start_date, end_date
│   │   ├── system_prompt (AI configuration)
│   │   ├── single_mode, multiple_mode flags
│   │   ├── Status property (calculated)
│   │   └── Relationships: messages, participants, guests
│   │
│   ├── Guest model              # Speakers/Experts
│   │   ├── name, title, description
│   │   ├── photo, is_speaker, is_moderator
│   │   └── Relationships: chatbot, user (optional)
│   │
│   ├── Message model            # Chat history
│   │   ├── content, is_user_message flag
│   │   ├── created_at (indexed for queries)
│   │   └── Relationships: chatbot, user
│   │
│   ├── ChatbotParticipant model # Enrollment tracking
│   │   ├── Unique constraint: chatbot_id + user_id
│   │   ├── joined_at, message_count
│   │   └── last_activity_at
│   │
│   └── SessionToken model       # API authentication
│       ├── token (unique, urlsafe)
│       ├── expires_at
│       ├── Methods: generate_token(), verify_token()
│       └── Automatic cleanup of expired tokens
│
├── routes/                      # API endpoints (organized by feature)
│   ├── __init__.py              # Package initialization
│   │
│   ├── auth.py                  # Authentication (310 lines)
│   │   ├── Decorators:
│   │   │   ├── @token_required  # Verify token
│   │   │   └── @admin_required  # Check admin role
│   │   │
│   │   └── Endpoints:
│   │       ├── POST /login      # User login
│   │       ├── POST /register   # User signup
│   │       ├── POST /logout     # Invalidate token
│   │       ├── GET /verify      # Token validation
│   │       ├── PUT /change-password
│   │       └── POST /users/{id}/reset-password (admin)
│   │
│   ├── admin.py                 # Admin management (320 lines)
│   │   ├── Dashboard:
│   │   │   └── GET /dashboard/stats
│   │   │
│   │   ├── User Management:
│   │   │   ├── GET /users (paginated)
│   │   │   ├── GET /users/{id}
│   │   │   ├── PUT /users/{id}
│   │   │   └── DELETE /users/{id}
│   │   │
│   │   ├── Chatbot Management:
│   │   │   ├── GET /chatbots
│   │   │   ├── GET /chatbots/{id}
│   │   │   └── DELETE /chatbots/{id}
│   │   │
│   │   ├── Guest Management:
│   │   │   ├── GET /chatbots/{id}/guests
│   │   │   └── POST /chatbots/{id}/guests
│   │   │
│   │   └── Data Import:
│   │       └── POST /import/excel
│   │
│   ├── user.py                  # User endpoints (310 lines)
│   │   ├── Dashboard:
│   │   │   ├── GET /chatbots (available)
│   │   │   └── GET /my-chatbots (joined)
│   │   │
│   │   ├── Profile:
│   │   │   ├── GET /profile
│   │   │   └── PUT /profile
│   │   │
│   │   ├── Chat:
│   │   │   ├── GET /chatbots/{id}/messages
│   │   │   └── POST /chatbots/{id}/messages
│   │   │
│   │   └── Actions:
│   │       └── POST /chatbots/{id}/join
│   │
│   └── chatbot.py               # Chatbot operations (290 lines)
│       ├── CRUD:
│       │   ├── POST / (create)
│       │   ├── GET /{id} (read)
│       │   ├── PUT /{id} (update)
│       │   └── DELETE /{id} (delete)
│       │
│       ├── Configuration:
│       │   └── GET /{id}/settings
│       │
│       └── Analytics:
│           └── GET /{id}/stats
│
└── requirements.txt             # Python dependencies
    └── Flask, SQLAlchemy, CORS, Migrate, etc.
```

### Backend Technologies

**Flask Framework:**
- Application factory pattern
- Blueprint-based modular routing
- Request/response handling
- Error handlers (404, 500)
- CORS middleware

**SQLAlchemy ORM:**
- Declarative model definition
- Relationship management
- Query building
- Cascading deletes
- Session management

**Authentication:**
- Werkzeug password hashing (bcrypt)
- Custom SessionToken model
- Bearer token in Authorization header
- Decorator-based permission checking

**Database Support:**
- SQLite (development default)
- MySQL (production compatible)
- PostgreSQL (production compatible)
- Connection string via DATABASE_URL environment variable

---

## 🗄️ Database Structure

### Entity Relationship Diagram

```
┌────────────────────┐
│       User         │
├────────────────────┤
│ id (PK)            │
│ username (UNIQUE)  │
│ email (UNIQUE)     │
│ password_hash      │
│ role               │◄──┐
│ active             │   │
│ created_at         │   │
└────────────────────┘   │
         │              1:N
    1:N  │               │
         └─────────────────┤
                          │
         ┌─────────────────┴────────────────────────┐
         │                                          │
┌─────────────────────┐          ┌─────────────────────────┐
│    Chatbot          │          │ ChatbotParticipant      │
├─────────────────────┤          ├─────────────────────────┤
│ id (PK)             │◄────1:N──│ id (PK)                 │
│ name                │   │      │ chatbot_id (FK)         │
│ event_name          │   │      │ user_id (FK)            │
│ created_by_id (FK)  │   │      │ joined_at               │
│ start_date          │   │      │ message_count           │
│ end_date            │   │      │ last_activity_at        │
│ system_prompt       │   │      └─────────────────────────┘
│ status              │   │
│ public              │   │
│ active              │   │
├─────────────────────┤   │
│ participants ◄──────┼───┘
│ messages            │
│ guests              │
└─────────────────────┘
         │
    1:N  │
         ├────────────────────┐
         │                    │
    ┌────────────────┐   ┌─────────────────┐
    │   Message      │   │    Guest        │
    ├────────────────┤   ├─────────────────┤
    │ id (PK)        │   │ id (PK)         │
    │ content        │   │ name            │
    │ is_user_msg    │   │ title           │
    │ created_at     │   │ description     │
    │ chatbot_id (FK)│   │ photo           │
    │ user_id (FK)   │   │ is_speaker      │
    └────────────────┘   │ is_moderator    │
                         │ chatbot_id (FK) │
                         └─────────────────┘
                         
┌──────────────────────┐
│   SessionToken       │
├──────────────────────┤
│ id (PK)              │
│ token (UNIQUE)       │
│ user_id (FK)         │
│ expires_at           │
└──────────────────────┘
```

### Table Relationships

| Table | Foreign Keys | Relationships |
|-------|--------------|---------------|
| User | - | 1:N with Chatbot, 1:N with Message, 1:N with SessionToken |
| Chatbot | created_by_id (User) | 1:N with Message, 1:N with ChatbotParticipant, 1:N with Guest |
| Message | chatbot_id, user_id | N:1 with Chatbot, N:1 with User |
| ChatbotParticipant | chatbot_id, user_id | N:1 with Chatbot, N:1 with User |
| Guest | chatbot_id, user_id | N:1 with Chatbot, N:1 with User (optional) |
| SessionToken | user_id | N:1 with User |

---

## 📦 Data Flow Diagrams

### Login Flow

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ POST /auth/login {username, password}
       ▼
┌──────────────────────┐
│  Flask Auth Route    │
│  auth.py: login()    │
└──────┬───────────────┘
       │ Query User, verify password
       ▼
┌──────────────────────┐
│  SQLAlchemy ORM      │
│  User.query.filter() │
└──────┬───────────────┘
       │ SQL Query
       ▼
┌──────────────────────┐
│  SQLite Database     │
│  SELECT * FROM user  │
│  WHERE username=?    │
└──────┬───────────────┘
       │ User data
       ▼
┌──────────────────────┐
│ Password verification│
│ Werkzeug.security    │
└──────┬───────────────┘
       │ Create SessionToken
       ▼
┌──────────────────────┐
│ SessionToken.generate│
└──────┬───────────────┘
       │ Store token + return
       ▼
┌──────────────────────┐
│ JSON Response        │
│ {token, user_data}   │
└──────┬───────────────┘
       │ Store token in localStorage
       ▼
┌─────────────┐
│  Browser    │
│  (Logged in)│
└─────────────┘
```

### Chat Message Flow

```
┌─────────────────────┐
│   User Types Msg    │
│   in Chat Input     │
└──────┬──────────────┘
       │ Trigger: Enter key or Send button
       ▼
┌──────────────────────┐
│ JavaScript Event     │
│ main.js: sendMsg()   │
└──────┬───────────────┘
       │ POST /user/chatbots/{id}/messages {content}
       │ Header: Authorization: Bearer {token}
       ▼
┌──────────────────────────────┐
│  Flask User Route            │
│  user.py: send_message()     │
│  @token_required decorator   │
└──────┬───────────────────────┘
       │ Extract user from token
       │ Validate chatbot participation
       ▼
┌──────────────────────┐
│ Create Message ORM   │
│ Message(user_msg)    │
└──────┬───────────────┘
       │ Save to DB
       ▼
┌──────────────────────┐
│ Generate Bot Response│
│ (or call AI service) │
└──────┬───────────────┘
       │ Create Message ORM
       │ Message(bot_response)
       ▼
┌──────────────────────┐
│ Return JSON Response │
│ {user_msg, bot_msg}  │
└──────┬───────────────┘
       │ Display in chat UI
       │ Update messages array
       ▼
┌──────────────────────┐
│  Chat UI Updated     │
│  with both messages  │
└──────────────────────┘
```

---

## 🔄 Request/Response Cycle

### Authenticated Request Example

```
Client                           Server
  │                              │
  ├─ Store token from login     │
  │ (via localStorage)           │
  │                              │
  ├─ Make authenticated request ─┤
  │  GET /api/user/profile       │
  │  Headers: {                  │
  │    Authorization: Bearer...  │
  │  }                           │
  │                              │
  │                    ┌─────────┤
  │                    │ Middleware: @token_required
  │                    │ - Extract token from header
  │                    │ - Query SessionToken table
  │                    │ - Check expiration
  │                    │ - Get associated User
  │                    │ - Add user to request context
  │                    └─────────┤
  │                              │
  │                    ┌─────────┤
  │                    │ Route Handler
  │                    │ - User is now available
  │                    │ - Query user data
  │                    │ - Format response
  │                    └─────────┤
  │                              │
  │◄─ Return JSON response ──────┤
  │  Status: 200 OK              │
  │  Body: {                     │
  │    success: true,            │
  │    data: {...}               │
  │  }                           │
  │                              │
  ├─ Parse response             │
  │ ├─ Check success flag        │
  │ ├─ If error: show toast      │
  │ └─ If success: update UI     │
  │                              │
```

---

## 🔐 Security Architecture

### Password Handling

```
User Input (Plain Text)
         ▼
    ┌─────────────────────────┐
    │  Werkzeug bcrypt hash   │
    │  (10 salt rounds)       │
    └────────────┬────────────┘
                 ▼
      Database Storage
    (Hashed + Salted)
    
During Login:
User Input ── Hash ── Compare ── DB Stored Hash
                 (Match?)      ─ Grant Access
                    └─ Deny
```

### Token-Based Authentication

```
Login Success
     ▼
Generate Token: secrets.token_urlsafe(32)
     ▼
Create SessionToken record:
  {
    token: "...",
    user_id: 1,
    expires_at: now + 30 days
  }
     ▼
Return to Client
(stored in browser localStorage)
     ▼
Subsequent Requests:
Header: Authorization: Bearer {token}
     ▼
@token_required decorator:
1. Extract token from header
2. Query SessionToken table
3. Check expiration
4. Verify user still active
5. Attach user to request
```

---

## 🚀 Deployment Architecture

### Development Setup
```
Frontend Server       Backend Server       Database
http://localhost:8000 http://localhost:5000 SQLite
                                           chat_system.db
```

### Production Setup (Docker)
```
┌──────────────────────────────────────┐
│      Internet (HTTPS)                │
└────────────────┬─────────────────────┘
                 │
    ┌────────────▼──────────────┐
    │  Nginx Reverse Proxy      │
    │  (Load Balancing, SSL)    │
    │  :80, :443                │
    └─┬──────────────┬──────────┘
      │              │
      ▼              ▼
┌──────────┐  ┌──────────┐
│Frontend  │  │ Backend  │
│Container │  │Container │
│(Port 80) │  │(Port 5000)
└──────────┘  └──┬───────┘
                 │
                 ▼
          ┌────────────┐
          │ PostgreSQL │
          │ Container  │
          │ (Port 5432)│
          └────────────┘
```

---

## 📊 Configuration Management

### Environment-Specific Configs

```
.env (Local Development)
├── FLASK_ENV=development
├── DATABASE_URL=sqlite:///./chat_system.db
└── FLASK_DEBUG=True

.env.production
├── FLASK_ENV=production
├── DATABASE_URL=postgresql://...
└── FORCE_HTTPS=True
```

### Django-Style Config Classes

```
config.py:
  ├── BaseConfig
  │   ├── SECRET_KEY
  │   ├── DATABASE_URL
  │   └── JWT settings
  ├── DevelopmentConfig(BaseConfig)
  │   ├── DEBUG=True
  │   └── SESSION_COOKIE_SECURE=False
  ├── ProductionConfig(BaseConfig)
  │   ├── DEBUG=False
  │   └── SESSION_COOKIE_SECURE=True
  └── TestingConfig(BaseConfig)
      ├── TESTING=True
      └── DATABASE_URL=sqlite:///:memory:
```

---

## 🔌 Extension Points

### Adding New Features

#### 1. New Database Model
```
models.py:
  ├── Create class inheriting from db.Model
  ├── Define columns and relationships
  ├── Add validation methods
  └── Add to init_db.py if needed

Then:
  └── Update database schema
```

#### 2. New API Endpoint
```
routes/feature.py:
  ├── Create blueprint
  ├── Add @token_required/@admin_required as needed
  ├── Implement route handlers
  └── Query models and return JSON

Then:
  └── Register blueprint in app.py
```

#### 3. New Frontend Page
```
frontend/page.html:
  ├── Create HTML template
  ├── Add CSS classes from style.css
  └── Link to JavaScript file

frontend/js/page.js:
  ├── Initialize event listeners
  ├── Load data via API wrapper
  ├── Update DOM
  └── Handle user interactions
```

---

## 📈 Performance Considerations

### Frontend Optimization
- Vanilla JS: No framework overhead
- CSS: Single parse for all rules
- Lazy loading: Images loaded on-demand
- Event delegation: Reduced listeners
- LocalStorage caching: Reduced API calls

### Backend Optimization
- Database indexes on frequently queried fields
- Query pagination for large datasets
- Connection pooling via SQLAlchemy
- Blueprint lazy loading
- CORS caching headers

### Database Optimization
- Foreign key constraints
- Cascade deletes prevent orphans
- Composite indexes on join columns
- Timestamp indexes for range queries

---

## 🧪 Testing Strategy (Future Implementation)

```
tests/
├── unit/
│   ├── test_models.py         # Model validation
│   ├── test_validators.py     # Input validation
│   └── test_utils.py          # Utility functions
├── integration/
│   ├── test_auth_flow.py      # Login/logout
│   ├── test_admin_endpoints.py # Admin API
│   ├── test_user_endpoints.py # User API
│   └── test_chat_flow.py      # Message handling
└── e2e/
    ├── test_user_journey.py   # Full user flow
    └── test_admin_journey.py  # Full admin flow
```

---

This architecture is designed for:
- ✅ Scalability (stateless backend)
- ✅ Maintainability (modular code)
- ✅ Security (hardened auth)
- ✅ Performance (optimized queries)
- ✅ Extensibility (clear structure)
