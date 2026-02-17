# API Documentation

Complete API reference for the Conference Chatbot Management System.

## Base URL

Development: `http://localhost:5000/api`
Production: `https://your-domain.com/api`

## Authentication

All authenticated endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer {token}
```

Obtain a token using the login endpoint.

## Response Format

All API responses follow this format:

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    "key": "value"
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "data": null
}
```

## Status Codes

- `200 OK` - Successful request
- `201 Created` - Resource created
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User doesn't have permission
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

---

## Authentication Endpoints

### POST /auth/login
User login and token generation.

**Request:**
```json
{
  "username": "admin",
  "password": "password"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
    "user": {
      "id": 1,
      "username": "admin",
      "email": "admin@example.com",
      "name": "Administrator",
      "role": "admin",
      "created_at": "2024-01-01T00:00:00"
    }
  }
}
```

**cURL:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'
```

---

### POST /auth/register
User registration (public endpoint).

**Request:**
```json
{
  "username": "newuser",
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe"
}
```

**Response:** Same as login endpoint

**cURL:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username":"newuser",
    "email":"user@example.com",
    "password":"securepassword",
    "name":"John Doe"
  }'
```

---

### POST /auth/logout
User logout (invalidate token).

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**cURL:**
```bash
curl -X POST http://localhost:5000/api/auth/logout \
  -H "Authorization: Bearer {token}"
```

---

### GET /auth/verify
Verify current session token.

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Token is valid",
  "data": {
    "user_id": 1,
    "username": "admin",
    "expires_at": "2024-02-01T00:00:00"
  }
}
```

---

### PUT /auth/change-password
Change user password.

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request:**
```json
{
  "current_password": "oldpassword",
  "new_password": "newpassword",
  "confirm_password": "newpassword"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

## Admin Endpoints

All admin endpoints require admin role (`@admin_required` decorator).

### GET /admin/dashboard/stats
Get dashboard statistics.

**Headers:**
```
Authorization: Bearer {admin_token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total_chatbots": 12,
    "active_events": 3,
    "total_users": 847,
    "new_messages_today": 234,
    "total_messages": 5432
  }
}
```

---

### GET /admin/users
List all users with pagination.

**Query Parameters:**
- `page` (optional, default: 1)
- `per_page` (optional, default: 10)
- `role` (optional): 'admin', 'user', 'speaker'
- `active` (optional): 'true' or 'false'

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 1,
        "username": "admin",
        "email": "admin@example.com",
        "name": "Administrator",
        "role": "admin",
        "active": true,
        "created_at": "2024-01-01T00:00:00"
      }
    ],
    "total": 847,
    "page": 1,
    "per_page": 10
  }
}
```

**cURL:**
```bash
curl "http://localhost:5000/api/admin/users?page=1&per_page=20" \
  -H "Authorization: Bearer {token}"
```

---

### GET /admin/users/{id}
Get specific user details.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "name": "Administrator",
    "role": "admin",
    "active": true,
    "created_at": "2024-01-01T00:00:00",
    "created_chatbots": 5,
    "total_messages": 234
  }
}
```

---

### PUT /admin/users/{id}
Update user information.

**Request:**
```json
{
  "name": "New Name",
  "role": "user",
  "active": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "User updated successfully",
  "data": { "updated user object" }
}
```

---

### DELETE /admin/users/{id}
Delete a user account.

**Response:**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

---

### GET /admin/chatbots
List all chatbots.

**Query Parameters:**
- `page` (optional, default: 1)
- `per_page` (optional, default: 10)

**Response:**
```json
{
  "success": true,
  "data": {
    "chatbots": [
      {
        "id": 1,
        "name": "Tech Conference 2024",
        "event_name": "TechConf 2024",
        "start_date": "2024-03-01",
        "end_date": "2024-03-03",
        "status": "active",
        "public": true,
        "active": true,
        "participant_count": 234
      }
    ]
  }
}
```

---

### GET /admin/chatbots/{id}
Get chatbot details.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Tech Conference 2024",
    "event_name": "TechConf 2024",
    "description": "AI chatbot for tech conference",
    "start_date": "2024-03-01",
    "end_date": "2024-03-03",
    "system_prompt": "You are a helpful conference assistant...",
    "single_mode": true,
    "multiple_mode": false,
    "status": "active",
    "public": true,
    "active": true,
    "created_at": "2024-01-01T00:00:00",
    "guests": [
      {
        "id": 1,
        "name": "Dr. John Smith",
        "title": "Speaker",
        "is_speaker": true
      }
    ]
  }
}
```

---

### DELETE /admin/chatbots/{id}
Delete a chatbot.

**Response:**
```json
{
  "success": true,
  "message": "Chatbot deleted successfully"
}
```

---

### GET /admin/chatbots/{id}/guests
Get guests for a chatbot.

**Response:**
```json
{
  "success": true,
  "data": {
    "guests": [
      {
        "id": 1,
        "name": "Dr. John Smith",
        "title": "Lead Researcher",
        "description": "Expert in AI",
        "photo": "https://...",
        "is_speaker": true,
        "is_moderator": false
      }
    ]
  }
}
```

---

### POST /admin/chatbots/{id}/guests
Add a guest to chatbot.

**Request:**
```json
{
  "name": "Dr. Jane Smith",
  "title": "Senior Researcher",
  "description": "Expert in machine learning",
  "photo": "https://example.com/photo.jpg",
  "is_speaker": true,
  "is_moderator": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Guest added successfully",
  "data": { "guest object" }
}
```

---

### POST /admin/import/excel
Import users from Excel file.

**Request:** (multipart/form-data)
- `file` (required): Excel file (.xlsx, .xls)
- `chatbot_id` (optional): Auto-enroll users
- `default_role` (optional, default: 'user'): 'user', 'admin', 'speaker'

**Response:**
```json
{
  "success": true,
  "message": "Import successful",
  "data": {
    "total_users": 100,
    "successful": 98,
    "failed": 2,
    "credentials": [
      {
        "email": "user@example.com",
        "temporary_password": "TempPass123!"
      }
    ]
  }
}
```

---

## User Endpoints

All user endpoints require authentication (`@token_required` decorator).

### GET /user/chatbots
Get available chatbots for user.

**Query Parameters:**
- `search` (optional): Search chatbot name
- `page` (optional, default: 1)
- `per_page` (optional, default: 10)

**Response:**
```json
{
  "success": true,
  "data": {
    "chatbots": [
      {
        "id": 1,
        "name": "Tech Conference 2024",
        "event_name": "TechConf 2024",
        "start_date": "2024-03-01",
        "end_date": "2024-03-03",
        "description": "Join our tech conference",
        "participant_count": 234,
        "joined": false
      }
    ]
  }
}
```

---

### POST /user/chatbots/{id}/join
Join a chatbot/event.

**Response:**
```json
{
  "success": true,
  "message": "Successfully joined chatbot",
  "data": {
    "chatbot_id": 1,
    "joined_at": "2024-01-15T10:30:00"
  }
}
```

---

### GET /user/my-chatbots
Get chatbots user has joined.

**Response:**
```json
{
  "success": true,
  "data": {
    "chatbots": [
      {
        "id": 1,
        "name": "Tech Conference 2024",
        "event_name": "TechConf 2024",
        "joined_at": "2024-01-15T10:30:00",
        "message_count": 45,
        "last_message_at": "2024-01-15T15:20:00"
      }
    ]
  }
}
```

---

### GET /user/profile
Get current user profile.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "username": "user",
    "email": "user@example.com",
    "name": "Regular User",
    "bio": "I'm a user",
    "organization": "Tech Corp",
    "active": true,
    "created_at": "2024-01-01T00:00:00",
    "activity": {
      "total_messages": 234,
      "chatbots_joined": 5,
      "current_chatbots": 2
    }
  }
}
```

---

### PUT /user/profile
Update user profile.

**Request:**
```json
{
  "name": "Jane Doe",
  "bio": "AI enthusiast",
  "organization": "Tech Corp"
}
```

**Response:** Updated user object

---

### GET /user/chatbots/{id}/messages
Get message history for chatbot.

**Query Parameters:**
- `limit` (optional, default: 50): Number of messages
- `offset` (optional, default: 0): Skip messages

**Response:**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": 1,
        "content": "Hello, how can I help?",
        "is_user_message": false,
        "created_at": "2024-01-15T10:30:00"
      }
    ],
    "total": 234
  }
}
```

---

### POST /user/chatbots/{id}/messages
Send a message to chatbot.

**Request:**
```json
{
  "content": "What's the agenda for day 2?"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Message sent",
  "data": {
    "user_message": {
      "id": 233,
      "content": "What's the agenda for day 2?",
      "is_user_message": true,
      "created_at": "2024-01-15T10:35:00"
    },
    "bot_response": {
      "id": 234,
      "content": "The day 2 agenda includes...",
      "is_user_message": false,
      "created_at": "2024-01-15T10:35:02"
    }
  }
}
```

---

## Chatbot Endpoints

### POST /chatbots
Create new chatbot (admin only).

**Request:**
```json
{
  "name": "Tech Conference 2024",
  "event_name": "TechConf 2024",
  "description": "AI chatbot for tech conference",
  "start_date": "2024-03-01",
  "end_date": "2024-03-03",
  "system_prompt": "You are a helpful conference assistant...",
  "single_mode": true,
  "multiple_mode": false,
  "public": true,
  "active": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Chatbot created successfully",
  "data": { "chatbot object with id" }
}
```

---

### PUT /chatbots/{id}
Update chatbot (admin only).

**Request:** (same fields as create)

**Response: Updated chatbot object**

---

### GET /chatbots/{id}
Get chatbot details.

**Response:** Chatbot object with full details

---

### GET /chatbots/{id}/settings
Get chatbot configuration.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Tech Conference 2024",
    "system_prompt": "You are a helpful conference assistant...",
    "event_date": "2024-03-01",
    "single_mode": true,
    "multiple_mode": false,
    "public": true,
    "active": true
  }
}
```

---

### GET /chatbots/{id}/stats
Get chatbot statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "total_messages": 1234,
    "user_messages": 567,
    "bot_responses": 567,
    "total_participants": 234,
    "active_participants": 45,
    "total_guests": 12,
    "created_at": "2024-01-01T00:00:00",
    "last_activity": "2024-01-15T15:20:00"
  }
}
```

---

## Error Examples

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Token is missing or invalid"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Admin access required"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Chatbot not found"
}
```

### 400 Bad Request
```json
{
  "success": false,
  "message": "Invalid request: email is required"
}
```

---

## Rate Limiting

Currently unlimited. In production, rate limiting should be implemented:

- 100 requests per hour per IP
- 1000 requests per day per authenticated user
- 10 requests per minute for login endpoint

---

## Webhooks (Future Feature)

Webhook support coming in v2.0 for:
- User registration
- Message created
- Chatbot created
- Event started

---

## Troubleshooting

**Token expired:**
→ Call `/auth/login` again to get new token

**CORS error:**
→ Configure `CORS_ORIGINS` in `.env`

**Database connection failed:**
→ Check `DATABASE_URL` in `.env`

**Port already in use:**
→ Change port in `app.py` or use different port

---

## Rate Limits & Quotas

| Endpoint | Limit | Window |
|----------|-------|--------|
| Login | 5 attempts | 1 minute |
| Register | 10 requests | 1 hour |
| Messages | 100 | 1 hour |
| File Upload | 50MB | per file |

---

For more information, see the README.md and QUICKSTART.md files.
