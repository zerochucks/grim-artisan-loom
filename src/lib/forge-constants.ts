// Asset types with prefixes and icons
export const ASSET_TYPES = [
  { id: 'character', label: 'Character Sprite', prefix: 'chr_', icon: '⚔️' },
  { id: 'equipment', label: 'Equipment / Gear', prefix: 'gear_', icon: '🛡️' },
  { id: 'icon', label: 'Ability Icon', prefix: 'icon_', icon: '✨' },
  { id: 'tileset', label: 'Tileset', prefix: 'tile_', icon: '🧱' },
  { id: 'item', label: 'Item / Pickup', prefix: 'itm_', icon: '🧪' },
  { id: 'environment', label: 'Environment Prop', prefix: 'env_', icon: '🕯️' },
  { id: 'ui', label: 'UI Element', prefix: 'ui_', icon: '🖼️' },
  { id: 'effect', label: 'Effect / Particle', prefix: 'fx_', icon: '💥' },
] as const;

export type AssetTypeId = typeof ASSET_TYPES[number]['id'];

export const RESOLUTION_PRESETS = [
  { w: 16, h: 16 },
  { w: 24, h: 24 },
  { w: 32, h: 32 },
  { w: 48, h: 48 },
  { w: 64, h: 64 },
  { w: 96, h: 96 },
  { w: 48, h: 64, label: '48×64 (char)' },
] as const;

export const STYLE_MODIFIERS = [
  { id: 'heavy_outline', label: 'Heavy outline', group: 'outline' },
  { id: 'thin_outline', label: 'Thin outline', group: 'outline' },
  { id: 'no_outline', label: 'No outline', group: 'outline' },
  { id: 'dithered', label: 'Dithered shading', group: 'shading' },
  { id: 'smooth', label: 'Smooth shading', group: 'shading' },
  { id: 'flat', label: 'Flat color', group: 'shading' },
  { id: 'high_detail', label: 'High detail', group: 'detail' },
  { id: 'low_detail', label: 'Low detail (NES)', group: 'detail' },
  { id: 'symmetry', label: 'Bilateral symmetry', group: 'composition' },
  { id: 'hue_shifted', label: 'Hue-shifted shadows', group: 'lighting' },
  { id: 'textured', label: 'Textured surfaces', group: 'surface' },
  { id: 'warm_lighting', label: 'Warm lighting (torchlit)', group: 'lighting' },
  { id: 'cold_lighting', label: 'Cold lighting (moonlit)', group: 'lighting' },
  { id: 'blood_gore', label: 'Blood & gore accents', group: 'accent' },
  { id: 'arcane_glow', label: 'Arcane glow effects', group: 'accent' },
] as const;

export type StyleModifierId = typeof STYLE_MODIFIERS[number]['id'];

export interface BuiltInPalette {
  name: string;
  description: string;
  colors: string[];
}

export const BUILT_IN_PALETTES: BuiltInPalette[] = [
  {
    name: 'Blightborne',
    description: 'Core grimdark. The default.',
    colors: ['#0a0a0f','#1a1420','#2d1b2e','#3d2040','#5c3a50','#8b6070','#c49888','#e8ccb0','#7a3b1e','#c45c2e','#f28b30','#ffd166','#3a506b','#5bc0be','#2d6a4f','#52b788'],
  },
  {
    name: 'Crimson Sanctum',
    description: 'Blood-heavy, altar reds.',
    colors: ['#0a0a0a','#1a0a0a','#2d0e0e','#4a1717','#7a2020','#b03030','#e04040','#ff6b6b','#ffd166','#3c1518','#69140e','#a44200','#d4770c','#4a3000','#2b2d42','#e8d5c4'],
  },
  {
    name: 'Stonevault',
    description: 'Cold dungeon stone, iron grey.',
    colors: ['#0b0c10','#1a1c24','#2b2d38','#3e4250','#5a6070','#7d8494','#a0a8b8','#c8d0dc','#6b4226','#a67c52','#d4a373','#e63946','#1d3557','#457b9d','#704214','#ffefd5'],
  },
  {
    name: 'Candlewick',
    description: 'Warm torchlight, golden-amber.',
    colors: ['#0f0e17','#1a1520','#2b1e28','#4a3530','#6b4a38','#8b6848','#b08860','#d4a878','#f0cc90','#fff3c8','#7a3b1e','#c45c2e','#ef233c','#3d2040','#5c3a50','#2d2d2d'],
  },
  {
    name: 'Moonsorrow',
    description: 'Cold moonlit purples, undead vibes.',
    colors: ['#0a0a12','#12101e','#1e1830','#2e2548','#443868','#6a5090','#9070b8','#b898d8','#e0c8f0','#f0e8ff','#5c3a50','#e63946','#ff8c42','#ffd166','#2b2d42','#8d99ae'],
  },
  {
    name: 'Ironblood',
    description: 'Warfare. Steel and crimson.',
    colors: ['#0a0a0a','#1a1a1e','#2d2d34','#44444e','#5e6070','#808898','#a0aab8','#c0ccd8','#e0e8f0','#ffffff','#4a1717','#7a2020','#b03030','#e04040','#8b6848','#d4a373'],
  },
  {
    name: 'Rotwood',
    description: 'Swamp, decay, poison green.',
    colors: ['#0a0f0a','#141e14','#1e2e1a','#2d4020','#3e5830','#507040','#6b8850','#88a868','#a8c888','#d0e8b0','#4a3000','#704214','#a0522d','#d4770c','#3d2040','#7a2020'],
  },
  {
    name: 'Abyssal',
    description: 'Deep ocean, eldritch horror.',
    colors: ['#050510','#0a0a1e','#101030','#181848','#202060','#283880','#3050a0','#4070c0','#60a0e0','#a0d8ff','#1a4040','#2d6a4f','#e63946','#ffd166','#3d2040','#6a5090'],
  },
];

export const EXAMPLE_PROMPTS: Record<AssetTypeId, string> = {
  character: 'A plague doctor with a beaked mask and lantern, hunched posture, tattered robes',
  equipment: 'A rusted battleaxe with a cracked blade, dried blood on the edge, leather-wrapped handle',
  icon: 'Blood frenzy ability — swirling crimson energy with sharp claw marks radiating outward',
  tileset: 'Cracked dungeon stone floor with scattered bone fragments and dark mortar lines',
  item: 'A bubbling health potion in a cracked glass vial, faint red glow, cork stopper',
  environment: 'A cluster of melted candles on a skull-topped iron candelabra, wax dripping',
  ui: 'Gothic dialog frame with ornate iron corner flourishes, riveted edges, dark interior',
  effect: 'Blood slash impact — crimson arc with droplet particles trailing off the edges',
};

export interface GeneratedAsset {
  id?: string;
  name: string;
  prompt: string;
  assetType: AssetTypeId;
  width: number;
  height: number;
  paletteColors: string[];
  paletteName: string;
  gridData?: string[];
  imageDataUrl: string;
  styleModifiers: string[];
  generationMode: 'forge' | 'render';
  createdAt: string;
}
