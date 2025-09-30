#!/bin/bash

# Dashboard Deployment Script
# Runs quality checks before deploying to Vercel production

set -e  # Exit on any error

echo "🚀 Starting dashboard deployment process..."

# Change to dashboard directory
cd "$(dirname "$0")"

echo "📍 Current directory: $(pwd)"

# Check if we're in the dashboard directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Make sure you're running this from the dashboard directory."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "🔍 Running TypeScript type checking..."
if ! npm run type-check; then
    echo "❌ TypeScript type check failed. Please fix type errors before deploying."
    exit 1
fi

echo "🧹 Running ESLint..."
if ! npm run lint; then
    echo "❌ Linting failed. Please fix linting errors before deploying."
    exit 1
fi

echo "🔨 Building project..."
if ! npm run build; then
    echo "❌ Build failed. Please fix build errors before deploying."
    exit 1
fi

echo "✅ All quality checks passed!"

echo "🚀 Deploying to Vercel production..."
if ! vercel --prod; then
    echo "❌ Vercel deployment failed."
    exit 1
fi

echo "🎉 Deployment completed successfully!"