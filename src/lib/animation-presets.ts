import { type GeneratedAsset, type AssetTypeId } from './forge-constants';

/**
 * Animation frame definitions for sprite sheet generation.
 */

export interface AnimationPreset {
  id: string;
  label: string;
  icon: string;
  frameCount: number;
  description: string;
  /** Prompt suffix for each frame, describing the pose/state */
  frameDescriptions: string[];
  /** Applicable asset types */
  assetTypes: AssetTypeId[];
  /** Frames per second for preview playback */
  fps: number;
}

export const ANIMATION_PRESETS: AnimationPreset[] = [
  {
    id: 'idle',
    label: 'Idle Breathing',
    icon: '💤',
    frameCount: 4,
    description: '4-frame subtle idle loop (breathing, weight shift)',
    frameDescriptions: [
      'neutral standing pose, weight centered, relaxed shoulders',
      'subtle inhale, shoulders slightly raised, chest expanded 1-2px',
      'neutral standing pose, weight centered, relaxed shoulders',
      'subtle exhale, shoulders slightly lowered, weight shifted to right foot',
    ],
    assetTypes: ['character'],
    fps: 4,
  },
  {
    id: 'walk',
    label: 'Walk Cycle',
    icon: '🚶',
    frameCount: 4,
    description: '4-frame walk cycle (side view)',
    frameDescriptions: [
      'walking pose frame 1: right foot forward, left arm forward, contact pose',
      'walking pose frame 2: right foot on ground, body rising, passing pose',
      'walking pose frame 3: left foot forward, right arm forward, contact pose',
      'walking pose frame 4: left foot on ground, body rising, passing pose',
    ],
    assetTypes: ['character'],
    fps: 8,
  },
  {
    id: 'attack',
    label: 'Attack Swing',
    icon: '⚔️',
    frameCount: 4,
    description: '4-frame melee attack animation',
    frameDescriptions: [
      'attack anticipation: weapon drawn back, body coiled, weight on back foot',
      'attack swing: weapon mid-arc, body lunging forward, intense expression',
      'attack contact: weapon extended full reach, impact moment, body stretched',
      'attack recovery: weapon returning to rest, body recoiling, settling stance',
    ],
    assetTypes: ['character'],
    fps: 10,
  },
  {
    id: 'flicker',
    label: 'Flicker/Glow',
    icon: '🕯️',
    frameCount: 3,
    description: '3-frame light flicker loop for props/effects',
    frameDescriptions: [
      'normal brightness, standard lighting',
      'slightly brighter, light source flaring, warm glow intensified',
      'slightly dimmer than normal, shadows deeper, light receding',
    ],
    assetTypes: ['item', 'environment', 'effect'],
    fps: 6,
  },
  {
    id: 'hit',
    label: 'Hit Reaction',
    icon: '💥',
    frameCount: 3,
    description: '3-frame damage/hit reaction',
    frameDescriptions: [
      'hit impact: body jerking back, pain expression, slight white flash overlay',
      'hit recoil: body bent backward, arms flung, off balance',
      'hit recovery: returning to standing, guarded posture, wary expression',
    ],
    assetTypes: ['character'],
    fps: 8,
  },
];

/**
 * Build a prompt for a specific animation frame.
 */
export function buildAnimationFramePrompt(
  basePrompt: string,
  preset: AnimationPreset,
  frameIndex: number,
): string {
  const frameDesc = preset.frameDescriptions[frameIndex];
  return `${basePrompt}, ANIMATION FRAME ${frameIndex + 1} of ${preset.frameCount}: ${frameDesc}. CRITICAL: maintain EXACT same character design, proportions, outfit, colors, and style across all frames. Only the POSE changes. Same silhouette proportions. Same head size. Same color palette. Frame-to-frame consistency is paramount.`;
}

/**
 * Build an animation spritesheet from frame assets.
 * Frames are laid out horizontally in a single row.
 */
export async function buildAnimationSheet(
  frames: GeneratedAsset[],
  padding: number = 0,
): Promise<string> {
  if (frames.length === 0) return '';

  const w = frames[0].width;
  const h = frames[0].height;
  const canvas = document.createElement('canvas');
  canvas.width = frames.length * (w + padding) - padding;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  await Promise.all(
    frames.map((frame, i) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, i * (w + padding), 0, w, h);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = frame.imageDataUrl;
      })
    )
  );

  return canvas.toDataURL('image/png');
}
