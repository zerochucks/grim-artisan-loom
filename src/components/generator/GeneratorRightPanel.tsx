import { useState } from 'react';
import type { GeneratedAsset } from '@/lib/forge-constants';
import { downloadPNG, exportZip, createSpritesheetAsync, generateMetadataJSON } from '@/lib/export-utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface GeneratorRightPanelProps {
  currentAssets: GeneratedAsset[];
  sessionHistory: GeneratedAsset[];
}

export function GeneratorRightPanel({ currentAssets, sessionHistory }: GeneratorRightPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="w-8 border-l border-border bg-card flex items-center justify-center text-muted-foreground hover:text-accent transition-colors"
        title="Expand panel"
      >
        <span className="text-xs rotate-90 whitespace-nowrap font-display tracking-widest">TOOLS</span>
      </button>
    );
  }

  const handleExportSpritesheet = async () => {
    const assets = currentAssets.length > 0 ? currentAssets : sessionHistory;
    if (assets.length === 0) return;
    const dataUrl = await createSpritesheetAsync(assets, 4, 1);
    if (dataUrl) {
      downloadPNG(dataUrl, 'spritesheet.png');
      toast.success('SPRITESHEET FORGED.');
    }
  };

  const handleExportZip = async () => {
    const assets = currentAssets.length > 0 ? currentAssets : sessionHistory;
    if (assets.length === 0) return;
    await exportZip(assets);
    toast.success('ZIP DISPATCHED.');
  };

  const handleExportMetadata = () => {
    const assets = currentAssets.length > 0 ? currentAssets : sessionHistory;
    const json = generateMetadataJSON(assets);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'pixel-forge-metadata.json';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('METADATA EXPORTED.');
  };

  return (
    <div className="w-[240px] border-l border-border bg-card overflow-y-auto flex-shrink-0">
      <div className="p-3 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[10px] text-accent tracking-widest">TOOLS</h2>
          <button
            onClick={() => setCollapsed(true)}
            className="text-xs text-muted-foreground hover:text-accent"
          >
            ✕
          </button>
        </div>

        {/* Export */}
        <Section title="EXPORT">
          <div className="space-y-1">
            <Button size="sm" variant="outline" onClick={handleExportSpritesheet} className="w-full text-[10px] h-7 justify-start">
              📐 Spritesheet
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportZip} className="w-full text-[10px] h-7 justify-start">
              📦 ZIP Archive
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportMetadata} className="w-full text-[10px] h-7 justify-start">
              📋 Metadata JSON
            </Button>
          </div>
        </Section>

        {/* Brand Guidelines */}
        <Section title="BRAND GUIDELINES">
          <div className="space-y-2 text-[10px] text-muted-foreground font-body">
            <div>
              <p className="text-accent mb-0.5">Art Direction:</p>
              <p>Grimdark low-fantasy, morally-gray, gritty, weathered</p>
            </div>
            <div>
              <p className="text-accent mb-0.5">References:</p>
              <p>Stoneshard, Darkest Dungeon, Kingdom Death</p>
            </div>
          </div>
        </Section>

        {/* Lighting Signature */}
        <Section title="LIGHTING SIGNATURE">
          <div className="space-y-1.5 text-[10px] text-muted-foreground font-body">
            <p><span className="text-accent">Key:</span> Warm torchlight, upper-left</p>
            <p><span className="text-accent">Rim:</span> Cyan-blue, ONE edge (right)</p>
            <p><span className="text-accent">Shadows:</span> Hue-shifted purple/blue</p>
            <p><span className="text-accent">Rule:</span> No patchy outlines</p>
          </div>
        </Section>

        {/* Value Structure */}
        <Section title="VALUE RULES">
          <div className="space-y-1.5 text-[10px] text-muted-foreground font-body">
            <p><span className="text-accent">≤64px:</span> 4+ tonal bands, force torso breaks</p>
            <p><span className="text-accent">≤128px:</span> Clear form shapes, moderate detail</p>
            <p><span className="text-accent">Larger:</span> Full detail, maintain silhouette</p>
            <p className="text-primary/80 mt-1">⚠ Torso must never collapse into single mass</p>
          </div>
        </Section>

        {/* Color Direction */}
        <Section title="COLOR DIRECTION">
          <div className="space-y-1 text-[10px] text-muted-foreground font-body">
            <p>Muted earth tones base</p>
            <p>Warm accents (red/gold) — sparingly</p>
            <p>Purple/blue shadow shifts</p>
            <p>Gold/amber highlights</p>
            <p>Low saturation, strategic pops</p>
          </div>
        </Section>

        {/* Unity Reference */}
        <Section title="UNITY IMPORT">
          <div className="space-y-2 text-[10px] text-muted-foreground font-body">
            <div>
              <p className="text-accent mb-0.5">Texture Type:</p>
              <p>Sprite (2D and UI)</p>
            </div>
            <div>
              <p className="text-accent mb-0.5">Filter Mode:</p>
              <p>Point (no filter)</p>
            </div>
            <div>
              <p className="text-accent mb-0.5">Compression:</p>
              <p>None</p>
            </div>
          </div>
        </Section>

        {/* Naming Convention */}
        <Section title="NAMING">
          <div className="space-y-1 text-[10px] text-muted-foreground font-body">
            <p>chr_ — Characters</p>
            <p>gear_ — Equipment</p>
            <p>icon_ — Ability icons</p>
            <p>tile_ — Tilesets</p>
            <p>itm_ — Items</p>
            <p>env_ — Props</p>
            <p>fx_ — Effects</p>
            <p>ui_ — UI elements</p>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-display text-[10px] text-accent tracking-widest mb-2">{title}</h3>
      {children}
    </div>
  );
}
