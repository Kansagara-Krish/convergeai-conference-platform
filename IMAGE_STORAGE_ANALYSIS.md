# 📁 Image Storage Analysis: assets/ vs backend/uploads/

## 🎯 Quick Summary

| Directory | Status | Usage | Purpose |
|-----------|--------|-------|---------|
| **backend/uploads/** | ✅ ACTIVE & REAL | Primary storage | User uploads, guest images, chat messages |
| **assets/uploads/** | ⚠️ FALLBACK | Never used | Legacy/unused directory |
| **backend/static/generated/** | ✅ ACTIVE & REAL | Single point | AI-generated images from Gemini |
| **assets/static/generated/** | ⚠️ FALLBACK | Never used | Legacy/unused directory |

---

## 📂 Directory Structure Breakdown

### ✅ ACTIVE - backend/uploads/ (REAL PRODUCTION STORAGE)

**Location**: `backend/uploads/`

**Subdirectories**:
```
backend/uploads/
├── backgrounds/          # Background images for AI generation
├── guests/              # Guest profile photos
├── messages/            # User-uploaded message images
├── guest_lists/         # Imported CSV/XLSX files
└── guest_icon.jpg       # Default guest avatar icon
```

**Configuration**:
```python
# backend/config.py (Line 72)
UPLOAD_FOLDER = 'uploads'

# backend/app.py (Lines 118-120)
@app.route('/uploads/<path:filename>')
def serve_uploads(filename):
    upload_folder = os.path.join(app.root_path, 'uploads')
    return send_from_directory(upload_folder, filename)
```

**Frontend Reference**:
- API calls images via: `GET http://localhost:7000/api/uploads/{path}`
- Frontend constructs URLs: `${API_BASE_URL}/uploads/{normalized}`

---

### ✅ ACTIVE - backend/static/generated/ (AI-GENERATED IMAGES)

**Location**: `backend/static/generated/`

**Contents**: AI-generated images from Gemini API (portrait and group photos)

**Configuration**:
```python
# backend/app.py (Lines 125-128)
@app.route('/static/generated/<path:filename>')
def serve_generated(filename):
    static_folder = os.path.join(app.root_path, 'static', 'generated')
    return send_from_directory(static_folder, filename)
```

**Frontend Reference**:
- Image URLs stored as: `/static/generated/{filename}`
- Fallback chain: If image fails, tries `/uploads/messages/then `/uploads/guests/`

---

### ⚠️ UNUSED - assets/ Directory (LEGACY)

**Location**: `assets/`

**Contents** (Never dynamically used):
```
assets/
├── images/
│   └── guest-mode-icon.svg    # Static icon file only
├── static/
│   └── generated/             # Empty - not used
└── uploads/
    ├── backgrounds/           # Empty
    ├── guests/               # Empty
    ├── messages/             # Empty
    ├── guest_lists/          # Empty
    └── guest_icon.jpg        # Duplicate (not used)
```

**Status**: ❌ NOT REFERENCED in code - Can be deleted or used as backup storage

---

## 🔍 Code Usage Analysis

### Where backend/uploads/ is Used

#### 1. **Guest Profile Photos** (backend/routes/admin.py)
```python
# Line 90
upload_root = os.path.join(current_app.root_path, 'uploads', 'guests')

# Lines 97, 124
return f"uploads/guests/{unique_filename}"
```

#### 2. **Message Images** (backend/routes/user.py)
```python
# Line 401 - Preserves AI images, deletes user uploads
if normalized.startswith('uploads/messages/'):
    candidate_path = Path(current_app.root_path) / normalized
    # DELETE: User-uploaded message images
```

#### 3. **Background Images** (backend/routes/chatbot.py)
```python
# Line 116
base_upload = current_app.config.get('UPLOAD_FOLDER', 'uploads')

# Line 133
relative_path = Path('uploads') / subdirectory / unique_name
```

#### 4. **Frontend Image Loading** (frontend/components/js/main.js)
```javascript
// Line 1177-1180
if (normalized.startsWith("uploads/")) {
    return `${API_BASE_URL}/uploads/${normalized}`;
}

// Line 842, 853
normalized = `uploads/guests/${normalized}`;
normalized = `uploads/${normalized}`;
```

---

## 🎯 Image Upload Flow

```
User Uploads Image
    ↓
POST /api/admin/guests/upload (or similar endpoint)
    ↓
backend/routes/admin.py: save_guest_image()
    ↓
Save to: backend/uploads/guests/{unique_filename}
    ↓
Store path in database: "uploads/guests/{filename}"
    ↓
Frontend GET request to: /api/uploads/guests/{filename}
    ↓
backend/app.py: serve_uploads() reads from backend/uploads/
    ↓
Return image to frontend
```

---

## 🚀 AI Image Generation Flow

```
User requests: Generate Image
    ↓
POST /api/users/generate-image
    ↓
backend/routes/user.py: generates image with Gemini API
    ↓
Save to: backend/static/generated/{uuid}.png
    ↓
Store in database: "/static/generated/{uuid}.png"  + DriveImageBackup
    ↓
Frontend GET request: /api/static/generated/{uuid}.png
    ↓
backend/app.py: serve_generated() reads from backend/static/generated/
    ↓
Return image to frontend
    ↓
Also uploaded to Google Drive for redundancy
```

---

## 📊 Storage Breakdown Table

### backend/uploads/ (ACTIVE) - User & Uploaded Assets

| Subdirectory | Purpose | File Types | Lifecycle |
|--------------|---------|-----------|-----------|
| **guests/** | Guest profile photos imported from Excel | PNG, JPG, JPEG, GIF | Tied to guest record |
| **messages/** | Images users upload in chat | PNG, JPG, JPEG, GIF, WEBP | Deleted when message removed |
| **backgrounds/** | Event background images for AI generation | PNG, JPG, JPEG, GIF | Tied to chatbot config |
| **guest_lists/** | Raw CSV/XLSX imports (archive) | CSV, XLSX | Never auto-deleted |

### backend/static/generated/ (ACTIVE) - AI-Generated Content

| File Pattern | Purpose | Lifecycle | Backup |
|--------------|---------|-----------|--------|
| **{uuid}.png** | AI-generated portrait/group images | Preserved when conversation deleted | Google Drive backup |

### assets/ (UNUSED - Legacy)

| Item | Status | Reason |
|------|--------|--------|
| assets/static/generated/ | Unused | Backend uses backend/static/generated/ |
| assets/uploads/ | Unused | Backend uses backend/uploads/ |
| assets/images/guest-mode-icon.svg | Static only | Used once in code (if at all) |

---

## 🗑️ What Should Happen

### ✅ Keep (ACTIVE)
```
✓ backend/uploads/           → Primary user upload storage (REQUIRED)
✓ backend/static/generated/  → AI image storage (REQUIRED)
```

### ⚠️ Optional Review
```
? assets/images/             → Check if guest-mode-icon.svg is still used
? assets/static/generated/   → Can be deleted or used as backup archive
? assets/uploads/            → Can be deleted or used as backup archive
```

### 🧹 Recommendation

#### **Safe to Delete**:
```
assets/uploads/              (Not referenced in any backend code)
assets/static/generated/     (Not referenced in any backend code)
```

#### **Keep For Now**:
```
assets/images/               (May be used in HTML static imports - check usage)
backend/uploads/             (CRITICAL - Active storage)
backend/static/generated/    (CRITICAL - Active storage)
```

---

## 🔐 Image Preservation Strategy

### AI-Generated Images (PRESERVED)
- **Storage**: `backend/static/generated/`
- **Backup**: Google Drive (DriveImageBackup model)
- **Deletion**: ❌ NEVER deleted when conversation is removed

### User-Uploaded Message Images (DELETED)
- **Storage**: `backend/uploads/messages/`
- **Deletion**: ✅ DELETED when message or conversation is removed
- **Backup**: None (temporary user uploads)

### Guest Profile Images (KEPT)
- **Storage**: `backend/uploads/guests/`
- **Deletion**: ✅ DELETED only when guest record is deleted
- **Linked to**: User's guest import

### Background Images (KEPT)
- **Storage**: `backend/uploads/backgrounds/`
- **Deletion**: ✅ DELETED only when chatbot config changes
- **Linked to**: Chatbot background image field

---

## 📋 Configuration Summary

```ini
[FILE SERVING]
UPLOAD_FOLDER = 'uploads'           # Relative to backend/
MAX_CONTENT_LENGTH = 50MB           # 50MB file upload limit

[ROUTES]
GET /uploads/<path:filename>        → Serves from backend/uploads/
GET /static/generated/<path:filename> → Serves from backend/static/generated/

[FRONTEND API]
API_URL = http://localhost:7000/api
Image URLs: ${API_URL}/uploads/{path}
Generated: ${API_URL}/static/generated/{uuid}.png
```

---

## ✅ Answer to Your Question

**"Which folder is real in use?"**

### REAL & ACTIVE:
1. ✅ **backend/uploads/** - Primary active storage (guests, backgrounds, messages)
2. ✅ **backend/static/generated/** - AI-generated image storage

### LEGACY/UNUSED:
- ⚠️ **assets/uploads/** - Not used (can be removed)
- ⚠️ **assets/static/generated/** - Not used (can be removed)

---

## 🎓 Key TakeAway

The `assets/` folder appears to be a **legacy directory structure** that may have been used in an earlier version but is no longer referenced in the codebase. All active image storage happens in `backend/`:

- **User uploads** → `backend/uploads/`
- **AI images** → `backend/static/generated/`
- **Backups** → Google Drive (DriveImageBackup)

You can safely clean up or ignore the `assets/` folder structure.
