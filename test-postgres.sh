#!/bin/bash

echo "🔍 Testing PostgreSQL Connection..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

# Check if PostgreSQL container exists
if ! docker ps -a | grep -q scanit-postgres; then
    echo "❌ PostgreSQL container not found."
    echo "💡 Run: cd backend && docker compose up -d postgres"
    exit 1
fi

# Check if PostgreSQL container is running
if ! docker ps | grep -q scanit-postgres; then
    echo "❌ PostgreSQL container is not running."
    echo "💡 Run: cd backend && docker compose up -d postgres"
    exit 1
fi

echo "✅ PostgreSQL container is running"
echo ""

# Test connection
echo "🔌 Testing database connection..."
if docker exec scanit-postgres pg_isready -U scanit > /dev/null 2>&1; then
    echo "✅ PostgreSQL is accepting connections"
else
    echo "❌ PostgreSQL is not ready yet. Wait a few seconds and try again."
    exit 1
fi

echo ""
echo "📊 Checking database..."
DB_EXISTS=$(docker exec scanit-postgres psql -U scanit -lqt | cut -d \| -f 1 | grep -w scanit | wc -l)

if [ "$DB_EXISTS" -gt 0 ]; then
    echo "✅ Database 'scanit' exists"
else
    echo "❌ Database 'scanit' does not exist"
    exit 1
fi

echo ""
echo "📋 Checking tables..."
TABLES=$(docker exec scanit-postgres psql -U scanit -d scanit -c "\dt" -t 2>/dev/null | grep -c "public")

if [ "$TABLES" -gt 0 ]; then
    echo "✅ Found $TABLES tables"
    echo ""
    echo "Tables:"
    docker exec scanit-postgres psql -U scanit -d scanit -c "\dt" 2>/dev/null
else
    echo "⚠️  No tables found. Run the backend to apply migrations:"
    echo "   cd backend && ./mvnw spring-boot:run"
fi

echo ""
echo "👥 Checking sample data..."
BUSINESS_COUNT=$(docker exec scanit-postgres psql -U scanit -d scanit -t -c "SELECT COUNT(*) FROM businesses" 2>/dev/null | tr -d ' ')

if [ "$BUSINESS_COUNT" -gt 0 ]; then
    echo "✅ Found $BUSINESS_COUNT businesses"
    echo ""
    echo "Businesses:"
    docker exec scanit-postgres psql -U scanit -d scanit -c "SELECT id, name, type FROM businesses" 2>/dev/null
else
    echo "⚠️  No sample data found. Run the backend to load seed data:"
    echo "   cd backend && ./mvnw spring-boot:run"
fi

echo ""
echo "🎯 Connection String:"
echo "   jdbc:postgresql://localhost:5432/scanit"
echo ""
echo "📝 Credentials:"
echo "   Username: scanit"
echo "   Password: scanit"
echo ""
echo "✅ PostgreSQL connection test complete!"
echo ""
echo "💡 Next steps:"
echo "   1. Start backend: cd backend && ./mvnw spring-boot:run"
echo "   2. Test API: curl http://localhost:4000/api/businesses"
echo ""
