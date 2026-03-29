ALTER TABLE public.sprite_assets ADD COLUMN IF NOT EXISTS category text DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_sprite_assets_category ON public.sprite_assets (category);

UPDATE public.sprite_assets SET category = CASE
  WHEN asset_key LIKE 'gear_%' OR asset_key LIKE 'weapon_%' THEN 'gear'
  WHEN asset_key LIKE 'relic_%' THEN 'relic'
  WHEN asset_key LIKE 'status_%' THEN 'status'
  WHEN asset_key LIKE 'class_%' THEN 'class'
  WHEN asset_key LIKE 'faction_%' THEN 'faction'
  WHEN asset_key LIKE 'bg_%' THEN 'environment'
  WHEN asset_key LIKE 'port_%' THEN 'character'
  WHEN asset_key LIKE 'unit_%' OR asset_key LIKE 'mon_%' THEN 'creature'
  WHEN asset_key LIKE 'tile_%' THEN 'terrain'
  WHEN asset_key LIKE 'vfx_%' THEN 'vfx'
  WHEN asset_key LIKE 'ui_%' OR asset_key LIKE 'hud_%' THEN 'ui'
  WHEN asset_key LIKE 'node_%' THEN 'node'
  WHEN asset_key LIKE 'font_%' THEN 'font'
  WHEN asset_key LIKE 'img_%' OR asset_key LIKE 'logo_%' THEN 'marketing'
  WHEN asset_key LIKE 'res_%' THEN 'resource'
  WHEN asset_key LIKE 'inj_%' THEN 'injury'
  WHEN asset_key LIKE 'emblem_%' THEN 'emblem'
  WHEN asset_key LIKE 'slot_%' THEN 'slot'
  ELSE 'misc'
END
WHERE category IS NULL;