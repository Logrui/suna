-- Create system_settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
    key text PRIMARY KEY,
    value jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read system settings (needed for maintenance check)
CREATE POLICY "Enable read access for all users" ON public.system_settings
    FOR SELECT
    USING (true);

-- Policy: Only admins can insert/update/delete
CREATE POLICY "Enable write access for admins" ON public.system_settings
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role IN ('admin', 'super_admin')
        )
    );

-- Insert default maintenance mode setting (disabled)
INSERT INTO public.system_settings (key, value)
VALUES ('maintenance_mode', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Grant permissions
GRANT SELECT ON public.system_settings TO anon, authenticated, service_role;
GRANT ALL ON public.system_settings TO service_role;
