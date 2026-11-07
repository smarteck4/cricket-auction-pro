ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS light_background_color text;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS dark_background_color text;