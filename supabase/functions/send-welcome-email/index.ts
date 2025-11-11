import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UserRecord {
  id: string
  email: string
  user_metadata?: {
    full_name?: string
    name?: string
  }
  created_at: string
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: UserRecord
  schema: string
}

async function sendWelcomeEmail(user: UserRecord) {
  const smtpHostname = Deno.env.get('SMTP_HOSTNAME')
  const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '587')
  const smtpUsername = Deno.env.get('SMTP_USERNAME')
  const smtpPassword = Deno.env.get('SMTP_PASSWORD')
  const fromEmail = Deno.env.get('SMTP_FROM_EMAIL')
  const appUrl = Deno.env.get('APP_URL') || 'https://yourapp.com'

  if (!smtpHostname || !smtpUsername || !smtpPassword || !fromEmail) {
    throw new Error('Missing required SMTP configuration')
  }

  const fullName = user.user_metadata?.full_name || user.user_metadata?.name || 'there'
  
  const client = new SmtpClient()
  
  await client.connectTLS({
    hostname: smtpHostname,
    port: smtpPort,
    username: smtpUsername,
    password: smtpPassword,
  })

  const emailContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome to Our Platform!</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px; }
    .content { padding: 20px 0; }
    .button { 
      display: inline-block; 
      background: #007bff; 
      color: white; 
      padding: 12px 24px; 
      text-decoration: none; 
      border-radius: 5px; 
      margin: 20px 0; 
    }
    .footer { text-align: center; color: #666; font-size: 14px; margin-top: 40px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to Our Platform! 🎉</h1>
    </div>
    <div class="content">
      <h2>Hi ${fullName}!</h2>
      <p>Thanks for signing up! We're excited to have you on board.</p>
      <p>Your account has been successfully created and you can now access all our features.</p>
      <p>Get started by exploring your dashboard:</p>
      <a href="${appUrl}/dashboard" class="button">Go to Dashboard</a>
      <p>If you have any questions, feel free to reach out to our support team.</p>
      <p>Best regards,<br>The Team</p>
    </div>
    <div class="footer">
      <p>This email was sent because you created an account. If you didn't sign up, please ignore this email.</p>
    </div>
  </div>
</body>
</html>
  `.trim()

  await client.send({
    from: fromEmail,
    to: user.email,
    subject: "Welcome to Our Platform!",
    content: emailContent,
    html: emailContent,
  })

  await client.close()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload: WebhookPayload = await req.json()
    
    console.log('Received webhook payload:', JSON.stringify(payload, null, 2))
    
    if (payload.type !== 'INSERT' || payload.table !== 'users') {
      return new Response(
        JSON.stringify({ message: 'Not a user insert event' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    await sendWelcomeEmail(payload.record)
    
    return new Response(
      JSON.stringify({ 
        message: 'Welcome email sent successfully',
        user_id: payload.record.id 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Error sending welcome email:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to send welcome email',
        details: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
