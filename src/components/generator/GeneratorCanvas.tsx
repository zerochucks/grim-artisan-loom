import { useState } from 'react';
import type { GeneratedAsset } from '@/lib/forge-constants';
import { downloadPNG } from '@/lib/export-utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

interface GeneratorCanvasProps {
  currentAssets: GeneratedAsset[];
  sessionHistory: GeneratedAsset[];
  generating: boolean;
  onSave: (asset: GeneratedAsset) => void;
  onLoadFromHistory?: (assets: GeneratedAsset[]) => void;
}

export function GeneratorCanvas({ currentAssets, sessionHistory, generating, onSave, onLoadFromHistory }: GeneratorCanvasProps) {
  const [selectedHistoryAsset, setSelectedHistoryAsset] = useState<GeneratedAsset | null>(null);

  return (
    <div className="flex-1 overflow-auto">
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
              {currentAssets.map((asset, i) => (
                <div key={i} className="space-y-2">
                  <div className="checkerboard border border-border p-4 flex items-center justify-center">
                    <img
                      src={asset.imageDataUrl}
                      alt={asset.name}
                      className="pixel-render"
                      style={{
                        width: Math.min(asset.width * Math.max(1, Math.floor(300 / asset.width)), 400),
                        height: Math.min(asset.height * Math.max(1, Math.floor(300 / asset.width)), 400),
                      }}
                    />
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadPNG(asset.imageDataUrl, asset.name)}
                      className="text-[10px] h-6 px-2"
                    >
                      PNG
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSave(asset)}
                      className="text-[10px] h-6 px-2"
                    >
                      SAVE
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
                </div>
              ))}
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
              <Button
                size="sm"
                variant="outline"
                onClick={() => onLoadFromHistory(sessionHistory)}
                className="text-[10px] h-6 px-2"
              >
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
                <img
                  src={asset.imageDataUrl}
                  alt={asset.name}
                  className="pixel-render w-full h-auto"
                />
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
                  style={{
                    width: Math.min(selectedHistoryAsset.width * Math.max(1, Math.floor(300 / selectedHistoryAsset.width)), 400),
                    height: Math.min(selectedHistoryAsset.height * Math.max(1, Math.floor(300 / selectedHistoryAsset.width)), 400),
                  }}
                />
              </div>
              <div className="text-[10px] text-muted-foreground font-body space-y-1">
                <p><span className="text-accent">Type:</span> {selectedHistoryAsset.assetType}</p>
                <p><span className="text-accent">Size:</span> {selectedHistoryAsset.width}×{selectedHistoryAsset.height}</p>
                <p><span className="text-accent">Prompt:</span> {selectedHistoryAsset.prompt}</p>
                {selectedHistoryAsset.scenePiece && (
                  <p><span className="text-accent">Scene Piece:</span> {selectedHistoryAsset.scenePiece}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadPNG(selectedHistoryAsset.imageDataUrl, selectedHistoryAsset.name)}
                  className="text-[10px] h-7"
                >
                  ⬇ PNG
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onSave(selectedHistoryAsset);
                    setSelectedHistoryAsset(null);
                  }}
                  className="text-[10px] h-7"
                >
                  💾 SAVE TO VAULT
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
