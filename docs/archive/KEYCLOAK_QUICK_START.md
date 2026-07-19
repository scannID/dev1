# 🚀 Keycloak Quick Start (Mac)

## One-Time Setup

### 1. Start Services
```bash
./start-dev.sh
```

### 2. Configure Keycloak (First Time Only)

Open: http://localhost:8080/admin
Login: `admin` / `admin`

#### Create `scanny-client` (Main App)
1. Clients → Create client
2. Client ID: `scanny-client`
3. Next → Keep defaults (public client)
4. Next → Set redirect URIs:
   - `http://localhost:5173/*`
   - `http://localhost:5173`
5. Web origins: `*`
6. Save

#### Create `superadmin` (Admin Console)
1. Clients → Create client
2. Client ID: `superadmin`
3. Next → Keep defaults (public client)
4. Next → Set redirect URIs:
   - `http://localhost:5174/*`
   - `http://localhost:5174`
5. Web origins: `*`
6. Save

#### Create Test User (automated — recommended)

After `./start-dev.sh`, run:

```bash
./setup-dev-test-merchant.sh
```

This creates `testuser` / `password` in the **scanny** realm with the **MERCHANT** role and email `test@scanny.app`.

On first login to the merchant app, the backend **auto-creates** the Postgres `merchants` + `businesses` rows via `GET /api/auth/merchant/me`. You do not need to register manually for local dev.

#### Create Test User (manual)

If you prefer the Keycloak UI:

1. Users → Create user
2. Username: `testuser`
3. Email: `test@scanny.app` (**required** — used to provision the merchant row)
4. Email verified: ON
5. Create → Credentials → password `password`, Temporary: OFF
6. Role mapping → Assign **MERCHANT** realm role

Without the MERCHANT role, the API returns 403. Without an email, auto-provision cannot run.

---

## Daily Development

### Start Everything
```bash
# Terminal 1: Start Docker (Postgres + Keycloak)
./start-dev.sh

# Terminal 2: Backend API
cd backend
./mvnw spring-boot:run

# Terminal 3: Frontend
npm run dev

# Terminal 4: Admin Console
cd admin-console
npm run dev
```

### Stop Everything
```bash
./stop-dev.sh
```

---

## URLs & Credentials

| Service | URL | Login |
|---------|-----|-------|
| Keycloak Admin | http://localhost:8080/admin | admin / admin |
| Main App | http://localhost:5173 | testuser / password |
| Admin Console | http://localhost:5174 | testuser / password |
| Backend API | http://localhost:4000 | - |

---

## Troubleshooting

### Port 8080 in use
```bash
lsof -ti:8080 | xargs kill -9
```

### Reset Keycloak (lose all data)
```bash
cd backend
docker compose down -v
docker compose up -d
# Reconfigure clients (step 2 above)
```

### Check logs
```bash
docker logs scanit-keycloak
docker logs scanit-postgres
```

---

## That's it! 🎉

Your Keycloak is configured exactly like Windows:
- **Realm**: master
- **Clients**: scanny-client, superadmin
- **URL**: localhost:8080
