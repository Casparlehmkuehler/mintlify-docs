# Welcome Email System Setup Guide

This guide walks you through setting up an automated welcome email system using Supabase Auth Hooks and Edge Functions.

## Overview

When a new user signs up, a Supabase Edge Function automatically sends them a welcome email via SMTP. The system includes:

- **Edge Function**: `send-welcome-email` - Handles email sending via SMTP
- **Database Trigger**: Automatically triggers when new users are created
- **SMTP Integration**: Supports Gmail, SendGrid, Mailgun, AWS SES, and others

## Quick Setup

### 1. Configure SMTP Settings

Run the interactive setup script:

```bash
./setup-welcome-email.sh
```

Or manually set the secrets:

```bash
supabase secrets set SMTP_HOSTNAME=smtp.gmail.com
supabase secrets set SMTP_PORT=587
supabase secrets set SMTP_USERNAME=your-email@gmail.com
supabase secrets set SMTP_PASSWORD=your-app-password
supabase secrets set SMTP_FROM_EMAIL=noreply@yourapp.com
supabase secrets set APP_URL=https://yourapp.com
```

### 2. Deploy the Edge Function

```bash
supabase functions deploy send-welcome-email
```

### 3. Set Up Database Trigger

Option A: Run the migration:
```bash
supabase db push
```

Option B: Execute the SQL directly in your Supabase dashboard.

### 4. Configure Project Settings

After deploying, configure your project settings:

```sql
SELECT public.configure_welcome_email_settings(
  'https://your-project-ref.supabase.co',
  'your-service-role-key'
);
```

## SMTP Provider Configuration

### Gmail (Recommended for Testing)
```bash
SMTP_HOSTNAME=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password  # Generate an App Password
```

**Setup App Password:**
1. Go to Google Account settings
2. Security → 2-Step Verification → App passwords
3. Generate a new app password for "Mail"

### SendGrid
```bash
SMTP_HOSTNAME=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USERNAME=apikey
SMTP_PASSWORD=your-sendgrid-api-key
```

### Mailgun
```bash
SMTP_HOSTNAME=smtp.mailgun.org
SMTP_PORT=587
SMTP_USERNAME=your-mailgun-smtp-username
SMTP_PASSWORD=your-mailgun-smtp-password
```

### AWS SES
```bash
SMTP_HOSTNAME=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USERNAME=your-ses-smtp-username
SMTP_PASSWORD=your-ses-smtp-password
```

## Testing

Test the system by creating a new user:

```javascript
const { data, error } = await supabase.auth.signUp({
  email: 'test@example.com',
  password: 'securepassword123',
  options: {
    data: {
      full_name: 'John Doe'
    }
  }
})
```

## Troubleshooting

### Check Edge Function Logs
```bash
supabase functions logs send-welcome-email
```

### Test Function Directly
Use the Supabase dashboard to invoke the function manually with test data.

### Common Issues

1. **SMTP Authentication Failed**
   - For Gmail: Use App Password, not regular password
   - Check username/password are correct
   - Verify SMTP hostname and port

2. **Function Not Triggered**
   - Check if trigger is properly created: `SELECT * FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created';`
   - Verify project settings are configured

3. **Missing Environment Variables**
   - Check secrets are set: `supabase secrets list`
   - Ensure all required variables are present

## Email Template Customization

The email template is defined in `supabase/functions/send-welcome-email/index.ts`. Customize the HTML content in the `emailContent` variable to match your brand.

## Security Considerations

- Never commit SMTP passwords to version control
- Use app-specific passwords for email providers
- Store sensitive data in Supabase secrets, not environment files
- The Edge Function runs with restricted permissions

## Files Created

- `supabase/functions/send-welcome-email/index.ts` - Edge Function code
- `supabase/migrations/20241009_setup_welcome_email_hook.sql` - Database migration
- `setup-welcome-email.sh` - Interactive setup script
- `.env.example` - Environment variables template
- `WELCOME_EMAIL_SETUP.md` - This documentation file