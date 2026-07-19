# ✅ Keycloak Setup Checklist (Mac)

Use this checklist to verify your Keycloak setup matches your Windows configuration.

## Prerequisites
- [ ] Docker Desktop installed and running
- [ ] Port 8080 is available
- [ ] Port 5432 is available

## Initial Setup

### 1. Start Services
```bash
./start-dev.sh
```
- [ ] PostgreSQL container running
- [ ] Keycloak container running
- [ ] Can access http://localhost:8080

### 2. Keycloak Admin Access
- [ ] Can login to http://localhost:8080/admin
- [ ] Username: `admin`
- [ ] Password: `admin`
- [ ] Can see the master realm

### 3. Client Configuration

#### Main App Client (`scanny-client`)
- [ ] Client exists in Keycloak
- [ ] Client ID: `scanny-client`
- [ ] Client type: OpenID Connect
- [ ] Client authentication: OFF (public)
- [ ] Standard flow: ON
- [ ] Direct access grants: ON
- [ ] Valid redirect URIs includes: `http://localhost:5173/*`
- [ ] Web origins: `*` or `http://localhost:5173`

#### Admin Client (`superadmin`)
- [ ] Client exists in Keycloak
- [ ] Client ID: `superadmin`
- [ ] Client type: OpenID Connect
- [ ] Client authentication: OFF (public)
- [ ] Standard flow: ON
- [ ] Direct access grants: ON
- [ ] Valid redirect URIs includes: `http://localhost:5174/*`
- [ ] Web origins: `*` or `http://localhost:5174`

### 4. Test User
- [ ] User `testuser` created
- [ ] Email: `test@scanny.app`
- [ ] Email verified: ON
- [ ] Password set: `password`
- [ ] Password temporary: OFF

## Application Testing

### 5. Main App Authentication
```bash
npm run dev
```
- [ ] App loads at http://localhost:5173
- [ ] Clicking "Get started free" redirects to Keycloak
- [ ] Can login with `testuser` / `password`
- [ ] Redirects back to app after login
- [ ] User sees dashboard

### 6. Admin Console Authentication
```bash
cd admin-console
npm run dev
```
- [ ] Console loads at http://localhost:5174
- [ ] Clicking "Admin Login" redirects to Keycloak
- [ ] Can login with `testuser` / `password`
- [ ] Redirects back to admin console after login
- [ ] User sees admin panel

### 7. Backend API
```bash
cd backend
./mvnw spring-boot:run
```
- [ ] API starts at http://localhost:4000
- [ ] Health check works: http://localhost:4000/health

## Configuration Files Verification

### 8. Frontend Config
File: `src/keycloak.ts`
- [ ] url: `http://localhost:8080`
- [ ] realm: `master`
- [ ] clientId: `scanny-client`

### 9. Admin Console Config
File: `admin-console/src/keycloak.ts`
- [ ] url: `http://localhost:8080`
- [ ] realm: `master`
- [ ] clientId: `superadmin`

### 10. Docker Compose
File: `backend/docker-compose.yml`
- [ ] PostgreSQL service exists
- [ ] Keycloak service exists
- [ ] Keycloak port: 8080
- [ ] Keycloak admin user: admin
- [ ] Keycloak admin password: admin

## Final Verification

### 11. Full Flow Test
- [ ] Start all services (Docker, Backend, Frontend, Admin)
- [ ] Open main app, login, create business
- [ ] Open admin console, login, see data
- [ ] Logout from main app
- [ ] Login again - session restored

### 12. Port Conflicts Check
```bash
lsof -ti:8080  # Should show Docker/Keycloak
lsof -ti:5432  # Should show Docker/PostgreSQL
lsof -ti:4000  # Should show Spring Boot
lsof -ti:5173  # Should show Vite (main app)
lsof -ti:5174  # Should show Vite (admin)
```

## Troubleshooting

If something doesn't work:

1. **Check Docker logs:**
```bash
docker logs scanit-keycloak
docker logs scanit-postgres
```

2. **Restart services:**
```bash
./stop-dev.sh
./start-dev.sh
```

3. **Reset everything:**
```bash
cd backend
docker compose down -v
docker compose up -d
# Reconfigure Keycloak clients
```

4. **Clear browser data:**
- Clear cookies for localhost
- Clear local storage
- Try incognito mode

---

## ✅ Setup Complete!

If all checkboxes are marked, your Mac setup matches your Windows configuration exactly! 🎉

**Configuration Summary:**
- Keycloak URL: `http://localhost:8080`
- Realm: `master`
- Main client: `scanny-client`
- Admin client: `superadmin`
- Test user: `testuser` / `password`
