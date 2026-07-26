# Kode

Kode (`kode.com`) is a QR-powered commerce platform. Merchants manage their business, catalog, orders, tickets, and payments; customers scan a QR code to open a public menu and place an order; administrators use a separate console for platform operations.

> Internal repo/package names may still say `scanny` (Keycloak clients, Java packages). The public product name is **Kode**.

## Architecture

- `src/` — React 19 merchant and customer application (Vite, TypeScript, Tailwind CSS)
- `admin-console/` — React administrator console
- `backend/` — Java 21 / Spring Boot 3.4 REST and WebSocket service
- PostgreSQL 16 — business data, orders, tickets, payments, configuration, and the `audit_events` trail
- Keycloak 26 — OpenID Connect login and JWT issuance
- Redis — rate limiting, caching, and pub/sub for horizontally scaled real-time delivery

The merchant UI reads and changes business data through typed API clients and hooks. Browser storage is not the source of truth for merchant business data. See [Architecture](docs/ARCHITECTURE.md).

## Local development

### Prerequisites

- Node.js 20 or newer and npm
- Java 21
- Docker with Compose
- Maven 3.9+, or the Maven wrapper in `backend/`
- Redis 7 (local installation or container)

### 1. Start infrastructure

```bash
docker compose up -d
```

The root Compose file starts PostgreSQL, Redis, and Keycloak.

### 2. Configure Keycloak

After Keycloak is ready, create the `scanny` realm, roles, and local clients:

Windows PowerShell:

```powershell
.\backend\setup-scanny-realm.ps1
```

macOS/Linux: first create the `scanny` realm and the `scanny-client` and `scanny-admin` public clients in the Keycloak admin console, then run:

```bash
./setup-scanny-realm.sh
```

The shell script requires `curl` and `jq`. See [Local development](docs/LOCAL_DEVELOPMENT.md) for client URLs and test-user setup.

### 3. Run the API

Windows:

```powershell
cd backend
mvn spring-boot:run
```

macOS/Linux:

```bash
cd backend
mvn spring-boot:run
```

### 4. Run the web applications

In separate terminals:

```bash
npm install
npm run dev
```

```bash
cd admin-console
npm install
npm run dev
```

Copy `.env.example` and `admin-console/.env.example` to local `.env` files when overriding defaults. Never commit secrets. Full setup and troubleshooting are in [Local development](docs/LOCAL_DEVELOPMENT.md).

## Local URLs

| Service | URL |
| --- | --- |
| Merchant/customer app | http://localhost:5173 |
| Admin console | http://localhost:5174 |
| API | http://localhost:4000 |
| Health check | http://localhost:4000/health |
| Ticket WebSocket | ws://localhost:4000/ws/tickets/stats |
| Keycloak | http://localhost:8080 |
| Keycloak admin | http://localhost:8080/admin |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

## Authentication and public access

Protected APIs accept Keycloak bearer JWTs and enforce `MERCHANT` or `ADMIN` roles. Customer menu lookup and order placement are intentionally public; treat all input to those endpoints as untrusted. Real-time ticket and merchant-order WebSocket paths are being hardened, so do not assume that a permitted handshake alone establishes authorization.

## Documentation

Start with the [documentation index](docs/DOCUMENTATION_INDEX.md). Current technical documentation lives in `docs/`; historical notes are retained in `docs/archive/` and may no longer be correct. Endpoint references remain at the repository root:

- [General API](API_DOCUMENTATION.md)
- [Ticketing API](TICKETING_API.md)
- [Quick Payments API](QUICK_PAYMENTS_API.md)
- [Device Registration API](DEVICE_REGISTRATION_API.md)

## Containers and deployment

CI builds container images, but a hosting provider and production runtime have not been selected. The production Compose configuration is a deploy-ready baseline, not evidence that Scanny is deployed. Operators must still supply secrets, DNS, TLS termination, persistent storage, backups, monitoring, and an external availability plan. See [Containers](docs/CONTAINERS.md).
