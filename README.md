# Scanny - QR-Powered Ordering System

A complete QR code ordering platform with merchant dashboard, customer menu, and admin console.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Java 21+
- Docker Desktop for Mac
- Maven 3.9+

### 1. Start Backend Services (PostgreSQL + Keycloak)
```bash
./start-dev.sh
```

### 2. Configure Keycloak (First Time Only)
See [KEYCLOAK_QUICK_START.md](KEYCLOAK_QUICK_START.md) for detailed setup.

**TL;DR:**
1. Open http://localhost:8080/admin (admin / admin)
2. Create clients: `scanny-client` and `superadmin`
3. Create test user: `testuser` / `password`

### 3. Start Backend API
```bash
cd backend
./mvnw spring-boot:run
```

### 4. Start Frontend
```bash
npm install
npm run dev
```

### 5. Start Admin Console
```bash
cd admin-console
npm install
npm run dev
```

## 📖 Documentation

- **[DATABASE_CONNECTION_SUMMARY.md](DATABASE_CONNECTION_SUMMARY.md)** - PostgreSQL connection overview
- **[POSTGRES_SETUP.md](POSTGRES_SETUP.md)** - Detailed PostgreSQL guide
- **[KEYCLOAK_QUICK_START.md](KEYCLOAK_QUICK_START.md)** - Quick setup guide
- **[KEYCLOAK_SETUP_MAC.md](KEYCLOAK_SETUP_MAC.md)** - Detailed Keycloak configuration
- **[SETUP_CHECKLIST.md](SETUP_CHECKLIST.md)** - Complete setup verification
- **[backend/README.md](backend/README.md)** - Backend API documentation

## 🌐 URLs

| Service | URL | Login |
|---------|-----|-------|
| Main App | http://localhost:5173 | testuser / password |
| Admin Console | http://localhost:5174 | testuser / password |
| Backend API | http://localhost:4000 | - |
| Keycloak Admin | http://localhost:8080/admin | admin / admin |

## 🛑 Stop Services

```bash
./stop-dev.sh
```

## 🏗️ Project Structure

```
scanIT/
├── src/                  # Main merchant app (React + TypeScript)
├── admin-console/        # Admin panel
├── backend/              # Spring Boot API + PostgreSQL
├── start-dev.sh          # Start all Docker services
├── stop-dev.sh           # Stop all services
└── KEYCLOAK_*.md         # Keycloak setup guides
```

## 🔐 Authentication

Uses Keycloak for SSO:
- **Realm**: master
- **Main App Client**: scanny-client
- **Admin Client**: superadmin

## 📝 Features

- ✅ QR code generation for businesses
- ✅ Customer menu browsing
- ✅ Order management
- ✅ Multi-business support
- ✅ Real-time order updates
- ✅ Keycloak SSO authentication
- ✅ Admin dashboard
- ✅ Reports and analytics

## 🐛 Troubleshooting

See [KEYCLOAK_SETUP_MAC.md](KEYCLOAK_SETUP_MAC.md#troubleshooting) for common issues.

## 🧰 Tech Stack

- **Frontend**: React 19, TypeScript, Vite, TailwindCSS
- **Backend**: Spring Boot 3.4, PostgreSQL 16, Flyway
- **Auth**: Keycloak 26
- **Deployment**: Docker Compose
