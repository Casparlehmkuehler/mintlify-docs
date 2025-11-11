#!/bin/bash

echo "🚀 Setting up Welcome Email System"
echo "=================================="
echo ""

echo "Please provide your SMTP configuration:"
echo ""

read -p "SMTP Hostname (e.g., smtp.gmail.com): " SMTP_HOSTNAME
read -p "SMTP Port (default: 587): " SMTP_PORT
SMTP_PORT=${SMTP_PORT:-587}

read -p "SMTP Username: " SMTP_USERNAME
read -s -p "SMTP Password: " SMTP_PASSWORD
echo ""

read -p "From Email Address: " SMTP_FROM_EMAIL
read -p "App URL (e.g., https://yourapp.com): " APP_URL

echo ""
echo "Setting Supabase secrets..."

supabase secrets set SMTP_HOSTNAME="$SMTP_HOSTNAME"
supabase secrets set SMTP_PORT="$SMTP_PORT"
supabase secrets set SMTP_USERNAME="$SMTP_USERNAME"
supabase secrets set SMTP_PASSWORD="$SMTP_PASSWORD"
supabase secrets set SMTP_FROM_EMAIL="$SMTP_FROM_EMAIL"
supabase secrets set APP_URL="$APP_URL"

echo ""
echo "✅ Secrets configured successfully!"
echo ""
echo "Next steps:"
echo "1. Deploy the Edge Function: supabase functions deploy send-welcome-email"
echo "2. Configure the auth hook in your Supabase dashboard"
echo "3. Test the system by creating a new user"