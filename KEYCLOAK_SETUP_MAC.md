# Keycloak Setup for Mac (Matching Windows Configuration)

## Overview
Your project uses Keycloak for authentication with the following configuration:
- **Keycloak URL**: `http://localhost:8080`
- **Realm**: `master`
- **Main App Client**: `scanny-client`
- **Admin Console Client**: `superadmin`

---

## Prerequisites
- **Docker Desktop for Mac** (recommended) OR **Homebrew**
- Port 8080 available

---

## Method 1: Docker Setup (Recommended)

### Step 1: Install Docker Desktop for Mac
Download from: https://www.docker.com/products/docker-desktop/

### Step 2: Add Keycloak to docker-compose.yml

Add this to your `backend/docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: scanit-postgres
    environment:
      POSTGRES_DB: scanit
      POSTGRES_USER: scanit
      POSTGRES_PASSWORD: scanit
    ports:
      - "5432:5432"
    volumes:
      - scanit_pg_data:/var/lib/postgresql/data
    networks:
      - scanit-network

  keycloak:
    image: quay.io/keycloak/keycloak:26.0.7
    container_name: scanit-keycloak
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
      KC_HTTP_PORT: 8080
      KC_HOSTNAME_STRICT: false
      KC_HOSTNAME_STRICT_HTTPS: false
      KC_HTTP_ENABLED: true
      KC_HEALTH_ENABLED: true
    ports:
      - "8080:8080"
    command:
      - start-dev
    networks:
      - scanit-network
    depends_on:
      - postgres

volumes:
  scanit_pg_data:

networks:
  scanit-network:
    driver: bridge
```

### Step 3: Start Services

```bash
cd backend
docker compose up -d
```

### Step 4: Verify Keycloak is Running

Open browser: http://localhost:8080

You should see the Keycloak welcome page.

### Step 5: Login to Admin Console

- URL: http://localhost:8080/admin
- Username: `admin`
- Password: `admin`

---

## Method 2: Homebrew Installation

### Step 1: Install Keycloak via Homebrew

```bash
# Install Keycloak
brew install keycloak

# Start Keycloak
keycloak start-dev --http-port=8080
```

### Step 2: Access Admin Console

- URL: http://localhost:8080
- Create admin user on first access
- Username: `admin`
- Password: `admin` (or your choice)

---

## Configure Keycloak (Same as Windows)

### Step 1: Create Client for Main App (`scanny-client`)

1. Login to Admin Console: http://localhost:8080/admin
2. Select **master** realm (top-left dropdown)
3. Click **Clients** in left menu
4. Click **Create client**
5. Fill in:
   - **Client ID**: `scanny-client`
   - **Client type**: OpenID Connect
   - Click **Next**
6. Enable these capabilities:
   - ☑ **Client authentication**: OFF (public client)
   - ☑ **Authorization**: OFF
   - ☑ **Standard flow**: ON
   - ☑ **Direct access grants**: ON
   - Click **Next**
7. Valid redirect URIs:
   - `http://localhost:5173/*`
   - `http://localhost:5173`
8. Web origins:
   - `http://localhost:5173`
   - `+` (or just `*` for dev)
9. Click **Save**

### Step 2: Create Client for Admin Console (`superadmin`)

1. Click **Clients** → **Create client**
2. Fill in:
   - **Client ID**: `superadmin`
   - **Client type**: OpenID Connect
   - Click **Next**
3. Enable these capabilities:
   - ☑ **Client authentication**: OFF
   - ☑ **Authorization**: OFF
   - ☑ **Standard flow**: ON
   - ☑ **Direct access grants**: ON
   - Click **Next**
4. Valid redirect URIs:
   - `http://localhost:5174/*`
   - `http://localhost:5174`
5. Web origins:
   - `http://localhost:5174`
   - `+` (or `*`)
6. Click **Save**

### Step 3: Create Test Users

1. Click **Users** in left menu
2. Click **Create new user**
3. Fill in:
   - **Username**: `testuser`
   - **Email**: `test@scanny.app`
   - **First name**: `Test`
   - **Last name**: `User`
   - **Email verified**: ON
4. Click **Create**
5. Go to **Credentials** tab
6. Click **Set password**
   - **Password**: `password`
   - **Temporary**: OFF
7. Click **Save**

Repeat for admin user:
- Username: `admin`
- Password: `admin123`

---

## Start Your Development Environment

### Terminal 1: Backend (PostgreSQL + Keycloak)
```bash
cd backend
docker compose up -d
# Or if using Homebrew: keycloak start-dev --http-port=8080
```

### Terminal 2: Backend API
```bash
cd backend
./mvnw spring-boot:run
# Runs on http://localhost:4000
```

### Terminal 3: Frontend (Main App)
```bash
npm run dev
# Runs on http://localhost:5173
```

### Terminal 4: Admin Console
```bash
cd admin-console
npm run dev
# Runs on http://localhost:5174
```

---

## Verify Setup

1. **Keycloak Admin**: http://localhost:8080/admin
   - Login: `admin` / `admin`
   - Check: Clients `scanny-client` and `superadmin` exist

2. **Main App**: http://localhost:5173
   - Click "Get started free"
   - Should redirect to Keycloak login
   - Login with: `testuser` / `password`
   - Should redirect back to app

3. **Admin Console**: http://localhost:5174
   - Click "Admin Login"
   - Should redirect to Keycloak login
   - Login with: `admin` / `admin123`
   - Should redirect back to admin panel

---

## Stop Services

```bash
# Docker
cd backend
docker compose down

# Homebrew
keycloak stop
```

---

## Troubleshooting

### Port 8080 Already in Use
```bash
# Check what's using port 8080
lsof -ti:8080

# Kill the process (replace PID)
kill -9 <PID>
```

### Keycloak Not Starting
```bash
# Check Docker logs
docker logs scanit-keycloak

# Restart container
docker compose restart keycloak
```

### Login Redirect Issues
- Clear browser cache and cookies
- Check client redirect URIs match exactly
- Verify ports are correct (5173 for main app, 5174 for admin)

### Reset Everything
```bash
# Stop and remove all containers and volumes
cd backend
docker compose down -v

# Restart fresh
docker compose up -d
```

---

## Quick Reference

| Service | URL | Credentials |
|---------|-----|-------------|
| Keycloak Admin | http://localhost:8080/admin | admin / admin |
| Main App | http://localhost:5173 | testuser / password |
| Admin Console | http://localhost:5174 | admin / admin123 |
| Backend API | http://localhost:4000 | - |
| PostgreSQL | localhost:5432 | scanit / scanit |

---

## Configuration Files

Your Keycloak config is in:
- Main app: `src/keycloak.ts`
- Admin console: `admin-console/src/keycloak.ts`

Both point to:
- URL: `http://localhost:8080`
- Realm: `master`

No changes needed! ✅
