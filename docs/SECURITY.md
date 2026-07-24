# Security

## Trust model

Scanny separates three access levels:

- Customers use intentionally public menu, order-placement, QR, and selected ticket/device flows.
- Merchants authenticate with Keycloak and require the `MERCHANT` realm role.
- Platform administrators authenticate with Keycloak and require the `ADMIN` realm role.

Public endpoints are still hostile-input boundaries. They require validation, rate limiting, bounded payloads, non-enumerable identifiers where appropriate, and responses that do not disclose internal details.

## Authentication and authorization

The browser applications use Keycloak OpenID Connect clients. The backend is a stateless OAuth 2.0 resource server and validates bearer JWT issuer, signature, and lifetime. Realm roles from `realm_access.roles` become Spring Security authorities.

Authorization must be enforced in the backend, not only by hiding UI controls. Role checks alone are insufficient for merchant resources: services must also verify that a merchant owns the business, catalog, or order being accessed.

Never:

- store passwords in Scanny tables;
- put client secrets in `VITE_*` variables;
- commit `.env` files or production credentials;
- log access tokens, passwords, PINs, or full payment credentials;
- trust a business, merchant, or user identifier supplied by a browser without ownership checks.

## Public customer APIs

Menu retrieval and customer order creation are public by design. Controls should include:

- schema and length validation;
- server-side price calculation from current catalog data;
- rate limits by suitable dimensions (including `/api/payments/initiate` and status);
- payment idempotency: one active intent per `(context, referenceId)`, optional `Idempotency-Key` header;
- generic errors that do not expose stack traces or account existence;
- abuse monitoring and correlation IDs.

Client-submitted totals, roles, payment state, and ownership identifiers are not authoritative.

## WebSockets

Ticket and merchant-order WebSockets are being hardened. A successful HTTP upgrade must not be treated as sufficient authorization. Production handling should validate allowed origins, authenticate protected subscriptions, authorize each business/topic, expire sessions when credentials expire, enforce message and connection limits, and remove dead or slow consumers.

Do not place bearer tokens in URLs when an authenticated first message or a supported secure handshake mechanism is available; URLs commonly reach logs and analytics. See [Real-time behavior](REALTIME.md).

## Redis and rate limiting

Redis backs distributed rate limits, cache entries, and pub/sub. Use namespaced keys with explicit TTLs and do not store secrets or durable business state there. Production Redis must require authentication, use encrypted transport where supported, and be reachable only from trusted application networks.

Security-sensitive rate limiting needs an explicit failure policy. Production sets `scanny.rate-limit.fail-closed=true` so a Redis outage denies limited requests instead of silently opening unlimited access.

## Audit trail

The PostgreSQL `audit_events` table provides a durable audit trail for administrative and sensitive merchant actions. Events can record actor identity, action, resource, outcome, client IP, correlation ID, timestamp, and metadata.

Audit records should be append-only to normal application roles, exclude secrets and unnecessary personal data, and have documented retention and access policies. Application logs are not a substitute for audit events.

## Browser and network security

Production requires HTTPS for all public origins and `wss://` for WebSockets. Configure exact CORS origins (`SCANNY_CORS_ORIGIN_PATTERNS`); localhost and wildcard development patterns are rejected by `ProdCorsGuard` unless `scanny.cors.allow-wildcard-patterns=true`. The API emits security headers (nosniff, frame deny, Referrer-Policy, Permissions-Policy, API CSP, and HSTS when enabled).

JWT validation covers issuer, signature, lifetime, and in production also audience (`aud`, default `account`) and authorized party (`azp`, Keycloak client ids such as `scanny-client` / `scanny-admin`).

Client IP for rate limits and audit uses `request.getRemoteAddr()` by default. `X-Forwarded-For` is honored only when `scanny.client-ip.trust-forwarded-headers=true` **and** the immediate peer is in `scanny.client-ip.trusted-proxies`. Production rate limiting uses Redis with `fail-closed` so a Redis outage does not silently remove limits.

Keycloak redirect URIs and web origins must be exact production values. Rotate all local defaults before deployment and use a secret manager for database, Keycloak, mail, Redis, and integration credentials.

## Data and operations

- Encrypt traffic between services where the deployment network does not provide equivalent protection.
- Restrict database roles and network access using least privilege.
- Back up PostgreSQL and test restores.
- Apply dependency and container vulnerability scanning in CI.
- Patch base images, Java, Node.js, Keycloak, PostgreSQL, and Redis regularly.
- Define incident response, audit retention, and credential rotation procedures before production.

Report suspected vulnerabilities privately to the project maintainers; do not include exploitable details in a public issue.
