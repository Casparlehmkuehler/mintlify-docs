-- Enable the http extension if not already enabled
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA public;

-- Create the function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  project_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Get the project URL and service role key from pg_catalog.pg_settings
  -- Note: You'll need to replace these with your actual values
  project_url := current_setting('app.settings.project_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- If settings are not configured, use placeholder values
  -- These should be set via SQL: SELECT set_config('app.settings.project_url', 'your-project-url', false);
  IF project_url IS NULL OR project_url = '' THEN
    project_url := 'https://your-project-ref.supabase.co';
  END IF;
  
  IF service_role_key IS NULL OR service_role_key = '' THEN
    RAISE EXCEPTION 'Service role key not configured. Run: SELECT set_config(''app.settings.service_role_key'', ''your-service-role-key'', false);';
  END IF;

  -- Call the Edge Function
  PERFORM
    http_post(
      url := project_url || '/functions/v1/send-welcome-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'type', 'INSERT',
        'table', 'users',
        'record', to_jsonb(NEW),
        'schema', 'auth'
      )
    );
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create a function to easily configure the settings
CREATE OR REPLACE FUNCTION public.configure_welcome_email_settings(
  p_project_url TEXT,
  p_service_role_key TEXT
)
RETURNS TEXT AS $$
BEGIN
  PERFORM set_config('app.settings.project_url', p_project_url, false);
  PERFORM set_config('app.settings.service_role_key', p_service_role_key, false);
  
  RETURN 'Welcome email settings configured successfully';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Instructions:
-- 1. After deploying this migration, run the following SQL to configure your settings:
-- SELECT public.configure_welcome_email_settings(
--   'https://your-project-ref.supabase.co',
--   'your-service-role-key'
-- );