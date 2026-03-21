/**
 * Production Sprite Specification System
 *
 * Canonical source of truth for all game assets — consumed by the generator,
 * post-processing pipeline, and Unity importer.
 */

// ─── TYPES ────────────────────────────────────────────────────────

export type AssetTier = 'background' | 'portrait' | 'unit' | 'icon' | 'tile' | 'node';
export type AnimationState = 'idle' | 'attack' | 'death';

export interface SpriteSpec {
  tier:         AssetTier;
  assetKey:     string;          // e.g. "unit_fighter", "portrait_rogue"
  targetW:      number;          // final pixel width
  targetH:      number;          // final pixel height
  frameCount:   number;          // 1 for statics, 10 for animated units
  ppu:          number;          // Unity Pixels Per Unit
  paletteHex:   string[];        // canonical palette
  unityPath:    string;          // Resources.Load path
  filterMode:   'Point' | 'Bilinear';
  materialTag?: 'cloth' | 'metal' | 'organic' | 'stone'; // material hint for post-processing
}

export interface SpriteMetadata {
  assetKey:     string;
  tier:         AssetTier;
  unityPath:    string;
  targetW:      number;
  targetH:      number;
  frameCount:   number;
  ppu:          number;
  filterMode:   string;
  frameW?:      number;          // single frame width for spritesheets
  frameH?:      number;
}

// ─── CANONICAL 24-COLOR PALETTE ───────────────────────────────────

export const PALETTE_24 = [
  '#0C0C14', '#1E1E2A', '#303040', '#4A4A5C',   // base darks
  '#7C4DFF', '#4E3099', '#8870FF', '#40AAFF', '#20CCCC', // player/magic
  '#D93030', '#8C1C1C', '#C030C0', '#700070',   // enemy
  '#3CBE50', '#D2B428', '#BE3232',              // health/status
  '#FF6020', '#803818', '#308820', '#204818',   // hazards/nature
  '#C89050', '#D4A070', '#A07040',             // materials/skin
  '#FFFFFF',                                    // highlight
] as const;

// ─── SPRITE SPECS ─────────────────────────────────────────────────

function makeSpec(
  tier: AssetTier,
  assetKey: string,
  targetW: number,
  targetH: number,
  frameCount: number,
  ppu: number,
  unityFolder: string,
  materialTag?: SpriteSpec['materialTag'],
): SpriteSpec {
  return {
    tier,
    assetKey,
    targetW,
    targetH,
    frameCount,
    ppu,
    paletteHex: tier === 'background' ? [] : [...PALETTE_24],
    unityPath: `${unityFolder}/${assetKey}`,
    filterMode: tier === 'background' ? 'Bilinear' : 'Point',
    ...(materialTag ? { materialTag } : {}),
  };
}

export const SPRITE_SPECS: Record<string, SpriteSpec> = {
  // ── Units (spritesheet: frameCount × targetH per frame) ────────
  unit_fighter:      makeSpec('unit',       'unit_fighter',      320, 32, 10, 32, 'Sprites/Units'),
  unit_rogue:        makeSpec('unit',       'unit_rogue',        320, 32, 10, 32, 'Sprites/Units'),
  unit_ranger:       makeSpec('unit',       'unit_ranger',       320, 32, 10, 32, 'Sprites/Units'),
  unit_mage:         makeSpec('unit',       'unit_mage',         320, 32, 10, 32, 'Sprites/Units'),
  unit_cleric:       makeSpec('unit',       'unit_cleric',       320, 32, 10, 32, 'Sprites/Units'),
  unit_warden:       makeSpec('unit',       'unit_warden',       320, 32, 10, 32, 'Sprites/Units'),
  unit_enemy_basic:  makeSpec('unit',       'unit_enemy_basic',  320, 32, 10, 32, 'Sprites/Units'),
  unit_enemy_boss:   makeSpec('unit',       'unit_enemy_boss',   480, 48, 10, 32, 'Sprites/Units'),

  // ── Portraits (single frame) ───────────────────────────────────
  portrait_fighter:  makeSpec('portrait',   'portrait_fighter',  48,  64, 1, 32, 'Sprites/Portraits'),
  portrait_rogue:    makeSpec('portrait',   'portrait_rogue',    48,  64, 1, 32, 'Sprites/Portraits'),
  portrait_ranger:   makeSpec('portrait',   'portrait_ranger',   48,  64, 1, 32, 'Sprites/Portraits'),
  portrait_mage:     makeSpec('portrait',   'portrait_mage',     48,  64, 1, 32, 'Sprites/Portraits'),
  portrait_cleric:   makeSpec('portrait',   'portrait_cleric',   48,  64, 1, 32, 'Sprites/Portraits'),
  portrait_warden:   makeSpec('portrait',   'portrait_warden',   48,  64, 1, 32, 'Sprites/Portraits'),

  // ── Icons (16×16) ──────────────────────────────────────────────
  icon_gold:         makeSpec('icon',       'icon_gold',         16,  16, 1, 16, 'Sprites/Icons'),
  icon_rune:         makeSpec('icon',       'icon_rune',         16,  16, 1, 16, 'Sprites/Icons'),
  icon_supply:       makeSpec('icon',       'icon_supply',       32,  32, 1, 16, 'Sprites/Icons', 'cloth'),
  icon_supply_sm:    makeSpec('icon',       'icon_supply_sm',    16,  16, 1, 16, 'Sprites/Icons', 'cloth'),
  icon_bandage:      makeSpec('icon',       'icon_bandage',      32,  32, 1, 16, 'Sprites/Icons', 'cloth'),
  icon_bandage_sm:   makeSpec('icon',       'icon_bandage_sm',   16,  16, 1, 16, 'Sprites/Icons', 'cloth'),

  // ── Status effect icons (16×16) ────────────────────────────────
  icon_status_burning:       makeSpec('icon', 'icon_status_burning',       16, 16, 1, 16, 'Sprites/Icons'),
  icon_status_poisoned:      makeSpec('icon', 'icon_status_poisoned',      16, 16, 1, 16, 'Sprites/Icons'),
  icon_status_stunned:       makeSpec('icon', 'icon_status_stunned',       16, 16, 1, 16, 'Sprites/Icons'),
  icon_status_slowed:        makeSpec('icon', 'icon_status_slowed',        16, 16, 1, 16, 'Sprites/Icons'),
  icon_status_strengthened:  makeSpec('icon', 'icon_status_strengthened',  16, 16, 1, 16, 'Sprites/Icons'),
  icon_status_shielded:      makeSpec('icon', 'icon_status_shielded',      16, 16, 1, 16, 'Sprites/Icons'),
  icon_status_regenerating:  makeSpec('icon', 'icon_status_regenerating',  16, 16, 1, 16, 'Sprites/Icons'),
  icon_status_blinded:       makeSpec('icon', 'icon_status_blinded',       16, 16, 1, 16, 'Sprites/Icons'),
  icon_status_cursed:        makeSpec('icon', 'icon_status_cursed',        16, 16, 1, 16, 'Sprites/Icons'),

  // ── Resource / state icons ─────────────────────────────────────
  icon_stamina:              makeSpec('icon', 'icon_stamina',              16, 16, 1, 16, 'Sprites/Icons'),
  icon_hunger:               makeSpec('icon', 'icon_hunger',               16, 16, 1, 16, 'Sprites/Icons'),
  icon_ration:               makeSpec('icon', 'icon_ration',               32, 32, 1, 16, 'Sprites/Icons', 'cloth'),
  icon_ration_sm:            makeSpec('icon', 'icon_ration_sm',            16, 16, 1, 16, 'Sprites/Icons', 'cloth'),
  icon_provisions:           makeSpec('icon', 'icon_provisions',           32, 32, 1, 16, 'Sprites/Icons', 'cloth'),
  icon_provisions_sm:        makeSpec('icon', 'icon_provisions_sm',        16, 16, 1, 16, 'Sprites/Icons', 'cloth'),
  icon_rest:                 makeSpec('icon', 'icon_rest',                 16, 16, 1, 16, 'Sprites/Icons'),

  // ── Injury markers (16×16) ─────────────────────────────────────
  injury_light:    makeSpec('icon', 'injury_light',    16, 16, 1, 16, 'Sprites/Icons'),
  injury_serious:  makeSpec('icon', 'injury_serious',  16, 16, 1, 16, 'Sprites/Icons'),
  injury_critical: makeSpec('icon', 'injury_critical', 16, 16, 1, 16, 'Sprites/Icons'),

  // ── Backgrounds (high-res, no palette snap) ────────────────────
  bg_guildhall:      makeSpec('background', 'bg_guildhall',      960, 540, 1, 1, 'Sprites/Backgrounds'),
  bg_office:         makeSpec('background', 'bg_office',         960, 540, 1, 1, 'Sprites/Backgrounds'),

  // ── Tiles ──────────────────────────────────────────────────────
  tile_stone_floor:  makeSpec('tile', 'tile_stone_floor',  32, 32, 1, 32, 'Sprites/Tiles'),
  tile_wood_floor:   makeSpec('tile', 'tile_wood_floor',   32, 32, 1, 32, 'Sprites/Tiles'),
  tile_floor:        makeSpec('tile', 'tile_floor',        16, 16, 1, 16, 'Sprites/Tiles'),
  tile_floor_alt:    makeSpec('tile', 'tile_floor_alt',    16, 16, 1, 16, 'Sprites/Tiles'),
  tile_wall:         makeSpec('tile', 'tile_wall',         16, 16, 1, 16, 'Sprites/Tiles'),
  tile_lava:         makeSpec('tile', 'tile_lava',         32, 16, 2, 16, 'Sprites/Tiles'),
  tile_poison:       makeSpec('tile', 'tile_poison',       32, 16, 2, 16, 'Sprites/Tiles'),
  tile_unstable:     makeSpec('tile', 'tile_unstable',     16, 16, 1, 16, 'Sprites/Tiles'),
  tile_highground:   makeSpec('tile', 'tile_highground',   16, 16, 1, 16, 'Sprites/Tiles'),

  // ── Node icons (24×24) ─────────────────────────────────────────
  node_fight:    makeSpec('node', 'node_fight',    24, 24, 1, 24, 'Sprites/Nodes'),
  node_elite:    makeSpec('node', 'node_elite',    24, 24, 1, 24, 'Sprites/Nodes'),
  node_boss:     makeSpec('node', 'node_boss',     24, 24, 1, 24, 'Sprites/Nodes'),
  node_loot:     makeSpec('node', 'node_loot',     24, 24, 1, 24, 'Sprites/Nodes'),
  node_rest:     makeSpec('node', 'node_rest',     24, 24, 1, 24, 'Sprites/Nodes'),
  node_mystery:  makeSpec('node', 'node_mystery',  24, 24, 1, 24, 'Sprites/Nodes'),

  // ── Building upgrade icons (24×24) ─────────────────────────────
  upgrade_infirmary:       makeSpec('node', 'upgrade_infirmary',       24, 24, 1, 24, 'Sprites/UI'),
  upgrade_quartermaster:   makeSpec('node', 'upgrade_quartermaster',   24, 24, 1, 24, 'Sprites/UI'),
  upgrade_rune_forge:      makeSpec('node', 'upgrade_rune_forge',      24, 24, 1, 24, 'Sprites/UI'),
  upgrade_library:         makeSpec('node', 'upgrade_library',         24, 24, 1, 24, 'Sprites/UI'),
  upgrade_chapel:          makeSpec('node', 'upgrade_chapel',          24, 24, 1, 24, 'Sprites/UI'),
  upgrade_training_grounds: makeSpec('node', 'upgrade_training_grounds', 24, 24, 1, 24, 'Sprites/UI'),

  // ── Faction emblems (24×24) ────────────────────────────────────
  emblem_crown:      makeSpec('node', 'emblem_crown',      24, 24, 1, 24, 'Sprites/UI'),
  emblem_registrar:  makeSpec('node', 'emblem_registrar',  24, 24, 1, 24, 'Sprites/UI'),
  emblem_black_hand: makeSpec('node', 'emblem_black_hand', 24, 24, 1, 24, 'Sprites/UI'),
  emblem_void:       makeSpec('node', 'emblem_void',       24, 24, 1, 24, 'Sprites/UI'),

  // ── Gear slot icons (24×24) ────────────────────────────────────
  slot_head:     makeSpec('node', 'slot_head',     24, 24, 1, 24, 'Sprites/UI'),
  slot_chest:    makeSpec('node', 'slot_chest',    24, 24, 1, 24, 'Sprites/UI'),
  slot_hands:    makeSpec('node', 'slot_hands',    24, 24, 1, 24, 'Sprites/UI'),
  slot_legs:     makeSpec('node', 'slot_legs',     24, 24, 1, 24, 'Sprites/UI'),
  slot_feet:     makeSpec('node', 'slot_feet',     24, 24, 1, 24, 'Sprites/UI'),
  slot_weapon:   makeSpec('node', 'slot_weapon',   24, 24, 1, 24, 'Sprites/UI'),
  slot_offhand:  makeSpec('node', 'slot_offhand',  24, 24, 1, 24, 'Sprites/UI'),
};

// ─── HELPERS ──────────────────────────────────────────────────────

/** Infer the tier from legacy AssetTypeId + dimensions */
export function inferTier(assetType: string, w: number, h: number): AssetTier {
  if (assetType === 'environment' && w >= 480) return 'background';
  if (assetType === 'character' && h >= 48 && w <= 64) return 'portrait';
  if (assetType === 'character' && w > 64) return 'unit';
  if (assetType === 'icon') return 'icon';
  if (assetType === 'tileset') return 'tile';
  if (assetType === 'ui') return 'node';
  // Fallback — treat small characters as portraits, everything else as portrait-tier processing
  if (assetType === 'character') return 'portrait';
  return 'portrait';
}

/** Build Unity metadata from a SpriteSpec */
export function buildUnityMetadata(spec: SpriteSpec): SpriteMetadata {
  const frameW = spec.frameCount > 1 ? Math.round(spec.targetW / spec.frameCount) : spec.targetW;
  return {
    assetKey: spec.assetKey,
    tier: spec.tier,
    unityPath: spec.unityPath,
    targetW: spec.targetW,
    targetH: spec.targetH,
    frameCount: spec.frameCount,
    ppu: spec.ppu,
    filterMode: spec.filterMode,
    frameW,
    frameH: spec.targetH,
  };
}
