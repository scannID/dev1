# Containers

Scanny provides separate container builds for the API, merchant/customer web app, and admin console, plus Compose configurations for local infrastructure and a production-oriented full stack.

## Images

| Component | Build file | Runtime |
| --- | --- | --- |
| Merchant/customer app | `Dockerfile` | unprivileged Nginx serving the Vite build |
| Admin console | `admin-console/Dockerfile` | unprivileged Nginx serving the Vite build |
| API | `backend/Dockerfile` | Java 21 JRE running the Spring Boot JAR |

The Dockerfiles use multi-stage builds and define health checks. Vite configuration is supplied at image build time because `VITE_*` values are embedded in browser assets and are not secrets.

## Local infrastructure

The root `docker-compose.yml` is the canonical local infrastructure stack:

```bash
docker compose up -d
docker compose ps
```

It starts PostgreSQL, password-protected Redis, and Keycloak. Run the API and Vite applications on the host for fast reloads. Local defaults are for development only.

Stop services:

```bash
docker compose down
```

Add `-v` only when intentionally deleting local PostgreSQL and Redis data.

`backend/docker-compose.yml` is a narrower legacy development stack. Prefer the root Compose file for new local environments.

## Production Compose baseline

`docker-compose.prod.yml` builds and connects:

- Caddy for TLS termination and routing (round-robin across **three API replicas**);
- Spring Boot API (`api-1`, `api-2`, `api-3`);
- merchant/customer web app;
- admin console;
- PostgreSQL (app DB + separate `keycloak` database via init script);
- Redis;
- Keycloak (uses the dedicated `keycloak` database).

Capacity / mixed-load proof: [1000 TPS readiness runbook](runbooks/1000-TPS.md).

Required variables use Compose's `${NAME:?…}` checks so the stack fails early when important values are missing. Review the entire rendered configuration before use:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml config
docker compose --env-file .env.production -f docker-compose.prod.yml build
```

Starting the stack:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

Do not commit `.env.production`.

## Deployment status

CI builds the containers, but Scanny has not selected a hosting provider or production runtime. `docker-compose.prod.yml` is deploy-ready configuration only; it does not mean the service is hosted or production-ready by itself.

Before production, an operator must provide and validate:

- DNS for `scanny.app`, `admin.scanny.app`, `api.scanny.app`, and `auth.scanny.app`;
- publicly reachable ports 80/443 and Caddy certificate persistence;
- strong, unique database, Redis, and Keycloak credentials from a secret manager;
- production Keycloak realm, clients, redirect URIs, roles, and key lifecycle;
- durable volumes, encrypted backups, and tested restore procedures;
- host sizing, OS patching, firewall rules, and container update policy;
- logs, metrics, alerts, uptime checks, and incident response;
- a scaling design for PostgreSQL, Redis pub/sub, and WebSocket connections.

The bundled PostgreSQL, Redis, and Keycloak containers may be suitable for a controlled single-host deployment, but managed services or independent high-availability deployments require different operational design.

## CI and releases

CI should prove that frontend builds, backend tests, and all Docker image builds succeed. A successful image build is not a release or deployment. Release automation should additionally pin image versions, publish immutable tags or digests, scan images, preserve provenance, and require an explicit deployment environment.

## Operational notes

- Back up PostgreSQL; Redis pub/sub is transient and must not be the system of record.
- Preserve Caddy state so certificate management remains stable.
- Run Flyway migrations once with controlled rollout semantics when multiple API replicas start.
- Keep internal database, Redis, API, and Keycloak ports off the public network.
- Confirm health checks exercise dependencies appropriately without exposing sensitive details.
- Use `wss://` through the reverse proxy and verify WebSocket upgrade routing.
