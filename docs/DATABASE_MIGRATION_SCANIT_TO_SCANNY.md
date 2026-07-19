# Database migration to Scanny

The current Compose configuration uses `scanny` for both the PostgreSQL
database and user. Existing local volumes keep the names created when the
volume was initialized, so changing environment variables alone does not
rename an existing database.

## Recreate local data

Use this when local data can be discarded:

```bash
docker compose down -v
docker compose up -d
```

This permanently removes the local PostgreSQL and Redis volume data before
creating clean Scanny volumes.

## Preserve and rename the database

Back up PostgreSQL first. Connect to a different database, such as `postgres`,
terminate sessions using the legacy `scanit` database, and rename it:

```sql
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'scanit' AND pid <> pg_backend_pid();

ALTER DATABASE scanit RENAME TO scanny;
```

If the PostgreSQL role also has the old name, create or rename a `scanny` role,
transfer ownership as needed, and set `POSTGRES_USER=scanny` in the environment.
Restart the API after updating its connection settings.
