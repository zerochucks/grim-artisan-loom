import { useState, useRef, useEffect, useCallback } from 'react';
import type { GeneratedAsset } from '@/lib/forge-constants';
import { downloadPNG } from '@/lib/export-utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';

interface GeneratorCanvasProps {
  currentAssets: GeneratedAsset[];
  sessionHistory: GeneratedAsset[];
  generating: boolean;
  compareAssets: GeneratedAsset[] | null;
  onSave: (asset: GeneratedAsset) => void;
  onLoadFromHistory?: (assets: GeneratedAsset[]) => void;
  onReroll?: (asset: GeneratedAsset) => void;
  onVariation?: (asset: GeneratedAsset) => void;
}

function DownscalePreview({ asset }: { asset: GeneratedAsset }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = asset.width;
    canvas.height = asset.height;
    const img = new Image();
    img.onload = () => {
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, asset.width, asset.height);
      ctx.drawImage(img, 0, 0, asset.width, asset.height);
    };
    img.src = asset.imageDataUrl;
  }, [asset]);

  return (
    <div className="space-y-1">
      <p className="text-[9px] text-accent font-display tracking-widest">ACTUAL SIZE PREVIEW ({asset.width}×{asset.height})</p>
      <div className="checkerboard border border-border p-2 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          className="pixel-render"
          style={{
            width: asset.width * Math.max(1, zoom),
            height: asset.height * Math.max(1, zoom),
          }}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[9px] text-muted-foreground">1×</span>
        <Slider min={1} max={8} step={1} value={[zoom]} onValueChange={([v]) => setZoom(v)} className="flex-1" />
        <span className="text-[9px] text-muted-foreground">8×</span>
      </div>
    </div>
  );
}

function ABCompare({ assetA, assetB }: { assetA: GeneratedAsset; assetB: GeneratedAsset }) {
  const [split, setSplit] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  const scale = Math.max(1, Math.floor(300 / assetA.width));
  const displayW = assetA.width * scale;
  const displayH = assetA.height * scale;

  return (
    <div className="space-y-2">
      <p className="text-[9px] text-accent font-display tracking-widest">A/B COMPARE</p>
      <div
        ref={containerRef}
        className="relative border border-border overflow-hidden checkerboard"
        style={{ width: displayW, height: displayH }}
      >
        <img
          src={assetA.imageDataUrl}
          alt="Version A"
          className="pixel-render absolute inset-0"
          style={{ width: displayW, height: displayH }}
        />
        <div
          className="absolute top-0 bottom-0 right-0 overflow-hidden"
          style={{ left: `${split}%` }}
        >
          <img
            src={assetB.imageDataUrl}
            alt="Version B"
            className="pixel-render"
            style={{
              width: displayW,
              height: displayH,
              marginLeft: `-${(split / 100) * displayW}px`,
            }}
          />
        </div>
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-primary z-10 cursor-col-resize"
          style={{ left: `${split}%` }}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[9px] text-accent font-display">A</span>
        <Slider min={0} max={100} step={1} value={[split]} onValueChange={([v]) => setSplit(v)} className="flex-1" />
        <span className="text-[9px] text-accent font-display">B</span>
      </div>
    </div>
  );
}

export function GeneratorCanvas({
  currentAssets, sessionHistory, generating, compareAssets,
  onSave, onLoadFromHistory, onReroll, onVariation,
}: GeneratorCanvasProps) {
  const [selectedHistoryAsset, setSelectedHistoryAsset] = useState<GeneratedAsset | null>(null);
  const [showDownscale, setShowDownscale] = useState<number | null>(null);

  const getDisplaySize = (asset: GeneratedAsset) => {
    const scale = Math.max(1, Math.floor(300 / asset.width));
    return {
      width: Math.min(asset.width * scale, 400),
      height: Math.min(asset.height * scale, 400),
    };
  };

  return (
    <div className="flex-1 overflow-auto">
      {/* A/B Compare Mode */}
      {compareAssets && currentAssets.length > 0 && (
        <div className="p-4 border-b border-border">
          <ABCompare assetA={compareAssets[0]} assetB={currentAssets[0]} />
        </div>
      )}

      {/* Main Preview */}
      <div className="p-4">
        {generating ? (
          <div className="checkerboard border border-border flex items-center justify-center relative overflow-hidden" style={{ minHeight: 300 }}>
            <div className="scanline" />
            <p className="font-display text-sm text-primary animate-pulse z-10">EXTRACTING PIXELS...</p>
          </div>
        ) : currentAssets.length > 0 ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-4">
              {currentAssets.map((asset, i) => {
                const size = getDisplaySize(asset);
                return (
                  <div key={i} className="space-y-2">
                    <div className="checkerboard border border-border p-4 flex items-center justify-center">
                      <img
                        src={asset.imageDataUrl}
                        alt={asset.name}
                        className="pixel-render"
                        style={size}
                      />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="outline" onClick={() => downloadPNG(asset.imageDataUrl, asset.name)} className="text-[10px] h-6 px-2">
                        PNG
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onSave(asset)} className="text-[10px] h-6 px-2">
                        SAVE
                      </Button>
                      {onReroll && (
                        <Button size="sm" variant="outline" onClick={() => onReroll(asset)} className="text-[10px] h-6 px-2" title="Re-roll with same prompt">
                          🔄
                        </Button>
                      )}
                      {onVariation && (
                        <Button size="sm" variant="outline" onClick={() => onVariation(asset)} className="text-[10px] h-6 px-2" title="Generate variation">
                          🎲
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant={showDownscale === i ? 'default' : 'outline'}
                        onClick={() => setShowDownscale(showDownscale === i ? null : i)}
                        className="text-[10px] h-6 px-2"
                        title="Toggle actual-size preview"
                      >
                        🔍
                      </Button>
                      {asset.scenePiece && (
                        <span className="text-[10px] text-accent font-display tracking-widest self-center">
                          {asset.scenePiece.toUpperCase()}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground self-center ml-1 font-body truncate max-w-[200px]">
                        {asset.name}
                      </span>
                    </div>
                    {showDownscale === i && <DownscalePreview asset={asset} />}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="checkerboard border border-border flex items-center justify-center" style={{ minHeight: 300 }}>
            <div className="text-center space-y-2">
              <p className="font-display text-sm text-muted-foreground">AWAITING INSTRUCTIONS</p>
              <p className="text-xs text-muted-foreground font-body">Describe an asset and hit FORGE</p>
            </div>
          </div>
        )}
      </div>

      {/* Session History */}
      {sessionHistory.length > 0 && (
        <div className="border-t border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-[10px] text-accent tracking-widest">SESSION HISTORY</h3>
            {onLoadFromHistory && (
              <Button size="sm" variant="outline" onClick={() => onLoadFromHistory(sessionHistory)} className="text-[10px] h-6 px-2">
                RELOAD ALL
              </Button>
            )}
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {sessionHistory.map((asset, i) => (
              <div
                key={i}
                className="checkerboard border border-border p-1 flex items-center justify-center cursor-pointer hover:border-accent transition-colors group relative"
                title={`${asset.name} — click to preview`}
                onClick={() => setSelectedHistoryAsset(asset)}
              >
                <img src={asset.imageDataUrl} alt={asset.name} className="pixel-render w-full h-auto" />
                {asset.scenePiece && (
                  <span className="absolute bottom-0 left-0 right-0 bg-background/80 text-[8px] text-accent font-display tracking-widest text-center py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {asset.scenePiece.toUpperCase()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History Asset Detail Dialog */}
      <Dialog open={!!selectedHistoryAsset} onOpenChange={(open) => !open && setSelectedHistoryAsset(null)}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogTitle className="font-display text-xs text-accent tracking-widest">
            {selectedHistoryAsset?.name}
          </DialogTitle>
          {selectedHistoryAsset && (
            <div className="space-y-3">
              <div className="checkerboard border border-border p-4 flex items-center justify-center">
                <img
                  src={selectedHistoryAsset.imageDataUrl}
                  alt={selectedHistoryAsset.name}
                  className="pixel-render"
                  style={getDisplaySize(selectedHistoryAsset)}
                />
              </div>
              <DownscalePreview asset={selectedHistoryAsset} />
              <div className="text-[10px] text-muted-foreground font-body space-y-1">
                <p><span className="text-accent">Type:</span> {selectedHistoryAsset.assetType}</p>
                <p><span className="text-accent">Size:</span> {selectedHistoryAsset.width}×{selectedHistoryAsset.height}</p>
                <p><span className="text-accent">Prompt:</span> {selectedHistoryAsset.prompt}</p>
                {selectedHistoryAsset.scenePiece && (
                  <p><span className="text-accent">Scene Piece:</span> {selectedHistoryAsset.scenePiece}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => downloadPNG(selectedHistoryAsset.imageDataUrl, selectedHistoryAsset.name)} className="text-[10px] h-7">
                  ⬇ PNG
                </Button>
                <Button size="sm" variant="outline" onClick={() => { onSave(selectedHistoryAsset); setSelectedHistoryAsset(null); }} className="text-[10px] h-7">
                  💾 SAVE
                </Button>
                {onReroll && (
                  <Button size="sm" variant="outline" onClick={() => { onReroll(selectedHistoryAsset); setSelectedHistoryAsset(null); }} className="text-[10px] h-7">
                    🔄 RE-ROLL
                  </Button>
                )}
                {onVariation && (
                  <Button size="sm" variant="outline" onClick={() => { onVariation(selectedHistoryAsset); setSelectedHistoryAsset(null); }} className="text-[10px] h-7">
                    🎲 VARIATION
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
