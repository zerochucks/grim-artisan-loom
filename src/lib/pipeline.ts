/**
 * Production Post-Processing Pipeline
 *
 * Tier-aware processing: backgrounds get bilinear, portraits get cascaded
 * downscale + palette snap, units/icons get nearest-neighbor + outline.
 */

import { type AssetTier, type SpriteSpec, type SpriteMetadata, buildUnityMetadata, PALETTE_24, inferTier } from './sprite-specs';
import { base64ToCanvas } from './canvas-utils';

// ─── COLOR UTILITIES ──────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function findNearest(r: number, g: number, b: number, palette: [number, number, number][]): [number, number, number] {
  let minDist = Infinity;
  let best = palette[0];
  for (const c of palette) {
    const dr = r - c[0], dg = g - c[1], db = b - c[2];
    const dist = dr * dr + dg * dg + db * db;
    if (dist < minDist) { minDist = dist; best = c; }
  }
  return best;
}

// ─── LETTERBOX CROP ───────────────────────────────────────────────

/**
 * Detect and crop black letterbox bars (top/bottom and left/right).
 * Scans rows/cols for near-black average brightness and trims them.
 * Threshold: a row/col is "black" if avg luminance < 8 (out of 255).
 */
function cropLetterbox(src: HTMLCanvasElement, threshold: number = 8): HTMLCanvasElement {
  const ctx = src.getContext('2d')!;
  const { width, height } = src;
  const imgData = ctx.getImageData(0, 0, width, height);
  const { data } = imgData;

  const rowAvgLum = (y: number): number => {
    let sum = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      sum += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    }
    return sum / width;
  };

  const colAvgLum = (x: number): number => {
    let sum = 0;
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * 4;
      sum += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    }
    return sum / height;
  };

  let top = 0, bottom = height - 1, left = 0, right = width - 1;

  while (top < bottom && rowAvgLum(top) < threshold) top++;
  while (bottom > top && rowAvgLum(bottom) < threshold) bottom--;
  while (left < right && colAvgLum(left) < threshold) left++;
  while (right > left && colAvgLum(right) < threshold) right--;

  const cropW = right - left + 1;
  const cropH = bottom - top + 1;

  // No significant crop detected — return original
  if (cropW >= width - 2 && cropH >= height - 2) return src;

  const out = document.createElement('canvas');
  out.width = cropW;
  out.height = cropH;
  out.getContext('2d')!.drawImage(src, left, top, cropW, cropH, 0, 0, cropW, cropH);
  return out;
}

// ─── CANVAS HELPERS ───────────────────────────────────────────────

function cloneCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  c.getContext('2d')!.drawImage(src, 0, 0);
  return c;
}

/** Bilinear downscale (browser default) */
function bilinearDownscale(src: HTMLCanvasElement, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, h);
  return c;
}

/** Nearest-neighbor downscale */
function nearestNeighborDownscale(src: HTMLCanvasElement, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, w, h);
  return c;
}

/**
 * Cascaded downscale — halve with bilinear until within 2× of target,
 * then snap with nearest-neighbor. Much better portrait quality.
 */
function cascadedDownscale(src: HTMLCanvasElement, targetW: number, targetH: number): HTMLCanvasElement {
  let current = src;
  while (current.width > targetW * 2 || current.height > targetH * 2) {
    current = bilinearDownscale(
      current,
      Math.max(targetW, Math.ceil(current.width / 2)),
      Math.max(targetH, Math.ceil(current.height / 2)),
    );
  }
  return nearestNeighborDownscale(current, targetW, targetH);
}

// ─── PALETTE SNAP ─────────────────────────────────────────────────

function paletteSnap(src: HTMLCanvasElement, palette: string[]): HTMLCanvasElement {
  if (palette.length === 0) return src;
  const rgb = palette.map(hexToRgb);
  const out = cloneCanvas(src);
  const ctx = out.getContext('2d')!;
  const imgData = ctx.getImageData(0, 0, out.width, out.height);
  const { data } = imgData;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) { data[i + 3] = 0; continue; }
    const [r, g, b] = findNearest(data[i], data[i + 1], data[i + 2], rgb);
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
  }

  ctx.putImageData(imgData, 0, 0);
  return out;
}

// ─── 1px OUTLINE ──────────────────────────────────────────────────

function applyOutline(src: HTMLCanvasElement, outlineHex: string): HTMLCanvasElement {
  const out = cloneCanvas(src);
  const ctx = out.getContext('2d')!;
  const imgData = ctx.getImageData(0, 0, out.width, out.height);
  const { data, width, height } = imgData;

  const [or, og, ob] = hexToRgb(outlineHex);
  const result = new Uint8ClampedArray(data);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] === 0) {
        const neighbors: [number, number][] = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const ni = (ny * width + nx) * 4;
            if (data[ni + 3] > 127) {
              result[i] = or; result[i + 1] = og; result[i + 2] = ob; result[i + 3] = 255;
              break;
            }
          }
        }
      }
    }
  }

  ctx.putImageData(new ImageData(result, width, height), 0, 0);
  return out;
}

// ─── ALPHA FRINGE CLEANUP ─────────────────────────────────────────

/**
 * Erode semi-transparent edge pixels to eliminate gray halos from AI output.
 * Any pixel with alpha 1–127 is snapped to fully transparent (alpha 0).
 */
function cleanAlphaFringe(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = cloneCanvas(src);
  const ctx = out.getContext('2d')!;
  const imgData = ctx.getImageData(0, 0, out.width, out.height);
  const { data } = imgData;

  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0 && data[i] < 128) {
      data[i] = 0;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return out;
}

// ─── STRIP REORGANIZER ────────────────────────────────────────────

/**
 * Detect if an AI-generated spritesheet is multi-row and reorganize
 * into a single horizontal strip. Uses content bounding-box detection
 * to find individual frames scattered across the canvas.
 */
function reorganizeToStrip(
  src: HTMLCanvasElement,
  frameCount: number,
  cellW: number,
  cellH: number,
): HTMLCanvasElement {
  const totalStripW = cellW * frameCount;

  // If already roughly the right strip shape, skip
  if (src.width >= totalStripW * 0.8 && src.height <= cellH * 1.5) {
    return src;
  }

  // Try grid-based extraction: detect likely rows/cols from aspect ratio
  const srcAspect = src.width / src.height;
  let cols: number, rows: number;

  if (srcAspect > 2) {
    // Wide — likely already a strip or close
    cols = frameCount;
    rows = 1;
  } else if (srcAspect > 1) {
    // Landscape — try common layouts
    cols = Math.ceil(Math.sqrt(frameCount * srcAspect));
    rows = Math.ceil(frameCount / cols);
  } else {
    // Portrait or square — multiple rows
    cols = Math.ceil(Math.sqrt(frameCount));
    rows = Math.ceil(frameCount / cols);
  }

  const frameSrcW = Math.floor(src.width / cols);
  const frameSrcH = Math.floor(src.height / rows);

  // Create output strip
  const out = document.createElement('canvas');
  out.width = totalStripW;
  out.height = cellH;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  for (let i = 0; i < frameCount; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const sx = col * frameSrcW;
    const sy = row * frameSrcH;

    // Draw each frame into its cell in the strip, scaling to target cell size
    ctx.drawImage(src, sx, sy, frameSrcW, frameSrcH, i * cellW, 0, cellW, cellH);
  }

  return out;
}

// ─── INTER-FRAME SMUDGE CLEANUP ──────────────────────────────────

/**
 * Clean white/light smudge artifacts in the gaps between frames.
 * For spritesheets with multiple frames, any pixel in the "border zone"
 * between cells that is near-white and semi-opaque gets zeroed out.
 */
function cleanInterFrameSmudges(
  src: HTMLCanvasElement,
  frameCount: number,
): HTMLCanvasElement {
  if (frameCount <= 1) return src;

  const out = cloneCanvas(src);
  const ctx = out.getContext('2d')!;
  const imgData = ctx.getImageData(0, 0, out.width, out.height);
  const { data, width, height } = imgData;

  const cellW = Math.floor(width / frameCount);

  for (let f = 1; f < frameCount; f++) {
    const borderX = f * cellW;
    // Clean a 2px band around each frame boundary
    for (let dx = -2; dx <= 2; dx++) {
      const x = borderX + dx;
      if (x < 0 || x >= width) continue;
      for (let y = 0; y < height; y++) {
        const i = (y * width + x) * 4;
        const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        // If near-white or very light and not fully opaque art, erase it
        if (lum > 200 && data[i + 3] > 0 && data[i + 3] < 255) {
          data[i + 3] = 0;
        }
        // Also catch fully opaque white smudges in border zones
        if (lum > 230 && data[i + 3] === 255) {
          data[i + 3] = 0;
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return out;
}

// ─── CLOTH MATERIAL POST-PROCESSING ───────────────────────────────

/**
 * Sharpen contrast between light/dark bands so spiral/weave detail
 * survives at 16×16 display size. Pushes midtones outward.
 */
function sharpenContrast(src: HTMLCanvasElement, strength: number = 0.35): HTMLCanvasElement {
  const out = cloneCanvas(src);
  const ctx = out.getContext('2d')!;
  const imgData = ctx.getImageData(0, 0, out.width, out.height);
  const { data } = imgData;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    for (let c = 0; c < 3; c++) {
      const v = data[i + c] / 255;
      const curved = 0.5 + (v - 0.5) * (1 + strength) / (1 + strength * Math.abs(2 * (v - 0.5)));
      data[i + c] = Math.round(Math.max(0, Math.min(255, curved * 255)));
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return out;
}

/**
 * Warm cream tint for cloth-type icons.
 */
const CLOTH_TINT: [number, number, number] = [0xD4, 0xC9, 0xB0];

function applyClothTint(src: HTMLCanvasElement, blend: number = 0.15): HTMLCanvasElement {
  const out = cloneCanvas(src);
  const ctx = out.getContext('2d')!;
  const imgData = ctx.getImageData(0, 0, out.width, out.height);
  const { data } = imgData;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    if (lum < 40) continue;
    data[i]     = Math.round(data[i]     + (CLOTH_TINT[0] - data[i])     * blend);
    data[i + 1] = Math.round(data[i + 1] + (CLOTH_TINT[1] - data[i + 1]) * blend);
    data[i + 2] = Math.round(data[i + 2] + (CLOTH_TINT[2] - data[i + 2]) * blend);
  }

  ctx.putImageData(imgData, 0, 0);
  return out;
}

// ─── METAL MATERIAL POST-PROCESSING ──────────────────────────────

/**
 * Cool blue-steel tint for metal/gear icons.
 * Blends existing color toward a target steel-blue hue (#8A9BB0)
 * for non-outline, non-transparent pixels.
 */
const METAL_TINT: [number, number, number] = [0x8A, 0x9B, 0xB0];

function applyMetalTint(src: HTMLCanvasElement, blend: number = 0.18): HTMLCanvasElement {
  const out = cloneCanvas(src);
  const ctx = out.getContext('2d')!;
  const imgData = ctx.getImageData(0, 0, out.width, out.height);
  const { data } = imgData;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    if (lum < 30) continue; // preserve dark outlines/shadows
    data[i]     = Math.round(data[i]     + (METAL_TINT[0] - data[i])     * blend);
    data[i + 1] = Math.round(data[i + 1] + (METAL_TINT[1] - data[i + 1]) * blend);
    data[i + 2] = Math.round(data[i + 2] + (METAL_TINT[2] - data[i + 2]) * blend);
  }

  ctx.putImageData(imgData, 0, 0);
  return out;
}

/**
 * Specular highlight boost for metal icons.
 * Brightens the top ~15% luminance pixels to simulate a specular edge catch,
 * giving the oiled-steel look depth at small resolutions.
 */
function boostSpecularHighlights(src: HTMLCanvasElement, brightnessBump: number = 35, threshold: number = 0.70): HTMLCanvasElement {
  const out = cloneCanvas(src);
  const ctx = out.getContext('2d')!;
  const imgData = ctx.getImageData(0, 0, out.width, out.height);
  const { data } = imgData;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
    if (lum >= threshold) {
      // Scale bump by how far above threshold — brightest pixels get full bump
      const factor = (lum - threshold) / (1 - threshold);
      const bump = Math.round(brightnessBump * factor);
      data[i]     = Math.min(255, data[i] + bump);
      data[i + 1] = Math.min(255, data[i + 1] + bump);
      data[i + 2] = Math.min(255, data[i + 2] + bump);
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return out;
}

// ─── MAIN PIPELINE ────────────────────────────────────────────────

export interface ProcessedResult {
  dataUrl: string;
  metadata: SpriteMetadata;
}

/**
 * Full tier-aware post-processing pipeline.
 * Accepts raw AI output + spec, returns production-ready data URL + Unity metadata.
 */
export async function processSpriteAsset(
  rawBase64: string,
  spec: SpriteSpec,
): Promise<ProcessedResult> {
  const srcCanvas = await base64ToCanvas(rawBase64);
  let processed: HTMLCanvasElement;

  switch (spec.tier) {
    case 'background': {
      // Crop letterbox bars (Gemini cinematic artifact), then bilinear downscale
      const cropped = cropLetterbox(srcCanvas);
      processed = bilinearDownscale(cropped, spec.targetW, spec.targetH);
      break;
    }

    case 'portrait':
      // Cascaded bilinear → NN → palette snap
      processed = cascadedDownscale(srcCanvas, spec.targetW, spec.targetH);
      if (spec.paletteHex.length > 0) {
        processed = paletteSnap(processed, spec.paletteHex);
      }
      break;

    case 'unit': {
      // If AI output is multi-row, reorganize into a single horizontal strip
      const unitSrc = spec.frameCount > 1
        ? reorganizeToStrip(srcCanvas, spec.frameCount, spec.targetW, spec.targetH)
        : srcCanvas;
      // NN downscale if needed, palette snap, outline
      if (unitSrc.width > spec.targetW * 1.5 || unitSrc.height > spec.targetH * 1.5) {
        processed = nearestNeighborDownscale(unitSrc, spec.targetW, spec.targetH);
      } else {
        processed = cloneCanvas(unitSrc);
      }
      if (spec.paletteHex.length > 0) {
        processed = paletteSnap(processed, spec.paletteHex);
      }
      processed = cleanInterFrameSmudges(processed, spec.frameCount);
      processed = cleanAlphaFringe(processed);
      processed = applyOutline(processed, '#0C0C14');
      break;
    }

    case 'tile':
    case 'node':
      processed = nearestNeighborDownscale(srcCanvas, spec.targetW, spec.targetH);
      if (spec.paletteHex.length > 0) {
        processed = paletteSnap(processed, spec.paletteHex);
      }
      // Material-specific post-processing before outline
      if (spec.materialTag === 'cloth') {
        processed = sharpenContrast(processed, 0.35);
        processed = applyClothTint(processed, 0.15);
      } else if (spec.materialTag === 'metal') {
        processed = sharpenContrast(processed, 0.40);
        processed = applyMetalTint(processed, 0.18);
        processed = boostSpecularHighlights(processed, 35, 0.70);
      }
      processed = cleanAlphaFringe(processed);
      processed = applyOutline(processed, '#0C0C14');
      break;
  }

  const metadata = buildUnityMetadata(spec);
  return { dataUrl: processed.toDataURL('image/png'), metadata };
}

/**
 * Convenience wrapper: infer tier from legacy asset type + dims and process.
 * Used when a full SpriteSpec isn't available (ad-hoc generation).
 */
export async function processAdHoc(
  rawBase64: string,
  assetType: string,
  targetW: number,
  targetH: number,
  paletteHex: string[],
  skipQuantize: boolean = false,
): Promise<string> {
  const tier = inferTier(assetType, targetW, targetH);

  const adhocSpec: SpriteSpec = {
    tier,
    assetKey: `adhoc_${assetType}`,
    targetW,
    targetH,
    frameCount: 1,
    ppu: tier === 'background' ? 1 : 32,
    paletteHex: skipQuantize ? [] : paletteHex,
    unityPath: `Sprites/AdHoc/adhoc_${assetType}`,
    filterMode: tier === 'background' ? 'Bilinear' : 'Point',
  };

  const result = await processSpriteAsset(rawBase64, adhocSpec);
  return result.dataUrl;
}
