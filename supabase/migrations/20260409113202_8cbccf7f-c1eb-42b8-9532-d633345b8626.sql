ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS source_asset_key text;