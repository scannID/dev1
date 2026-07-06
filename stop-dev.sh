#!/bin/bash

echo "🛑 Stopping Scanny Development Environment..."
echo ""

cd backend
docker compose down

echo ""
echo "✅ All services stopped!"
echo ""
echo "💡 To remove all data (volumes), run:"
echo "   cd backend && docker compose down -v"
echo ""
