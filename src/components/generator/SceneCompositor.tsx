import { useState, useRef, useEffect } from 'react';
import type { GeneratedAsset } from '@/lib/forge-constants';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

interface SceneCompositorProps {
  assets: GeneratedAsset[];
}

interface LayerState {
  x: number;
  y: number;
  scale: number;
  opacity: number;
}

const CANVAS_W = 400;
const CANVAS_H = 300;

const DEFAULT_LAYERS: Record<string, LayerState> = {
  Background: { x: 0, y: 0, scale: 1, opacity: 1 },
  Props: { x: 0.3, y: 0.6, scale: 0.5, opacity: 1 },
  Portrait: { x: 0.2, y: 0.1, scale: 0.6, opacity: 1 },
};

export function SceneCompositor({ assets }: SceneCompositorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [layers, setLayers] = useState<Record<string, LayerState>>(() => {
    const init: Record<string, LayerState> = {};
    for (const asset of assets) {
      const key = asset.scenePiece || asset.name;
      init[key] = DEFAULT_LAYERS[key] || { x: 0, y: 0, scale: 1, opacity: 1 };
    }
    return init;
  });
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const layerOrder = ['Background', 'Props', 'Portrait'];
  const orderedAssets = layerOrder
    .map(label => assets.find(a => a.scenePiece === label))
    .filter(Boolean) as GeneratedAsset[];

  // Add any assets not in the standard order
  for (const asset of assets) {
    if (!orderedAssets.includes(asset)) orderedAssets.push(asset);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !open) return;

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Draw checkerboard background
    const checkSize = 8;
    for (let y = 0; y < CANVAS_H; y += checkSize) {
      for (let x = 0; x < CANVAS_W; x += checkSize) {
        ctx.fillStyle = ((x / checkSize + y / checkSize) % 2 === 0) ? '#1a1a1e' : '#222228';
        ctx.fillRect(x, y, checkSize, checkSize);
      }
    }

    // Draw layers in order
    const drawPromises = orderedAssets.map((asset) => {
      const key = asset.scenePiece || asset.name;
      const layer = layers[key] || { x: 0, y: 0, scale: 1, opacity: 1 };

      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          ctx.save();
          ctx.globalAlpha = layer.opacity;
          ctx.imageSmoothingEnabled = false;
          const drawW = CANVAS_W * layer.scale;
          const drawH = CANVAS_H * layer.scale;
          const drawX = layer.x * CANVAS_W;
          const drawY = layer.y * CANVAS_H;
          ctx.drawImage(img, drawX, drawY, drawW, drawH);
          ctx.restore();
          resolve();
        };
        img.onerror = () => resolve();
        img.src = asset.imageDataUrl;
      });
    });

    // Sequential draw to maintain layer order
    drawPromises.reduce((chain, p) => chain.then(() => p), Promise.resolve());
  }, [layers, orderedAssets, open]);

  const updateLayer = (key: string, update: Partial<LayerState>) => {
    setLayers(prev => ({
      ...prev,
      [key]: { ...prev[key], ...update },
    }));
  };

  const handleExportComposite = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'scene_composite.png';
    link.href = dataUrl;
    link.click();
  };

  if (orderedAssets.length < 2) return null;

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="w-full text-[10px] h-7 justify-start">
        🎭 Scene Compositor
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogTitle className="font-display text-xs text-accent tracking-widest">
            SCENE COMPOSITOR
          </DialogTitle>
          <div className="flex gap-4">
            {/* Canvas */}
            <div className="space-y-2">
              <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                className="border border-border"
              />
              <Button size="sm" variant="outline" onClick={handleExportComposite} className="text-[10px] h-7">
                ⬇ EXPORT COMPOSITE
              </Button>
            </div>

            {/* Layer Controls */}
            <div className="flex-1 space-y-3 min-w-[180px]">
              <p className="text-[9px] text-accent font-display tracking-widest">LAYERS</p>
              {orderedAssets.map((asset) => {
                const key = asset.scenePiece || asset.name;
                const layer = layers[key] || { x: 0, y: 0, scale: 1, opacity: 1 };
                const isSelected = selectedLayer === key;

                return (
                  <div
                    key={key}
                    className={`border p-2 space-y-2 cursor-pointer transition-colors ${
                      isSelected ? 'border-accent bg-accent/5' : 'border-border hover:border-muted-foreground'
                    }`}
                    onClick={() => setSelectedLayer(isSelected ? null : key)}
                  >
                    <p className="text-[10px] text-foreground font-body">{key}</p>
                    {isSelected && (
                      <div className="space-y-2">
                        <div>
                          <label className="text-[9px] text-muted-foreground">X Position</label>
                          <Slider min={-1} max={1} step={0.01} value={[layer.x]} onValueChange={([v]) => updateLayer(key, { x: v })} />
                        </div>
                        <div>
                          <label className="text-[9px] text-muted-foreground">Y Position</label>
                          <Slider min={-1} max={1} step={0.01} value={[layer.y]} onValueChange={([v]) => updateLayer(key, { y: v })} />
                        </div>
                        <div>
                          <label className="text-[9px] text-muted-foreground">Scale ({Math.round(layer.scale * 100)}%)</label>
                          <Slider min={0.1} max={2} step={0.05} value={[layer.scale]} onValueChange={([v]) => updateLayer(key, { scale: v })} />
                        </div>
                        <div>
                          <label className="text-[9px] text-muted-foreground">Opacity ({Math.round(layer.opacity * 100)}%)</label>
                          <Slider min={0} max={1} step={0.05} value={[layer.opacity]} onValueChange={([v]) => updateLayer(key, { opacity: v })} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
