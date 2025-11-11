-- Create user_environment_variables table
CREATE TABLE user_environment_variables (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- Constraints
    CONSTRAINT user_env_vars_name_pattern CHECK (name ~ '^[a-zA-Z_][a-zA-Z0-9_]*$'),
    CONSTRAINT user_env_vars_name_length CHECK (length(name) >= 1 AND length(name) <= 255),
    CONSTRAINT user_env_vars_value_length CHECK (length(value) <= 8192),
    
    -- Unique constraint to prevent duplicate variable names per user
    UNIQUE(user_id, name)
);

-- Create indexes for better performance
CREATE INDEX idx_user_environment_variables_user_id ON user_environment_variables(user_id);
CREATE INDEX idx_user_environment_variables_name ON user_environment_variables(name);
CREATE INDEX idx_user_environment_variables_updated_at ON user_environment_variables(updated_at);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_environment_variables_updated_at 
    BEFORE UPDATE ON user_environment_variables
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE user_environment_variables ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only access their own environment variables
CREATE POLICY "Users can view their own environment variables" 
    ON user_environment_variables FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own environment variables" 
    ON user_environment_variables FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own environment variables" 
    ON user_environment_variables FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own environment variables" 
    ON user_environment_variables FOR DELETE 
    USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT ALL ON user_environment_variables TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;