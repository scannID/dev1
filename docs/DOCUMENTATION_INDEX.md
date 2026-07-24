# Documentation index

Current Scanny (`scanny.app`) documentation starts here.

## Core guides

- [Project overview](../README.md) — product summary, stack, quick start, and local URLs
- [Architecture](ARCHITECTURE.md) — applications, backend, data stores, trust boundaries, and deployment model
- [Local development](LOCAL_DEVELOPMENT.md) — Windows, macOS, and Linux setup
- [Security](SECURITY.md) — authentication, authorization, public APIs, audit events, and operational controls
- [Real-time behavior](REALTIME.md) — ticket and merchant-order WebSockets, Redis pub/sub, reconnects, and hardening
- [Containers](CONTAINERS.md) — local Compose, production Compose baseline, CI images, and deployment responsibilities
- [Runbooks](runbooks/README.md) — restart, restore DB, payment outage
- [1000 TPS readiness](runbooks/1000-TPS.md) — mixed load test, gates, replica kill
- [Database migration to Scanny](DATABASE_MIGRATION_SCANIT_TO_SCANNY.md) — updating an existing local database created under the legacy name

## API references

These references remain at the repository root:

- [General API documentation](../API_DOCUMENTATION.md)
- [Ticketing API](../TICKETING_API.md)
- [Quick Payments API](../QUICK_PAYMENTS_API.md)
- [Device Registration API](../DEVICE_REGISTRATION_API.md)

API references can drift. For security decisions and exact current behavior, verify routes, DTOs, Spring Security rules, and tests in `backend/`.

## Source map

| Area | Location |
| --- | --- |
| Merchant/customer React app | `src/` |
| Main app API clients and hooks | `src/api/`, `src/hooks/` |
| Admin React app | `admin-console/` |
| Spring Boot API | `backend/` |
| Database migrations | `backend/src/main/resources/db/migration/` |
| Local infrastructure | `docker-compose.yml` |
| Production deployment baseline | `docker-compose.prod.yml`, `deploy/` |
| Container build definitions | `Dockerfile`, `admin-console/Dockerfile`, `backend/Dockerfile` |
| CI workflow | `.github/workflows/ci.yml` |

## Historical documents

Earlier implementation summaries and setup notes are in [`archive/`](archive/README.md). They are retained for history and may be incomplete or wrong. Do not use an archived completion claim or setup guide as the current source of truth.
