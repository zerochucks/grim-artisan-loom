import JSZip from 'jszip';
import type { GeneratedAsset } from './forge-constants';

/**
 * Download a single PNG from a data URL.
 */
export function downloadPNG(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

/**
 * Create a spritesheet canvas from multiple assets.
 */
export function createSpritesheet(
  assets: GeneratedAsset[],
  columns: number = 4,
  padding: number = 1,
  bgColor: string | null = null
): HTMLCanvasElement {
  if (assets.length === 0) {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    return c;
  }

  const maxW = Math.max(...assets.map((a) => a.width));
  const maxH = Math.max(...assets.map((a) => a.height));
  const cols = Math.min(columns, assets.length);
  const rows = Math.ceil(assets.length / cols);

  const canvas = document.createElement('canvas');
  canvas.width = cols * (maxW + padding) - padding;
  canvas.height = rows * (maxH + padding) - padding;
  const ctx = canvas.getContext('2d')!;

  if (bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const loadPromises = assets.map((asset, i) => {
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = col * (maxW + padding);
        const y = row * (maxH + padding);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, x, y);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = asset.imageDataUrl;
    });
  });

  // Note: this is sync for already-loaded data URLs
  // For async use, call createSpritesheetAsync instead
  return canvas;
}

/**
 * Async spritesheet creation.
 */
export async function createSpritesheetAsync(
  assets: GeneratedAsset[],
  columns: number = 4,
  padding: number = 1,
  bgColor: string | null = null
): Promise<string> {
  if (assets.length === 0) return '';

  const maxW = Math.max(...assets.map((a) => a.width));
  const maxH = Math.max(...assets.map((a) => a.height));
  const cols = Math.min(columns, assets.length);
  const rows = Math.ceil(assets.length / cols);

  const canvas = document.createElement('canvas');
  canvas.width = cols * (maxW + padding) - padding;
  canvas.height = rows * (maxH + padding) - padding;
  const ctx = canvas.getContext('2d')!;

  if (bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  await Promise.all(
    assets.map(
      (asset, i) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, col * (maxW + padding), row * (maxH + padding));
            resolve();
          };
          img.onerror = () => resolve();
          img.src = asset.imageDataUrl;
        })
    )
  );

  return canvas.toDataURL('image/png');
}

/**
 * Export multiple assets as a ZIP file.
 */
export async function exportZip(assets: GeneratedAsset[]): Promise<void> {
  const zip = new JSZip();

  for (const asset of assets) {
    const base64 = asset.imageDataUrl.split(',')[1];
    if (base64) {
      zip.file(asset.name, base64, { base64: true });
    }
  }

  // Add metadata JSON
  const metadata = {
    assets: assets.map((a, i) => ({
      name: a.name,
      type: a.assetType,
      width: a.width,
      height: a.height,
      palette: a.paletteName,
      prompt: a.prompt,
      sheetPosition: { col: i % 4, row: Math.floor(i / 4) },
    })),
  };
  zip.file('metadata.json', JSON.stringify(metadata, null, 2));

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = 'pixel-forge-assets.zip';
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Generate metadata JSON for Unity import.
 */
export function generateMetadataJSON(assets: GeneratedAsset[]): string {
  const metadata = {
    generator: 'Pixel Forge',
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    unityImportSettings: {
      textureType: 'Sprite (2D and UI)',
      filterMode: 'Point (no filter)',
      compression: 'None',
    },
    assets: assets.map((a, i) => ({
      name: a.name,
      type: a.assetType,
      width: a.width,
      height: a.height,
      pixelsPerUnit: a.width,
      palette: a.paletteName,
      prompt: a.prompt,
      styleModifiers: a.styleModifiers,
      generationMode: a.generationMode,
      sheetPosition: { col: i % 4, row: Math.floor(i / 4) },
    })),
    folderStructure: {
      Characters: 'chr_*.png',
      Equipment: 'gear_*.png',
      Icons: 'icon_*.png',
      Tiles: 'tile_*.png',
      Items: 'itm_*.png',
      Props: 'env_*.png',
      Effects: 'fx_*.png',
      UI: 'ui_*.png',
    },
  };
  return JSON.stringify(metadata, null, 2);
}
