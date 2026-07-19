# Running Scanny Backend on Windows (Without Docker)

Since Docker may not work reliably on your Windows machine, here are alternative ways to run the backend.

## Option 1: Native PostgreSQL (Recommended for Production-like Setup)

### 1. Install PostgreSQL
- Download from: https://www.postgresql.org/download/windows/
- Run the installer (PostgreSQL 16 recommended)
- Set a password for the `postgres` user during installation
- Keep default port (5432)

### 2. Create Database
Open **pgAdmin** (installed with PostgreSQL) or use **psql** command line:

```sql
CREATE DATABASE scanit;
CREATE USER scanit WITH PASSWORD 'scanit';
GRANT ALL PRIVILEGES ON DATABASE scanit TO scanit;
```

### 3. Run the Backend
```bash
cd backend
mvnw.cmd spring-boot:run
```

The backend will automatically connect to PostgreSQL at `localhost:5432`.

---

## Option 2: H2 Database (Zero Installation - File-based)

Use the embedded H2 database that requires no separate installation.

### Run with H2 Profile
```bash
cd backend
mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=h2
```

Or set environment variable:
```bash
set SPRING_PROFILES_ACTIVE=h2
mvnw.cmd spring-boot:run
```

### H2 Console
Access the H2 web console at: http://localhost:4000/h2-console

**Connection settings:**
- JDBC URL: `jdbc:h2:file:./data/scanit`
- Username: `sa`
- Password: (leave empty)

### Data Persistence
- Database is stored in `backend/data/scanit.mv.db`
- Delete this file to reset the database

---

## Option 3: Use Maven Wrapper (Works on both Mac & Windows)

The project includes Maven wrapper scripts so you don't need Maven installed:

**On Windows:**
```bash
backend\mvnw.cmd spring-boot:run
```

**On Mac/Linux:**
```bash
backend/./mvnw spring-boot:run
```

---

## Checking if Backend is Running

Open your browser and visit:
```
http://localhost:4000/health
```

You should see a health status response.

---

## Troubleshooting

### PostgreSQL Connection Issues
1. Check if PostgreSQL service is running (Windows Services)
2. Verify port 5432 is not blocked by firewall
3. Check `application.yml` has correct credentials

### Java Version Issues
Ensure you have Java 21 installed:
```bash
java -version
```

If not, download from: https://adoptium.net/

### Port 4000 Already in Use
Edit `application.yml` and change:
```yaml
server:
  port: 4001  # Or any free port
```

---

## Keycloak Setup (Optional - For Admin Console)

If you need Keycloak for authentication, you'll need to:
1. Install Java 21
2. Download Keycloak: https://www.keycloak.org/downloads
3. Extract and run: `bin\kc.bat start-dev --http-port=8080`

Or use a cloud-hosted Keycloak instance instead.
