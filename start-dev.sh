#!/bin/bash

echo "🚀 Starting Scanny Development Environment..."
echo ""

# Start Docker services (PostgreSQL + Keycloak)
echo "📦 Starting PostgreSQL and Keycloak..."
cd backend
docker compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check if PostgreSQL is ready
echo "🗄️  Checking PostgreSQL..."
until docker exec scanit-postgres pg_isready -U scanit > /dev/null 2>&1; do
  echo "   Waiting for PostgreSQL..."
  sleep 2
done
echo "✅ PostgreSQL is ready!"

# Check if Keycloak is ready
echo "🔐 Checking Keycloak..."
until curl -s http://localhost:8080 > /dev/null; do
  echo "   Waiting for Keycloak..."
  sleep 3
done
echo "✅ Keycloak is ready!"

# Test PostgreSQL connection
echo ""
echo "🔌 Testing database connection..."
DB_EXISTS=$(docker exec scanit-postgres psql -U scanit -lqt 2>/dev/null | cut -d \| -f 1 | grep -w scanit | wc -l | tr -d ' ')
if [ "$DB_EXISTS" -gt 0 ]; then
    echo "✅ Database 'scanit' is accessible"
else
    echo "⚠️  Database 'scanit' not found (will be created on first backend run)"
fi

echo ""
echo "✅ All services started successfully!"
echo ""
echo "🌐 URLs:"
echo "   PostgreSQL:     localhost:5432 (scanit / scanit)"
echo "   Keycloak Admin: http://localhost:8080/admin (admin / admin)"
echo "   Backend API:    http://localhost:4000 (not started yet)"
echo "   Main App:       http://localhost:5173 (not started yet)"
echo "   Admin Console:  http://localhost:5174 (not started yet)"
echo ""
echo "🔑 Default Users:"
echo "   Main App:  testuser / password"
echo "   Admin:     admin / admin123"
echo ""
echo "📖 Next steps:"
echo "   1. Configure Keycloak clients (see KEYCLOAK_QUICK_START.md)"
echo "   2. Run: cd backend && ./mvnw spring-boot:run"
echo "   3. Run: npm run dev"
echo "   4. Run: cd admin-console && npm run dev"
echo ""
echo "💡 Test PostgreSQL: ./test-postgres.sh"
echo ""
