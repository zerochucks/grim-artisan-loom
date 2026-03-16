-- Create palettes table
CREATE TABLE public.palettes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  colors TEXT[] NOT NULL,
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.palettes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read built-in palettes"
  ON public.palettes FOR SELECT
  USING (is_builtin = true);

CREATE POLICY "Users can read own palettes"
  ON public.palettes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own palettes"
  ON public.palettes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own palettes"
  ON public.palettes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own palettes"
  ON public.palettes FOR DELETE
  USING (auth.uid() = user_id);

-- Create assets table
CREATE TABLE public.assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  palette_id UUID REFERENCES public.palettes(id),
  grid_data JSONB,
  image_url TEXT,
  style_modifiers TEXT[] DEFAULT '{}',
  generation_mode TEXT NOT NULL DEFAULT 'forge',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own assets"
  ON public.assets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own assets"
  ON public.assets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own assets"
  ON public.assets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own assets"
  ON public.assets FOR DELETE
  USING (auth.uid() = user_id);

-- Create projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  default_resolution_w INTEGER DEFAULT 48,
  default_resolution_h INTEGER DEFAULT 64,
  default_palette_id UUID REFERENCES public.palettes(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own projects"
  ON public.projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON public.projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
  ON public.projects FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_assets_user_id ON public.assets(user_id);
CREATE INDEX idx_assets_asset_type ON public.assets(asset_type);
CREATE INDEX idx_assets_created_at ON public.assets(created_at DESC);
CREATE INDEX idx_palettes_user_id ON public.palettes(user_id);
CREATE INDEX idx_palettes_builtin ON public.palettes(is_builtin);

-- Create storage bucket for pixel assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('pixel-assets', 'pixel-assets', false);

CREATE POLICY "Users can upload own pixel assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'pixel-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can read own pixel assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pixel-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own pixel assets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'pixel-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Seed built-in palettes
INSERT INTO public.palettes (user_id, name, description, colors, is_builtin) VALUES
(NULL, 'Blightborne', 'Core grimdark. The default.', ARRAY['#0a0a0f','#1a1420','#2d1b2e','#3d2040','#5c3a50','#8b6070','#c49888','#e8ccb0','#7a3b1e','#c45c2e','#f28b30','#ffd166','#3a506b','#5bc0be','#2d6a4f','#52b788'], true),
(NULL, 'Crimson Sanctum', 'Blood-heavy, altar reds.', ARRAY['#0a0a0a','#1a0a0a','#2d0e0e','#4a1717','#7a2020','#b03030','#e04040','#ff6b6b','#ffd166','#3c1518','#69140e','#a44200','#d4770c','#4a3000','#2b2d42','#e8d5c4'], true),
(NULL, 'Stonevault', 'Cold dungeon stone, iron grey.', ARRAY['#0b0c10','#1a1c24','#2b2d38','#3e4250','#5a6070','#7d8494','#a0a8b8','#c8d0dc','#6b4226','#a67c52','#d4a373','#e63946','#1d3557','#457b9d','#704214','#ffefd5'], true),
(NULL, 'Candlewick', 'Warm torchlight, golden-amber.', ARRAY['#0f0e17','#1a1520','#2b1e28','#4a3530','#6b4a38','#8b6848','#b08860','#d4a878','#f0cc90','#fff3c8','#7a3b1e','#c45c2e','#ef233c','#3d2040','#5c3a50','#2d2d2d'], true),
(NULL, 'Moonsorrow', 'Cold moonlit purples, undead vibes.', ARRAY['#0a0a12','#12101e','#1e1830','#2e2548','#443868','#6a5090','#9070b8','#b898d8','#e0c8f0','#f0e8ff','#5c3a50','#e63946','#ff8c42','#ffd166','#2b2d42','#8d99ae'], true),
(NULL, 'Ironblood', 'Warfare. Steel and crimson.', ARRAY['#0a0a0a','#1a1a1e','#2d2d34','#44444e','#5e6070','#808898','#a0aab8','#c0ccd8','#e0e8f0','#ffffff','#4a1717','#7a2020','#b03030','#e04040','#8b6848','#d4a373'], true),
(NULL, 'Rotwood', 'Swamp, decay, poison green.', ARRAY['#0a0f0a','#141e14','#1e2e1a','#2d4020','#3e5830','#507040','#6b8850','#88a868','#a8c888','#d0e8b0','#4a3000','#704214','#a0522d','#d4770c','#3d2040','#7a2020'], true),
(NULL, 'Abyssal', 'Deep ocean, eldritch horror.', ARRAY['#050510','#0a0a1e','#101030','#181848','#202060','#283880','#3050a0','#4070c0','#60a0e0','#a0d8ff','#1a4040','#2d6a4f','#e63946','#ffd166','#3d2040','#6a5090'], true);
