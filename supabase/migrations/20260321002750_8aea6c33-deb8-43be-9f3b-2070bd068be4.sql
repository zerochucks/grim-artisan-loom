CREATE TABLE public.sprite_assets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_key       text NOT NULL UNIQUE,
  tier            text NOT NULL,
  unity_path      text NOT NULL,
  target_w        int NOT NULL,
  target_h        int NOT NULL,
  frame_count     int NOT NULL DEFAULT 1,
  ppu             int NOT NULL,
  filter_mode     text NOT NULL DEFAULT 'Point',
  storage_url     text,
  approved        bool NOT NULL DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.sprite_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read sprite_assets"
ON public.sprite_assets FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert sprite_assets"
ON public.sprite_assets FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update sprite_assets"
ON public.sprite_assets FOR UPDATE
TO authenticated
USING (true);

INSERT INTO public.sprite_assets (asset_key, tier, unity_path, target_w, target_h, frame_count, ppu) VALUES
('unit_fighter',      'unit',       'Sprites/Units/unit_fighter',      320, 32, 10, 32),
('unit_rogue',        'unit',       'Sprites/Units/unit_rogue',        320, 32, 10, 32),
('unit_ranger',       'unit',       'Sprites/Units/unit_ranger',       320, 32, 10, 32),
('unit_mage',         'unit',       'Sprites/Units/unit_mage',         320, 32, 10, 32),
('unit_cleric',       'unit',       'Sprites/Units/unit_cleric',       320, 32, 10, 32),
('unit_warden',       'unit',       'Sprites/Units/unit_warden',       320, 32, 10, 32),
('unit_enemy_basic',  'unit',       'Sprites/Units/unit_enemy_basic',  320, 32, 10, 32),
('unit_enemy_boss',   'unit',       'Sprites/Units/unit_enemy_boss',   480, 48, 10, 32),
('portrait_fighter',  'portrait',   'Sprites/Portraits/portrait_fighter',  48, 64, 1, 32),
('portrait_rogue',    'portrait',   'Sprites/Portraits/portrait_rogue',    48, 64, 1, 32),
('portrait_ranger',   'portrait',   'Sprites/Portraits/portrait_ranger',   48, 64, 1, 32),
('portrait_mage',     'portrait',   'Sprites/Portraits/portrait_mage',     48, 64, 1, 32),
('portrait_cleric',   'portrait',   'Sprites/Portraits/portrait_cleric',   48, 64, 1, 32),
('portrait_warden',   'portrait',   'Sprites/Portraits/portrait_warden',   48, 64, 1, 32),
('icon_gold',         'icon',       'Sprites/Icons/icon_gold',         16, 16, 1, 16),
('icon_rune',         'icon',       'Sprites/Icons/icon_rune',         16, 16, 1, 16),
('icon_supply',       'icon',       'Sprites/Icons/icon_supply',       16, 16, 1, 16),
('icon_bandage',      'icon',       'Sprites/Icons/icon_bandage',      16, 16, 1, 16),
('bg_guildhall',      'background', 'Sprites/Backgrounds/bg_guildhall', 960, 540, 1, 1),
('bg_office',         'background', 'Sprites/Backgrounds/bg_office',    960, 540, 1, 1),
('tile_stone_floor',  'tile',       'Sprites/Tiles/tile_stone_floor',  32, 32, 1, 32),
('tile_wood_floor',   'tile',       'Sprites/Tiles/tile_wood_floor',   32, 32, 1, 32);