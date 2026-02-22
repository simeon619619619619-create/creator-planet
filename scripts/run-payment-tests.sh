#!/bin/bash

echo "🧪 Creator Club Payment E2E Tests"
echo "================================="

# Check if .env.test exists
if [ ! -f .env.test ]; then
  echo "❌ Error: .env.test not found"
  echo "Please create .env.test with test credentials"
  exit 1
fi

# Run auth setup first
echo ""
echo "1️⃣ Setting up authentication..."
npx playwright test auth.setup.ts

if [ $? -ne 0 ]; then
  echo "❌ Auth setup failed"
  exit 1
fi

echo "✅ Auth setup complete"

# Run all payment tests
echo ""
echo "2️⃣ Running payment tests..."
npx playwright test --project=creator-payments --project=student-payments

# Show results
echo ""
echo "3️⃣ Test Results"
npx playwright show-report --host 0.0.0.0
