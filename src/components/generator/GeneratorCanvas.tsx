import type { GeneratedAsset } from '@/lib/forge-constants';
import { downloadPNG } from '@/lib/export-utils';
import { Button } from '@/components/ui/button';

interface GeneratorCanvasProps {
  currentAssets: GeneratedAsset[];
  sessionHistory: GeneratedAsset[];
  generating: boolean;
  onSave: (asset: GeneratedAsset) => void;
}

export function GeneratorCanvas({ currentAssets, sessionHistory, generating, onSave }: GeneratorCanvasProps) {
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
          <h3 className="font-display text-[10px] text-accent tracking-widest mb-3">SESSION HISTORY</h3>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {sessionHistory.map((asset, i) => (
              <div
                key={i}
                className="checkerboard border border-border p-1 flex items-center justify-center cursor-pointer hover:border-accent transition-colors"
                title={asset.name}
              >
                <img
                  src={asset.imageDataUrl}
                  alt={asset.name}
                  className="pixel-render w-full h-auto"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
