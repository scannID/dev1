# Architecture

## System overview

Scanny is a multi-application QR commerce platform:

1. A customer scans a business or event QR code.
2. The public web experience loads the relevant menu or ticket data from the API.
3. Customers can place orders without a Keycloak account.
4. Authenticated merchants manage catalog and order state.
5. Authenticated administrators operate the platform through the admin console.

```text
Customer browser ─┐
Merchant app ─────┼── REST / WebSocket ── Spring Boot API ── PostgreSQL
Admin console ────┘                         │       │
                                           │       └── Redis
                                           └────────── Keycloak
```

## Web applications

The main Vite application in `src/` serves both customer and merchant workflows. Its API layer is organized under `src/api/`, with React hooks under `src/hooks/`. Merchant business, catalog, and order data come from backend APIs; local storage is not used as the system of record for business data.

The independent `admin-console/` Vite application consumes `/api/admin/**` APIs. Administrative access requires the Keycloak `ADMIN` role.

## Backend

`backend/` is a Java 21 Spring Boot application:

- Controllers expose REST resources under `/api`.
- Services implement business rules and integration behavior.
- Spring Data JPA repositories persist domain entities.
- Flyway migrations under `backend/src/main/resources/db/migration/` own schema evolution.
- Spring Security validates Keycloak JWTs and maps realm roles to Spring authorities.
- WebSocket support delivers live ticket statistics and is the transport for merchant-order updates as that channel is hardened.

The API is stateless for HTTP authentication. Protected requests carry `Authorization: Bearer <JWT>`.

## Data and infrastructure

PostgreSQL is the durable source of truth. It stores merchants, businesses, catalog items, orders, tickets, payment-related records, platform configuration, and the `audit_events` security trail. Schema changes must be added as forward-only Flyway migrations.

Redis supports:

- distributed rate-limit counters;
- short-lived cached data;
- pub/sub fan-out when multiple API instances serve WebSocket clients.

Redis is not the durable source of truth. Features should degrade deliberately when Redis is unavailable rather than silently weakening security controls.

Keycloak owns identities, credentials, realm roles, and JWT issuance. Application tables link domain records to identity identifiers but must not store Keycloak passwords.

## API boundaries

Customer-facing menu lookup and order creation are public by design. Merchant and administrator operations require JWT authentication and role checks. Public does not mean trusted: request validation, rate limiting, ownership boundaries, and safe error responses remain required.

The API contract is represented by the controllers and DTOs. Root-level API references are useful guides, but code and tests decide actual behavior when a reference has drifted.

## Real-time delivery

Ticket statistics and merchant orders use WebSockets. Redis pub/sub provides cross-instance fan-out; PostgreSQL remains authoritative and clients must reconcile by refetching after reconnects. Authentication, origin checks, subscription authorization, rate limits, and backpressure for these channels are being hardened. See [Real-time behavior](REALTIME.md).

## Deployment model

CI builds container images. A production Compose setup packages the components as a deploy-ready baseline, but the hosting platform is not chosen and no deployment should be inferred from the presence of that configuration. See [Containers](CONTAINERS.md).
