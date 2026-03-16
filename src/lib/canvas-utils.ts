/**
 * Render a hex grid onto a canvas and return the data URL.
 */
export function renderGrid(
  gridRows: string[],
  paletteColors: string[],
  width: number,
  height: number
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.clearRect(0, 0, width, height);

  for (let y = 0; y < Math.min(gridRows.length, height); y++) {
    const row = gridRows[y];
    for (let x = 0; x < Math.min(row.length, width); x++) {
      const idx = parseInt(row[x], 16);
      if (idx === 0 || isNaN(idx)) continue;
      if (idx < paletteColors.length) {
        ctx.fillStyle = paletteColors[idx];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  return canvas.toDataURL('image/png');
}

/**
 * Quantize an image's colors to the nearest palette color.
 */
export function quantizeToPalette(
  imageData: ImageData,
  paletteHexColors: string[]
): ImageData {
  const palette = paletteHexColors.map((hex) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b, hex };
  });

  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 128) {
      data[i + 3] = 0;
      continue;
    }
    let minDist = Infinity;
    let nearest = palette[0];
    for (const c of palette) {
      const dr = data[i] - c.r;
      const dg = data[i + 1] - c.g;
      const db = data[i + 2] - c.b;
      const dist = dr * dr + dg * dg + db * db;
      if (dist < minDist) {
        minDist = dist;
        nearest = c;
      }
    }
    data[i] = nearest.r;
    data[i + 1] = nearest.g;
    data[i + 2] = nearest.b;
    data[i + 3] = 255;
  }
  return imageData;
}

/**
 * Downscale a canvas using nearest-neighbor interpolation.
 */
export function downscaleNearestNeighbor(
  srcCanvas: HTMLCanvasElement,
  targetW: number,
  targetH: number
): HTMLCanvasElement {
  const dst = document.createElement('canvas');
  dst.width = targetW;
  dst.height = targetH;
  const ctx = dst.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(srcCanvas, 0, 0, targetW, targetH);
  return dst;
}

/**
 * Load a base64 image onto a canvas.
 */
export function base64ToCanvas(base64: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
  });
}

/**
 * Post-process a rendered image: downscale + optional quantize.
 * When skipQuantize is true, only downscale without palette quantization
 * to preserve the AI-generated color quality.
 */
export async function postProcessRender(
  base64Image: string,
  targetW: number,
  targetH: number,
  paletteColors: string[],
  skipQuantize: boolean = false
): Promise<string> {
  const srcCanvas = await base64ToCanvas(base64Image);
  const downscaled = downscaleNearestNeighbor(srcCanvas, targetW, targetH);

  if (!skipQuantize) {
    const ctx = downscaled.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, targetW, targetH);
    const quantized = quantizeToPalette(imageData, paletteColors);
    ctx.putImageData(quantized, 0, 0);
  }

  return downscaled.toDataURL('image/png');
}

/**
 * Generate an auto-name for an asset.
 */
export function generateAssetName(
  prompt: string,
  typePrefix: string,
  width: number,
  height: number,
  index: number = 1
): string {
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['the', 'and', 'with', 'for'].includes(w))
    .slice(0, 3);
  const descriptor = words.join('_') || 'unnamed';
  const idx = String(index).padStart(3, '0');
  return `${typePrefix}${descriptor}_${idx}_${width}x${height}.png`;
}
