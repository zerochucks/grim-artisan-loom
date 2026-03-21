/**
 * Class System — Canonical definitions for Unity export.
 *
 * Contains mercenary class enums, base combat stats, passive/active
 * abilities, status effects, and notable synergy pairs.
 * Maps to CombatUnit + RunManager on the Unity side.
 */

// ─── CLASS ENUM ───────────────────────────────────────────────────

export const MercClass = {
  Fighter: 'fighter',
  Rogue: 'rogue',
  Ranger: 'ranger',
  Mage: 'mage',
  Cleric: 'cleric',
  Warden: 'warden',
} as const;

export type MercClassId = typeof MercClass[keyof typeof MercClass];

// ─── STATUS EFFECTS ───────────────────────────────────────────────

export const StatusEffect = {
  Stunned: 'stunned',
  Bleeding: 'bleeding',
  Rooted: 'rooted',
  Marked: 'marked',
  Weakened: 'weakened',
  Immobilized: 'immobilized',
} as const;

export type StatusEffectId = typeof StatusEffect[keyof typeof StatusEffect];

export interface StatusEffectDef {
  id: StatusEffectId;
  label: string;
  description: string;
  /** Duration in turns, 0 = until cleared */
  defaultDuration: number;
}

export const STATUS_EFFECT_DEFS: Record<StatusEffectId, StatusEffectDef> = {
  stunned: {
    id: 'stunned',
    label: 'Stunned',
    description: 'Cannot act next turn.',
    defaultDuration: 1,
  },
  bleeding: {
    id: 'bleeding',
    label: 'Bleeding',
    description: 'Takes damage at the start of each turn.',
    defaultDuration: 2,
  },
  rooted: {
    id: 'rooted',
    label: 'Rooted',
    description: 'Cannot move next turn. Can still attack.',
    defaultDuration: 1,
  },
  marked: {
    id: 'marked',
    label: 'Marked',
    description: '+20% hit chance for all allies attacking this target.',
    defaultDuration: 2,
  },
  weakened: {
    id: 'weakened',
    label: 'Weakened',
    description: 'Deals reduced damage.',
    defaultDuration: 1,
  },
  immobilized: {
    id: 'immobilized',
    label: 'Immobilized',
    description: 'Cannot move. Self-inflicted by Hold the Line.',
    defaultDuration: 1,
  },
};

// ─── ABILITY TYPES ────────────────────────────────────────────────

export interface PassiveAbility {
  id: string;
  label: string;
  description: string;
  /** Hook point in game loop: turn_start, on_kill, on_hit, ally_turn_start, always */
  trigger: 'turn_start' | 'on_kill' | 'on_hit' | 'end_turn' | 'ally_turn_start' | 'always' | 'enemy_move';
}

export interface ActiveAbility {
  id: string;
  label: string;
  description: string;
  /** Whether it costs the unit's action for the turn */
  costsAction: boolean;
  /** Status effect applied to target, if any */
  appliesStatus?: StatusEffectId;
  /** Range in tiles, 0 = adjacent only */
  range: number;
}

// ─── BASE COMBAT STATS ───────────────────────────────────────────

export interface ClassCombatStats {
  move: number;
  atkRange: number;
  note: string;
}

// ─── CLASS DEFINITION ─────────────────────────────────────────────

export interface ClassDef {
  id: MercClassId;
  label: string;
  loreName: string;
  stats: ClassCombatStats;
  passive: PassiveAbility;
  active: ActiveAbility;
  /** Corresponding unit sprite asset_key */
  spriteKey: string;
}

// ─── MAP PASSIVES (RunManager) ────────────────────────────────────

export interface MapPassive {
  classId: MercClassId;
  id: string;
  label: string;
  description: string;
}

export const MAP_PASSIVES: MapPassive[] = [
  {
    classId: 'ranger',
    id: 'ranger_scouting',
    label: 'Field Surveyor',
    description: 'Reveals 2 hops ahead instead of 1 (ApplyRangerScouting).',
  },
  {
    classId: 'rogue',
    id: 'rogue_trap_detection',
    label: 'Loss Prevention',
    description: 'Trap nodes show as TRAP instead of disguised EVENT (ApplyTrapDetection).',
  },
];

// ─── FULL CLASS ROSTER ────────────────────────────────────────────

export const CLASS_DEFS: Record<MercClassId, ClassDef> = {
  fighter: {
    id: 'fighter',
    label: 'Fighter',
    loreName: 'Asset-Retriever',
    stats: { move: 4, atkRange: 1, note: 'Footsoldier' },
    passive: {
      id: 'double_step',
      label: 'Double Step',
      description: 'After a kill, may move again (up to half move range). Extraction through a kill zone.',
      trigger: 'on_kill',
    },
    active: {
      id: 'shield_bash',
      label: 'Shield Bash',
      description: 'Push target 1 tile + apply Stunned. Punishes enemies near walls/hazards.',
      costsAction: true,
      appliesStatus: 'stunned',
      range: 1,
    },
    spriteKey: 'unit_fighter',
  },

  rogue: {
    id: 'rogue',
    label: 'Rogue',
    loreName: 'Loss Prevention',
    stats: { move: 6, atkRange: 1, note: 'Highest mobility, glass cannon' },
    passive: {
      id: 'disengage',
      label: 'Disengage',
      description: 'Ignores ZoC; never triggers opportunity attacks when moving. (hasDisengaged = true at turn start.)',
      trigger: 'turn_start',
    },
    active: {
      id: 'ambush_strike',
      label: 'Ambush Strike',
      description: 'If not yet moved this turn: next attack deals +50% damage and applies Bleeding.',
      costsAction: true,
      appliesStatus: 'bleeding',
      range: 1,
    },
    spriteKey: 'unit_rogue',
  },

  ranger: {
    id: 'ranger',
    label: 'Ranger',
    loreName: 'Field Surveyor',
    stats: { move: 5, atkRange: 3, note: 'Mobile ranged' },
    passive: {
      id: 'overwatch',
      label: 'Overwatch',
      description: 'If unit ends turn without attacking, gains an automatic ranged shot against the first enemy that moves into attack range during the enemy phase.',
      trigger: 'enemy_move',
    },
    active: {
      id: 'pinning_shot',
      label: 'Pinning Shot',
      description: 'Normal ranged attack that also applies Rooted (target can\'t move next turn).',
      costsAction: true,
      appliesStatus: 'rooted',
      range: 3,
    },
    spriteKey: 'unit_ranger',
  },

  mage: {
    id: 'mage',
    label: 'Mage',
    loreName: 'Rune-Scribe',
    stats: { move: 3, atkRange: 4, note: 'Slow, stay back' },
    passive: {
      id: 'void_mark',
      label: 'Void Mark',
      description: 'Every hit from this unit applies Marked to the target (+20% hit chance for all allies vs that target).',
      trigger: 'on_hit',
    },
    active: {
      id: 'void_burst',
      label: 'Void Burst',
      description: 'AoE attack: hits primary target and all adjacent enemies at reduced damage. Applies Weakened to all hit.',
      costsAction: true,
      appliesStatus: 'weakened',
      range: 4,
    },
    spriteKey: 'unit_mage',
  },

  cleric: {
    id: 'cleric',
    label: 'Cleric',
    loreName: 'Morale Officer',
    stats: { move: 4, atkRange: 1, note: 'Keeps pace with fighters' },
    passive: {
      id: 'field_triage',
      label: 'Field Triage',
      description: 'At the start of an adjacent ally\'s turn, if that ally is below 40% HP, restore 2 HP. No action cost.',
      trigger: 'ally_turn_start',
    },
    active: {
      id: 'patch_up',
      label: 'Patch Up',
      description: 'Restore HP to one adjacent ally equal to the Cleric\'s attack stat. Uses their action.',
      costsAction: true,
      range: 1,
    },
    spriteKey: 'unit_cleric',
  },

  warden: {
    id: 'warden',
    label: 'Warden',
    loreName: 'Breach-Guard',
    stats: { move: 3, atkRange: 1, note: 'Slow but immovable' },
    passive: {
      id: 'bulwark',
      label: 'Bulwark',
      description: 'All adjacent allies gain +3 DEF passively. Recalculates every turn.',
      trigger: 'always',
    },
    active: {
      id: 'hold_the_line',
      label: 'Hold the Line',
      description: 'Warden becomes Immobilized until next turn but gains +50% DEF and auto-counter-attacks any melee hit taken this turn.',
      costsAction: true,
      appliesStatus: 'immobilized',
      range: 0,
    },
    spriteKey: 'unit_warden',
  },
};

// ─── SYNERGIES ────────────────────────────────────────────────────

export interface ClassSynergy {
  classes: [MercClassId, MercClassId];
  label: string;
  description: string;
}

export const CLASS_SYNERGIES: ClassSynergy[] = [
  {
    classes: ['mage', 'ranger'],
    label: 'Mark & Overwatch',
    description: 'Mage Marks a target, Ranger\'s Overwatch shot gets the +20% hit bonus.',
  },
  {
    classes: ['warden', 'cleric'],
    label: 'Anvil & Medic',
    description: 'Warden tanks with Hold the Line while Cleric passively heals them below 40%.',
  },
  {
    classes: ['rogue', 'fighter'],
    label: 'Flank & Extract',
    description: 'Rogue flanks freely (no OA), lands Ambush → Bleeding. Fighter Double Steps in after a kill.',
  },
  {
    classes: ['warden', 'fighter'],
    label: 'Chokepoint',
    description: 'Warden holds chokepoint (ZoC + Bulwark), Fighter extracts through the gap after a kill.',
  },
];

// ─── EXPORT HELPER ────────────────────────────────────────────────

/** Generate a JSON blob suitable for Unity ScriptableObject import. */
export function exportClassSystemJSON(): string {
  return JSON.stringify({
    version: 1,
    classes: Object.values(CLASS_DEFS).map(c => ({
      id: c.id,
      label: c.label,
      loreName: c.loreName,
      stats: c.stats,
      passive: c.passive,
      active: c.active,
      spriteKey: c.spriteKey,
    })),
    statusEffects: Object.values(STATUS_EFFECT_DEFS),
    mapPassives: MAP_PASSIVES,
    synergies: CLASS_SYNERGIES,
  }, null, 2);
}
