# Local development

## Prerequisites

Install:

- Node.js 20+ and npm
- Java 21
- Maven 3.9+
- Docker Desktop on Windows/macOS, or Docker Engine with Compose on Linux
- Redis 7, either installed locally or run in Docker
- `curl` and `jq` when using the Unix Keycloak helper

Commands below run from the repository root unless noted.

## Environment files

Create local environment files from the committed templates:

Windows PowerShell:

```powershell
Copy-Item .env.example .env
Copy-Item admin-console/.env.example admin-console/.env
```

macOS/Linux:

```bash
cp .env.example .env
cp admin-console/.env.example admin-console/.env
```

The defaults use:

- API: `http://localhost:4000/api`
- WebSocket: `ws://localhost:4000`
- Keycloak: `http://localhost:8080`, realm `scanny`
- Merchant client: `scanny-client`
- Admin client: `scanny-admin`

Keep real credentials out of these Vite files: variables prefixed with `VITE_` are compiled into browser code.

## Infrastructure

Start PostgreSQL, Redis, and Keycloak with the canonical root Compose file:

```bash
docker compose up -d
```

The committed local defaults use database/user `scanny`, password `scanny-local`, and password-protected Redis on port 6379.

## Keycloak

Wait for `http://localhost:8080` to respond. The local Keycloak administrator defaults to `admin` / `admin`.

### Windows

The PowerShell bootstrap creates or updates the `scanny` realm, `MERCHANT`, `ADMIN`, and `CUSTOMER` roles, public browser clients, and local users:

```powershell
.\backend\setup-scanny-realm.ps1
```

Local logins:

- Merchant app (`:5173`): `testuser` / `password` (`MERCHANT` role)
- Admin console (`:5174`): `adminuser` / `Admin@2026!` (`ADMIN` role)

### macOS and Linux

In the Keycloak admin console:

1. Create an enabled realm named `scanny`.
2. Create public OpenID Connect client `scanny-client` with redirect URI `http://localhost:5173/*` and web origin `http://localhost:5173`.
3. Create public OpenID Connect client `scanny-admin` with redirect URI `http://localhost:5174/*` and web origin `http://localhost:5174`.

Then add application roles and backend client configuration:

```bash
./setup-scanny-realm.sh
```

On Windows, prefer `.\backend\setup-scanny-realm.ps1` which also seeds `adminuser` (`ADMIN`) and `testuser` (`MERCHANT`). Never use these development credentials outside a local environment.

## Run the backend

Set the local infrastructure passwords in the API process:

Windows PowerShell:

```powershell
$env:POSTGRES_PASSWORD = 'scanny-local'
$env:REDIS_PASSWORD = 'scanny-local'
cd backend
mvn spring-boot:run
```

macOS/Linux:

```bash
export POSTGRES_PASSWORD=scanny-local
export REDIS_PASSWORD=scanny-local
cd backend
mvn spring-boot:run
```

Flyway applies pending migrations at startup. Confirm:

```bash
curl http://localhost:4000/health
```

The default Spring profile is `dev`. Configuration can be overridden with environment variables such as `POSTGRES_HOST`, `POSTGRES_DB`, `REDIS_HOST`, `KEYCLOAK_ISSUER_URI`, and `SCANNY_CORS_ORIGIN_PATTERNS`.

## Run the main application

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Vite listens on all interfaces so a phone on the same trusted network can test QR flows; use the computer's LAN address in the QR URL when needed.

## Run the admin console

In a separate terminal:

```bash
cd admin-console
npm install
npm run dev
```

Open `http://localhost:5174` and sign in with a user assigned the `ADMIN` realm role.

## Common commands

```bash
npm run typecheck
npm run lint
npm run build
npm run build:admin
```

```bash
cd backend
mvn test
```

Stop infrastructure without deleting PostgreSQL data:

```bash
docker compose down
```

Adding `-v` to `docker compose down` deletes the local PostgreSQL and Redis volumes.

## Troubleshooting

- A `401` usually means the JWT is missing, expired, or issued by a different realm.
- A `403` usually means the user lacks the required `MERCHANT` or `ADMIN` realm role.
- If the API cannot start, check PostgreSQL, Redis, Keycloak, and ports 4000, 5432, 6379, and 8080.
- If login loops, verify each Keycloak client's redirect URI and web origin exactly match its Vite URL.
- If a phone cannot load a QR URL, use the host's LAN IP and check the firewall. Do not expose the development services to the public internet.
- After changing Vite environment variables, restart the corresponding Vite server.
