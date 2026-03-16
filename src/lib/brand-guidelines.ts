/**
 * PIXEL FORGE — Brand Art Direction Guidelines
 * 
 * A codified style guide that ensures every generated asset is consistent,
 * production-ready, and matches the grimdark dark-fantasy aesthetic.
 * 
 * These rules are injected into every generation prompt automatically.
 * They encode lessons learned from iterative artist feedback.
 */

// ─── CORE IDENTITY ────────────────────────────────────────────────

export const BRAND_IDENTITY = {
  name: 'Grimdark Low-Fantasy',
  references: ['Stoneshard', 'Darkest Dungeon', 'Kingdom Death'],
  tone: 'Morally-gray, gritty, weathered, lived-in. Never clean, never heroic.',
  era: 'Late medieval / early renaissance. No sci-fi, no modern, no high-fantasy glow.',
} as const;

// ─── LIGHTING RULES ───────────────────────────────────────────────

export interface LightingRule {
  keyLight: string;
  rimLight: string;
  fillLight: string;
  shadows: string;
  rule: string;
}

export const LIGHTING_RULES: Record<string, LightingRule> = {
  default: {
    keyLight: 'warm torchlight / candlelight, directional from upper-left, golden-amber temperature',
    rimLight: 'cold cyan-blue rim light along ONE consistent edge (right side preferred), slightly brighter than mid-values, saturated but not neon',
    fillLight: 'minimal cool ambient fill from opposite side, just enough to prevent total black crush',
    shadows: 'hue-shifted shadows: purple/blue undertones in dark areas, never pure black',
    rule: 'Warm key + cold rim is the signature look. Rim must be consistent along ONE side to read as clean outline at small sizes.',
  },
  moonlit: {
    keyLight: 'cold moonlight from above-right, desaturated blue-white',
    rimLight: 'warm amber rim light along left edge, subtle glow suggesting distant firelight',
    fillLight: 'very dark cool ambient, deep blue-purple',
    shadows: 'hue-shifted to deep indigo/violet, rich but not saturated',
    rule: 'Inverted temperature scheme. Moon key + warm rim for night scenes.',
  },
  interior: {
    keyLight: 'warm candlelight from below or side, flickering quality implied through value variation',
    rimLight: 'cold rim from doorway/window, implying outside light source, consistent along one edge',
    fillLight: 'warm bounce light from table/floor surfaces',
    shadows: 'deep warm browns transitioning to cool purple in deepest areas',
    rule: 'Interior scenes emphasize intimacy. Light sources should feel diegetic (candles, hearth, lantern).',
  },
};

// ─── VALUE STRUCTURE ──────────────────────────────────────────────

export interface ValueStructureRule {
  bands: number;
  description: string;
  rule: string;
}

export const VALUE_STRUCTURE: Record<string, ValueStructureRule> = {
  sprite: {
    bands: 4,
    description: 'Minimum 4 clearly distinct tonal bands: deep shadow, mid-shadow, mid-light, highlight. Each band must be visually separable at target resolution.',
    rule: 'CRITICAL: Torso/body must NOT collapse into a single dark mass. Force value breaks: brighter lapel edge, lighter shirt under coat, subtle highlight on collar or shoulder seam. Every major form (head, torso, arms) needs its own tonal identity.',
  },
  large: {
    bands: 6,
    description: '6+ tonal bands with smooth transitions. More gradient freedom at larger sizes.',
    rule: 'Can use subtler value shifts. Still maintain clear silhouette separation between major forms.',
  },
};

// ─── MATERIAL LANGUAGE ────────────────────────────────────────────

export const MATERIAL_CUES = {
  metals: 'oiled steel, tarnished iron, cold-forged, pitted and worn — never chrome, never polished mirror',
  leather: 'cracked, oil-darkened, sweat-stained, with visible grain and stitching',
  fabric: 'coarse linen, wool, heavy canvas, frayed edges — never silk, never synthetic',
  wood: 'dark oak, weathered pine, worm-eaten, with visible grain and age marks',
  stone: 'rough-hewn, lichen-spotted, mortar-cracked, with chips and wear marks',
  skin: 'weathered, scarred, age-lined — never smooth, never porcelain',
  paper: 'yellowed parchment, wax-sealed, ink-faded, with foxing and water stains',
  glass: 'thick, bubbled, slightly greenish tint — medieval blown glass, not modern clear',
} as const;

// ─── COMPOSITION RULES ───────────────────────────────────────────

export const COMPOSITION_RULES = {
  character: {
    framing: 'chest-up or waist-up, centered subject, slight low angle for authority',
    gaze: 'direct eye contact with viewer, intense but not wild',
    posture: 'shoulders squared, grounded stance, weight evident',
    space: 'tight crop with minimal background, subject fills 70-80% of frame',
    camera: '35mm equivalent, shallow depth of field, subject sharp',
  },
  props: {
    framing: '3/4 top-down angle, items clearly separated with breathing room',
    arrangement: 'deliberate still-life composition, not random scatter',
    surface: 'items on contextual surface (tavern table, stone shelf, workbench)',
    camera: '85mm macro equivalent, entire arrangement in focus',
    space: 'each prop occupies its own visual territory, no overlap confusion',
  },
  environment: {
    framing: 'wide establishing shot, rule-of-thirds, horizon in lower or upper third',
    depth: '3 clear depth planes: foreground detail, midground subject, background atmosphere',
    space: 'intentional negative space for UI overlay on one side',
    camera: '24-35mm wide, deep depth of field for environmental context',
    atmosphere: 'volumetric haze/smoke, light rays where appropriate',
  },
  icon: {
    framing: 'centered, fills frame to edges, bold graphic shape',
    clarity: 'silhouette must read at 16x16. If you can\'t identify it that small, simplify.',
    camera: 'flat/orthographic, no perspective distortion',
    space: 'minimal negative space, icon IS the composition',
  },
  equipment: {
    framing: 'product-shot style, single item, slight 3/4 angle preferred',
    detail: 'material detail visible, wear marks tell a story',
    camera: 'macro lens, sharp focus on material texture',
    space: 'clean dark background, item isolated',
  },
} as const;

// ─── SPRITE READABILITY SAFEGUARDS ────────────────────────────────

export interface SpriteSafeguard {
  maxSize: number;
  rules: string[];
}

export const SPRITE_SAFEGUARDS: SpriteSafeguard[] = [
  {
    maxSize: 32,
    rules: [
      'Extreme simplification: 2-3 colors per form maximum',
      'Bold 1-2px outline (relative to final size)',
      'No interior detail that won\'t survive downscale',
      'Silhouette must be recognizable as a single blob shape',
      'Flat color fills with minimal shading',
    ],
  },
  {
    maxSize: 64,
    rules: [
      'High contrast value grouping: minimum 4 tonal bands',
      'Simplified midtones: group similar values, avoid gradual gradients',
      'Clean shape massing over micro-texture',
      'Avoid dithering noise — it becomes visual mud at this size',
      'Rim light must be bright enough to serve as outline',
      'Force value breaks on torso: brighter lapel/collar/shirt edge',
      'Minimal micro-texture — rely on shape and value, not surface detail',
      'Consistent rim light along ONE side (no patchy outline)',
    ],
  },
  {
    maxSize: 128,
    rules: [
      'Moderate detail allowed, but forms should still read as clear shapes',
      'Value separation between major body parts',
      'Some texture acceptable but keep it subordinate to form',
      'Rim light can be more nuanced with falloff',
    ],
  },
];

// ─── NEGATIVE CONSTRAINT BANKS ────────────────────────────────────

export const NEGATIVE_CONSTRAINTS = {
  universal: [
    'no anime', 'no cartoon', 'no chibi', 'no cel-shading',
    'no modern clothing', 'no sci-fi elements', 'no neon lighting',
    'no text overlays', 'no watermarks', 'no UI elements in render',
    'no lens flare', 'no chromatic aberration',
    'no AI artifacts (extra fingers, merged limbs, floating objects)',
  ],
  character: [
    'no extra limbs', 'no deformed hands', 'no blurred face',
    'no background scenery (isolate subject)', 'no heroic pose (keep grounded)',
    'no clean/pristine clothing', 'no sparkly effects',
  ],
  props: [
    'no characters', 'no hands holding items', 'no readable text on items',
    'no modern materials (plastic, synthetic)', 'no clutter pile (separate each item)',
  ],
  environment: [
    'no characters present', 'no readable text/signage',
    'no fisheye distortion', 'no extreme Dutch angle',
  ],
  sprite: [
    'no noisy micro-texture', 'no sparkly dithering',
    'no compressed midtones (keep value bands distinct)',
    'no sharpening artifacts',
  ],
} as const;

// ─── COLOR DIRECTION ──────────────────────────────────────────────

export const COLOR_DIRECTION = {
  temperature: 'Overall muted/desaturated. Warm accents are earned — only on key focal points (wounds, fire, gold details).',
  accents: 'Reds and golds are accent colors, used sparingly for emphasis. Never uniform warm wash.',
  shadows: 'Shadows shift toward purple/blue/violet. Never use pure black or pure grey for shadows.',
  highlights: 'Highlights shift toward warm gold/amber on light-facing edges. Never pure white.',
  saturation: 'Low overall saturation with strategic pops. The most saturated element in frame should be a deliberate focal point.',
  harmony: 'Analogous base (earth tones) with one complementary accent. No rainbow. No candy colors.',
} as const;

// ─── PROMPT ASSEMBLY ──────────────────────────────────────────────

/**
 * Get the appropriate sprite safeguard rules based on target dimensions.
 */
export function getSpriteSafeguards(width: number, height: number): string[] {
  const targetSize = Math.max(width, height);
  const safeguard = SPRITE_SAFEGUARDS.find(s => targetSize <= s.maxSize);
  return safeguard?.rules ?? ['Standard resolution: full detail allowed, maintain readable silhouette and strong value structure'];
}

/**
 * Get composition rules for a given asset type.
 */
export function getCompositionRules(assetType: string): Record<string, string> {
  return (COMPOSITION_RULES as Record<string, Record<string, string>>)[assetType] ?? COMPOSITION_RULES.character;
}

/**
 * Get the appropriate lighting setup.
 */
export function getLightingSetup(preset: string = 'default'): LightingRule {
  return LIGHTING_RULES[preset] ?? LIGHTING_RULES.default;
}

/**
 * Get the value structure rules based on target size.
 */
export function getValueStructure(width: number, height: number): ValueStructureRule {
  const targetSize = Math.max(width, height);
  return targetSize <= 128 ? VALUE_STRUCTURE.sprite : VALUE_STRUCTURE.large;
}

/**
 * Build the complete negative constraint string for a given context.
 */
export function buildNegatives(assetType: string, width: number, height: number): string {
  const parts: string[] = [...NEGATIVE_CONSTRAINTS.universal];
  const typeKey = assetType as keyof typeof NEGATIVE_CONSTRAINTS;
  if (typeKey in NEGATIVE_CONSTRAINTS && typeKey !== 'universal' && typeKey !== 'sprite') {
    parts.push(...NEGATIVE_CONSTRAINTS[typeKey]);
  }
  const targetSize = Math.max(width, height);
  if (targetSize <= 128) parts.push(...NEGATIVE_CONSTRAINTS.sprite);
  return parts.join(', ');
}

/**
 * Build material cue string for relevant asset types.
 */
export function getMaterialCues(assetType: string): string {
  const relevantMaterials: Record<string, (keyof typeof MATERIAL_CUES)[]> = {
    character: ['metals', 'leather', 'fabric', 'skin'],
    equipment: ['metals', 'leather', 'wood'],
    item: ['metals', 'leather', 'glass', 'paper'],
    environment: ['wood', 'stone'],
    props: ['metals', 'leather', 'paper', 'glass'],
    icon: [],
    tileset: ['stone', 'wood'],
    ui: ['metals', 'stone', 'wood'],
    effect: [],
  };
  const keys = relevantMaterials[assetType] ?? ['metals', 'leather'];
  return keys.map(k => `${k}: ${MATERIAL_CUES[k]}`).join('; ');
}

/**
 * Assemble the complete brand guidelines block for prompt injection.
 */
export function assembleBrandBlock(
  assetType: string,
  width: number,
  height: number,
  lightingPreset: string = 'default'
): {
  brandPreamble: string;
  compositionBlock: string;
  lightingBlock: string;
  valueBlock: string;
  materialBlock: string;
  safeguardBlock: string;
  negativeBlock: string;
  colorBlock: string;
} {
  const lighting = getLightingSetup(lightingPreset);
  const composition = getCompositionRules(assetType);
  const valueStructure = getValueStructure(width, height);
  const safeguards = getSpriteSafeguards(width, height);
  const negatives = buildNegatives(assetType, width, height);
  const materials = getMaterialCues(assetType);

  return {
    brandPreamble: `Art Direction: ${BRAND_IDENTITY.name}. Tone: ${BRAND_IDENTITY.tone} References: ${BRAND_IDENTITY.references.join(', ')}. ${BRAND_IDENTITY.era}`,
    compositionBlock: Object.entries(composition).map(([k, v]) => `${k}: ${v}`).join('. '),
    lightingBlock: `Key: ${lighting.keyLight}. Rim: ${lighting.rimLight}. Fill: ${lighting.fillLight}. Shadows: ${lighting.shadows}. Rule: ${lighting.rule}`,
    valueBlock: `Value structure (${valueStructure.bands} bands minimum): ${valueStructure.description} RULE: ${valueStructure.rule}`,
    materialBlock: materials,
    safeguardBlock: safeguards.join('. '),
    negativeBlock: negatives,
    colorBlock: `Temperature: ${COLOR_DIRECTION.temperature} Accents: ${COLOR_DIRECTION.accents} Shadows: ${COLOR_DIRECTION.shadows} Highlights: ${COLOR_DIRECTION.highlights} Saturation: ${COLOR_DIRECTION.saturation}`,
  };
}
