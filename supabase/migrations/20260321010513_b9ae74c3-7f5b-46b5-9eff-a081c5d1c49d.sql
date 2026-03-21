
-- Add prompt_template and qa_status columns to sprite_assets
ALTER TABLE public.sprite_assets 
  ADD COLUMN IF NOT EXISTS prompt_template text,
  ADD COLUMN IF NOT EXISTS qa_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS primary_color text;

-- Update existing seeded assets with their prompt templates
-- Units
UPDATE public.sprite_assets SET prompt_template = 'pixel art game 32x32 sprite sheet, armored footsoldier, battered plate chest piece, sword and shield stance, scarred face, stocky build' WHERE asset_key = 'unit_fighter';
UPDATE public.sprite_assets SET prompt_template = 'pixel art game 32x32 sprite sheet, hooded skirmisher, twin daggers low-ready, leather armor with bandolier, crouched alert posture, lithe build' WHERE asset_key = 'unit_rogue';
UPDATE public.sprite_assets SET prompt_template = 'pixel art game 32x32 sprite sheet, cloaked archer, longbow half-drawn, quiver on back, ranger hood, tall lean build, one knee slightly bent' WHERE asset_key = 'unit_ranger';
UPDATE public.sprite_assets SET prompt_template = 'pixel art game 32x32 sprite sheet, robed channeler, staff held vertically, runic glyphs faintly visible on robe, arcane glow at staff tip, thin build' WHERE asset_key = 'unit_mage';
UPDATE public.sprite_assets SET prompt_template = 'pixel art game 32x32 sprite sheet, armored support, mace at side, holy symbol on chest, determined expression, medium build, prayer beads at belt' WHERE asset_key = 'unit_cleric';
UPDATE public.sprite_assets SET prompt_template = 'pixel art game 32x32 sprite sheet, heavy defender, tower shield raised, one-handed axe, full plate, wide stance, broad build, visor down' WHERE asset_key = 'unit_warden';
UPDATE public.sprite_assets SET prompt_template = 'pixel art game 32x32 sprite sheet, dungeon grunt, crude leather armor, rusty short sword, hunched posture, yellow eyes, generic threat silhouette' WHERE asset_key = 'unit_enemy_basic';
UPDATE public.sprite_assets SET prompt_template = 'pixel art game 48x48 sprite sheet, monstrous warlord, exaggerated silhouette, asymmetric armor, glowing eyes, dominant center-frame presence' WHERE asset_key = 'unit_enemy_boss';

-- Portraits
UPDATE public.sprite_assets SET prompt_template = 'armored footsoldier, battered plate chest piece, sword and shield stance, scarred face, stocky build, gritty low-fantasy realism' WHERE asset_key = 'portrait_fighter';
UPDATE public.sprite_assets SET prompt_template = 'hooded skirmisher, twin daggers, leather armor with bandolier, crouched alert posture, lithe build, gritty low-fantasy realism' WHERE asset_key = 'portrait_rogue';
UPDATE public.sprite_assets SET prompt_template = 'cloaked archer, longbow, quiver on back, ranger hood, tall lean build, gritty low-fantasy realism' WHERE asset_key = 'portrait_ranger';
UPDATE public.sprite_assets SET prompt_template = 'robed channeler, staff held vertically, runic glyphs on robe, arcane glow at staff tip, thin build, gritty low-fantasy realism' WHERE asset_key = 'portrait_mage';
UPDATE public.sprite_assets SET prompt_template = 'armored support, mace at side, holy symbol on chest, determined expression, medium build, prayer beads, gritty low-fantasy realism' WHERE asset_key = 'portrait_cleric';
UPDATE public.sprite_assets SET prompt_template = 'heavy defender, tower shield, one-handed axe, full plate, wide stance, broad build, visor down, gritty low-fantasy realism' WHERE asset_key = 'portrait_warden';

-- Icons
UPDATE public.sprite_assets SET prompt_template = 'pixel art icon, gold coin, gleaming, simple round shape' WHERE asset_key = 'icon_gold';
UPDATE public.sprite_assets SET prompt_template = 'pixel art icon, arcane rune stone, glowing purple sigil' WHERE asset_key = 'icon_rune';
UPDATE public.sprite_assets SET prompt_template = 'pixel art icon, supply crate, wooden box with strap' WHERE asset_key = 'icon_supply';
UPDATE public.sprite_assets SET prompt_template = 'pixel art icon, rolled bandage, white linen wrap' WHERE asset_key = 'icon_bandage';

-- Backgrounds
UPDATE public.sprite_assets SET prompt_template = 'cramped guildmaster office interior, shelves of ledgers, maps pinned to wall, candle wax drips, vault door in shadows' WHERE asset_key = 'bg_guildhall';
UPDATE public.sprite_assets SET prompt_template = 'cramped quartermaster shop interior, shelves with labeled crates, hanging lanterns, gritty low-fantasy realism' WHERE asset_key = 'bg_office';

-- Tiles
UPDATE public.sprite_assets SET prompt_template = 'pixel art game tile texture, stone dungeon floor, worn gray flagstone, mortar lines, dark grout' WHERE asset_key = 'tile_stone_floor';
UPDATE public.sprite_assets SET prompt_template = 'pixel art game tile texture, dark oak wood floor, plank pattern, visible grain, worn surface' WHERE asset_key = 'tile_wood_floor';

-- ══════════════════════════════════════════════════════════════
-- NEW ASSETS FROM PDF (43 new entries)
-- ══════════════════════════════════════════════════════════════

-- Tiles (5 new)
INSERT INTO public.sprite_assets (asset_key, tier, unity_path, target_w, target_h, frame_count, ppu, filter_mode, prompt_template) VALUES
('tile_floor', 'tile', 'Sprites/Tiles/tile_floor', 16, 16, 1, 16, 'Point', 'pixel art game tile texture, stone dungeon floor, worn gray flagstone, mortar lines, dark grout'),
('tile_floor_alt', 'tile', 'Sprites/Tiles/tile_floor_alt', 16, 16, 1, 16, 'Point', 'pixel art game tile texture, alternate flagstone pattern, offset grout lines'),
('tile_wall', 'tile', 'Sprites/Tiles/tile_wall', 16, 16, 1, 16, 'Point', 'pixel art game tile texture, solid stone wall face, rough hewn, no mortar gaps'),
('tile_lava', 'tile', 'Sprites/Tiles/tile_lava', 32, 16, 2, 16, 'Point', 'pixel art game tile texture, glowing lava crack, animated, frame 0=dim, frame 1=bright pulse'),
('tile_poison', 'tile', 'Sprites/Tiles/tile_poison', 32, 16, 2, 16, 'Point', 'pixel art game tile texture, poison cloud wisps, sickly green fog, animated 2 frames'),
('tile_unstable', 'tile', 'Sprites/Tiles/tile_unstable', 16, 16, 1, 16, 'Point', 'pixel art game tile texture, cracked stone, stress fracture lines, ready to collapse'),
('tile_highground', 'tile', 'Sprites/Tiles/tile_highground', 16, 16, 1, 16, 'Point', 'pixel art game tile texture, raised stone platform edge, subtle elevation shadow');

-- Node icons (6 new)
INSERT INTO public.sprite_assets (asset_key, tier, unity_path, target_w, target_h, frame_count, ppu, filter_mode, prompt_template) VALUES
('node_fight', 'node', 'Sprites/Nodes/node_fight', 24, 24, 1, 24, 'Point', 'pixel art UI icon, two crossed swords, simple X silhouette, silver blades'),
('node_elite', 'node', 'Sprites/Nodes/node_elite', 24, 24, 1, 24, 'Point', 'pixel art UI icon, skull with crown, crown teeth visible above skull brow'),
('node_boss', 'node', 'Sprites/Nodes/node_boss', 24, 24, 1, 24, 'Point', 'pixel art UI icon, horned demon skull, larger horns than elite, red eye sockets'),
('node_loot', 'node', 'Sprites/Nodes/node_loot', 24, 24, 1, 24, 'Point', 'pixel art UI icon, open chest lid, gold coin silhouette inside, simple treasure chest shape'),
('node_rest', 'node', 'Sprites/Nodes/node_rest', 24, 24, 1, 24, 'Point', 'pixel art UI icon, campfire flame, three flame points, ember dots below'),
('node_mystery', 'node', 'Sprites/Nodes/node_mystery', 24, 24, 1, 24, 'Point', 'pixel art UI icon, question mark inside circle, parchment-colored fill');

-- Status effect icons (9 new)
INSERT INTO public.sprite_assets (asset_key, tier, unity_path, target_w, target_h, frame_count, ppu, filter_mode, prompt_template, primary_color) VALUES
('icon_status_burning', 'icon', 'Sprites/Icons/icon_status_burning', 16, 16, 1, 16, 'Point', 'pixel art status effect icon, upward flame shape, three points, ember at base', '#FF6020'),
('icon_status_poisoned', 'icon', 'Sprites/Icons/icon_status_poisoned', 16, 16, 1, 16, 'Point', 'pixel art status effect icon, skull-and-crossbones simplified, 2 bones crossing', '#308820'),
('icon_status_stunned', 'icon', 'Sprites/Icons/icon_status_stunned', 16, 16, 1, 16, 'Point', 'pixel art status effect icon, lightning bolt with circular stun stars around it', '#D2B428'),
('icon_status_slowed', 'icon', 'Sprites/Icons/icon_status_slowed', 16, 16, 1, 16, 'Point', 'pixel art status effect icon, downward arrow with hourglass shape', '#40AAFF'),
('icon_status_strengthened', 'icon', 'Sprites/Icons/icon_status_strengthened', 16, 16, 1, 16, 'Point', 'pixel art status effect icon, upward arrow on flexed arm silhouette', '#D93030'),
('icon_status_shielded', 'icon', 'Sprites/Icons/icon_status_shielded', 16, 16, 1, 16, 'Point', 'pixel art status effect icon, shield shape, solid fill with highlight line', '#7C4DFF'),
('icon_status_regenerating', 'icon', 'Sprites/Icons/icon_status_regenerating', 16, 16, 1, 16, 'Point', 'pixel art status effect icon, heart shape with small upward arrow', '#3CBE50'),
('icon_status_blinded', 'icon', 'Sprites/Icons/icon_status_blinded', 16, 16, 1, 16, 'Point', 'pixel art status effect icon, eye with X through it', '#9B9BA5'),
('icon_status_cursed', 'icon', 'Sprites/Icons/icon_status_cursed', 16, 16, 1, 16, 'Point', 'pixel art status effect icon, skull with dark aura, wavy shadow ring', '#C030C0');

-- Building upgrade icons (6 new)
INSERT INTO public.sprite_assets (asset_key, tier, unity_path, target_w, target_h, frame_count, ppu, filter_mode, prompt_template) VALUES
('upgrade_infirmary', 'node', 'Sprites/UI/upgrade_infirmary', 24, 24, 1, 24, 'Point', 'pixel art UI icon, medical cross with bandage wrap, healing station symbol'),
('upgrade_quartermaster', 'node', 'Sprites/UI/upgrade_quartermaster', 24, 24, 1, 24, 'Point', 'pixel art UI icon, supply crate with price tag, merchant shop symbol'),
('upgrade_rune_forge', 'node', 'Sprites/UI/upgrade_rune_forge', 24, 24, 1, 24, 'Point', 'pixel art UI icon, anvil with glowing rune, enchanting station symbol'),
('upgrade_library', 'node', 'Sprites/UI/upgrade_library', 24, 24, 1, 24, 'Point', 'pixel art UI icon, open book with arcane symbols, knowledge repository'),
('upgrade_chapel', 'node', 'Sprites/UI/upgrade_chapel', 24, 24, 1, 24, 'Point', 'pixel art UI icon, gothic arch window with holy light, chapel symbol'),
('upgrade_training_grounds', 'node', 'Sprites/UI/upgrade_training_grounds', 24, 24, 1, 24, 'Point', 'pixel art UI icon, crossed training swords with target dummy, training yard');

-- Faction emblems (4 new)
INSERT INTO public.sprite_assets (asset_key, tier, unity_path, target_w, target_h, frame_count, ppu, filter_mode, prompt_template) VALUES
('emblem_crown', 'node', 'Sprites/UI/emblem_crown', 24, 24, 1, 24, 'Point', 'pixel art emblem icon, royal crown, three-pointed gold crown on dark field, heraldic dark fantasy style'),
('emblem_registrar', 'node', 'Sprites/UI/emblem_registrar', 24, 24, 1, 24, 'Point', 'pixel art emblem icon, quill and scroll seal, bureaucratic authority symbol, heraldic dark fantasy style'),
('emblem_black_hand', 'node', 'Sprites/UI/emblem_black_hand', 24, 24, 1, 24, 'Point', 'pixel art emblem icon, black hand print, shadowy thieves guild mark, heraldic dark fantasy style'),
('emblem_void', 'node', 'Sprites/UI/emblem_void', 24, 24, 1, 24, 'Point', 'pixel art emblem icon, swirling void portal, eldritch cosmic eye, heraldic dark fantasy style');

-- Injury markers (3 new)
INSERT INTO public.sprite_assets (asset_key, tier, unity_path, target_w, target_h, frame_count, ppu, filter_mode, prompt_template, primary_color) VALUES
('injury_light', 'icon', 'Sprites/Icons/injury_light', 16, 16, 1, 16, 'Point', 'pixel art status marker icon, small scratch mark, single diagonal line, minor wound', '#D2B428'),
('injury_serious', 'icon', 'Sprites/Icons/injury_serious', 16, 16, 1, 16, 'Point', 'pixel art status marker icon, deep gash, two crossing wound lines, blood drops', '#FF6020'),
('injury_critical', 'icon', 'Sprites/Icons/injury_critical', 16, 16, 1, 16, 'Point', 'pixel art status marker icon, skull with bone crack, critical damage symbol, red glow', '#D93030');

-- Gear slot icons (7 new)
INSERT INTO public.sprite_assets (asset_key, tier, unity_path, target_w, target_h, frame_count, ppu, filter_mode, prompt_template) VALUES
('slot_head', 'node', 'Sprites/UI/slot_head', 24, 24, 1, 24, 'Point', 'pixel art UI icon, helmet silhouette, open-face medieval helm outline'),
('slot_chest', 'node', 'Sprites/UI/slot_chest', 24, 24, 1, 24, 'Point', 'pixel art UI icon, chest armor silhouette, breastplate outline'),
('slot_hands', 'node', 'Sprites/UI/slot_hands', 24, 24, 1, 24, 'Point', 'pixel art UI icon, gauntlet silhouette, armored glove outline'),
('slot_legs', 'node', 'Sprites/UI/slot_legs', 24, 24, 1, 24, 'Point', 'pixel art UI icon, greaves silhouette, leg armor outline'),
('slot_feet', 'node', 'Sprites/UI/slot_feet', 24, 24, 1, 24, 'Point', 'pixel art UI icon, boot silhouette, armored boot outline'),
('slot_weapon', 'node', 'Sprites/UI/slot_weapon', 24, 24, 1, 24, 'Point', 'pixel art UI icon, sword silhouette, single blade outline'),
('slot_offhand', 'node', 'Sprites/UI/slot_offhand', 24, 24, 1, 24, 'Point', 'pixel art UI icon, shield silhouette, round shield outline');
