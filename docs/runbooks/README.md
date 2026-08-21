# Scanny runbooks

Short operational guides. Keep them current when hosting changes.

- [1000 TPS readiness](1000-TPS.md) — mixed load test, pass/fail gates, replica kill

## 1. Stack down / restart

### Symptoms
- Merchant/admin UI cannot load API
- `/api/health` or `/actuator/health` fails
- Keycloak login loops

### Local (dev)
```powershell
scanny -Stop
kodte -All
```
Or from repo root:
```powershell
.\stop-dev.ps1
.\start-dev.ps1 -All
```

### Hosted (Compose)
```bash
cd /opt/scanny   # or your deploy path
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f --tail=200 api-1 api-2 api-3
```

### Checks after restart
1. `GET /api/health` → ok
2. Admin → System health: Database + Keycloak operational
3. Merchant login (Keycloak)
4. One catalog read + one payment initiate (stub or live)

---

## 2. Restore database

### Prerequisites
- A backup from `scripts/backup-postgres.sh` or `.ps1`
- Maintenance window (API down or read-only)

### Restore (Compose container)
```bash
# Stop API writers
docker compose -f docker-compose.prod.yml stop api

# Drop/recreate or restore into existing DB (example: gunzip pipe)
gunzip -c backups/postgres/scanny_YYYYMMDDTHHMMSSZ.sql.gz \
  | docker exec -i "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

docker compose -f docker-compose.prod.yml start api
```

### Verify
- Flyway history present: `SELECT version FROM flyway_schema_history ORDER BY installed_rank;`
- Spot-check merchants / recent orders
- Keycloak still points at expected DB (if shared — prefer separate Keycloak DB in production)

### Schedule backups (once hosted)
```cron
15 2 * * * /opt/scanny/scripts/backup-postgres.sh >> /var/log/scanny-backup.log 2>&1
```
Windows Task Scheduler can run `backup-postgres.ps1` daily.

---

## 3. Payment outage

### Symptoms
- Customers stuck on “waiting for payment”
- Admin health: Payment providers `degraded` or `down`
- Initiate returns 503

### Immediate actions
1. Confirm prod config: `PAYMENTS_FALLBACK_TO_STUB=false` (do **not** silently charge stub in prod).
2. Check provider credentials / enable flags:
   - `MTN_MOMO_ENABLED`, `AIRTEL_MONEY_ENABLED`
   - API URL, keys, subscription keys, callback URLs
3. Inspect API logs for initiate/status errors around the incident window.
4. If provider is down: communicate “payments temporarily unavailable”; keep catalog/orders read paths up.

### Safe recovery
- Do **not** re-run bulk payment initiates for the same order without checking existing intents.
- Payment initiate is idempotent for active/paid intents and optional `Idempotency-Key`.
- After provider recovers: retry failed payments only (status Failed/Cancelled), or ask customers to pay again for a new attempt.

### Rate limits
If legitimate traffic is blocked (429), temporarily raise:
- `RATE_LIMIT_PAYMENTS_INITIATE_PER_MIN`
- `RATE_LIMIT_PAYMENTS_STATUS_PER_MIN`

---

## 4. Contacts / escalation (fill when live)

| Role | Contact |
|------|---------|
| On-call eng | _TBD_ |
| Hosting / DNS | _TBD_ |
| MTN MoMo support | _TBD_ |
| Airtel Money support | _TBD_ |
