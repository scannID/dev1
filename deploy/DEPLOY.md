# Production deploy (Contabo VPS, 3 APIs)

Stack: Caddy + `api-1`/`api-2`/`api-3` + merchant UI + admin UI + Keycloak + Postgres + Redis.

Domains (A records → VPS public IP):

| Host | Service |
|------|---------|
| `kode.com` | Merchant UI |
| `admin.kode.com` | Admin console |
| `api.kode.com` | Spring API (round-robin) |
| `auth.kode.com` | Keycloak |

## 1. Server prep

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git curl python3
sudo usermod -aG docker "$USER"   # re-login after
```

Copy the project onto the VPS (git clone or rsync). Work from the repo root.

## 2. Environment

```bash
cp .env.example .env
# Edit .env — set strong secrets for every password/secret below.
nano .env
```

Required for `docker-compose.prod.yml`:

- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `KEYCLOAK_ADMIN_USERNAME`, `KEYCLOAK_ADMIN_PASSWORD`
- `KEYCLOAK_BACKEND_CLIENT_SECRET` (long random; same value used by realm bootstrap)

Optional RAM knobs (defaults sized for ~8 GB Contabo Cloud VPS):

- `JAVA_TOOL_OPTIONS`, `API_MEM_LIMIT`
- `KEYCLOAK_JAVA_OPTS_APPEND`, `KEYCLOAK_MEM_LIMIT`
- `POSTGRES_MEM_LIMIT`, `REDIS_MEM_LIMIT`, `UI_MEM_LIMIT`

## 3. Bring the stack up

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

Wait until `api-1`/`api-2`/`api-3`, `keycloak`, `merchant`, `admin`, and `caddy` are healthy.

## 4. Bootstrap Keycloak (prod clients only)

```bash
set -a && source .env && set +a
export KEYCLOAK_URL=https://auth.kode.com
export CREATE_SEED_USERS=1   # optional first-time seed merchant/admin users
bash deploy/setup-realm.sh
```

This sets:

- `scanny-client` → redirect/web origin **only** `https://kode.com`
- `scanny-admin` → redirect/web origin **only** `https://admin.kode.com`
- `scanny-backend` confidential client secret from `.env`

Do **not** give one user both `MERCHANT` and `ADMIN` roles.

## 5. Smoke checks

```bash
bash deploy/smoke.sh
```

Manual auth checks:

1. Private window → `https://kode.com` → Sign in with a **MERCHANT** user (login form always shown).
2. Another private window → `https://admin.kode.com` → Sign in with an **ADMIN** user.
3. Merchant account must not enter admin; admin account must not enter merchant.
4. Logout from one app clears Keycloak SSO for both (same realm). Same-browser dual login is unsupported — use a private window or log out first.

## 6. Ops notes

- Caddy issues TLS automatically once DNS points at the VPS.
- API JWT accepts `azp` `scanny-client` and `scanny-admin` (see `SCANNY_JWT_ACCEPTED_AZP`).
- Logs: `docker compose -f docker-compose.prod.yml logs -f api-1 keycloak caddy`
- Stop: `docker compose -f docker-compose.prod.yml down` (add `-v` only if you intend to wipe data volumes)
