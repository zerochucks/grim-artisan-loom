import {
  ASSET_TYPES, BUILT_IN_PALETTES, STYLE_MODIFIERS, RESOLUTION_PRESETS,
  type AssetTypeId, type StyleModifierId,
} from '@/lib/forge-constants';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';

interface GeneratorSidebarProps {
  assetType: AssetTypeId;
  onAssetTypeChange: (v: AssetTypeId) => void;
  width: number;
  height: number;
  onWidthChange: (v: number) => void;
  onHeightChange: (v: number) => void;
  paletteIndex: number;
  onPaletteIndexChange: (v: number) => void;
  modifiers: StyleModifierId[];
  onModifiersChange: (v: StyleModifierId[]) => void;
  variationCount: number;
  onVariationCountChange: (v: number) => void;
  generationMode: 'forge' | 'render';
  onGenerationModeChange: (v: 'forge' | 'render') => void;
}

export function GeneratorSidebar({
  assetType, onAssetTypeChange,
  width, height, onWidthChange, onHeightChange,
  paletteIndex, onPaletteIndexChange,
  modifiers, onModifiersChange,
  variationCount, onVariationCountChange,
  generationMode, onGenerationModeChange,
}: GeneratorSidebarProps) {
  const toggleModifier = (id: StyleModifierId) => {
    const mod = STYLE_MODIFIERS.find((m) => m.id === id)!;
    // Remove same-group modifiers, then toggle
    const sameGroup = STYLE_MODIFIERS.filter((m) => m.group === mod.group).map((m) => m.id);
    const filtered = modifiers.filter((m) => !sameGroup.includes(m));
    if (modifiers.includes(id)) {
      onModifiersChange(filtered);
    } else {
      onModifiersChange([...filtered, id]);
    }
  };

  return (
    <div className="w-[260px] border-r border-border bg-card overflow-y-auto flex-shrink-0">
      <div className="p-3 space-y-4">
        {/* Asset Type */}
        <Section title="ASSET TYPE">
          <div className="grid grid-cols-2 gap-1">
            {ASSET_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => onAssetTypeChange(t.id)}
                className={`text-left px-2 py-1.5 text-[11px] font-body border transition-colors ${
                  assetType === t.id
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-muted/50 text-muted-foreground hover:border-accent'
                }`}
              >
                <span className="mr-1">{t.icon}</span>
                {t.label.split(' ')[0]}
              </button>
            ))}
          </div>
        </Section>

        {/* Resolution */}
        <Section title="RESOLUTION">
          <div className="grid grid-cols-4 gap-1">
            {RESOLUTION_PRESETS.map((r) => (
              <button
                key={`${r.w}x${r.h}`}
                onClick={() => { onWidthChange(r.w); onHeightChange(r.h); }}
                className={`text-[10px] font-body px-1 py-1 border transition-colors ${
                  width === r.w && height === r.h
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border text-muted-foreground hover:border-accent'
                }`}
              >
                {'label' in r ? r.label : `${r.w}×${r.h}`}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground">W</label>
              <Input
                type="number"
                min={8}
                max={128}
                value={width}
                onChange={(e) => onWidthChange(Number(e.target.value))}
                className="h-6 text-xs bg-muted border-border px-1"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground">H</label>
              <Input
                type="number"
                min={8}
                max={128}
                value={height}
                onChange={(e) => onHeightChange(Number(e.target.value))}
                className="h-6 text-xs bg-muted border-border px-1"
              />
            </div>
          </div>
        </Section>

        {/* Palette */}
        <Section title="PALETTE">
          <div className="space-y-1">
            {BUILT_IN_PALETTES.map((p, i) => (
              <button
                key={p.name}
                onClick={() => onPaletteIndexChange(i)}
                className={`w-full text-left border p-1.5 transition-colors ${
                  paletteIndex === i
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-accent'
                }`}
              >
                <p className="text-[11px] text-foreground font-body mb-1">{p.name}</p>
                <div className="flex gap-0">
                  {p.colors.slice(0, 16).map((c, ci) => (
                    <div
                      key={ci}
                      className="h-3 flex-1"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </button>
            ))}
          </div>
        </Section>

        {/* Style Modifiers */}
        <Section title="STYLE MODIFIERS">
          <div className="flex flex-wrap gap-1">
            {STYLE_MODIFIERS.map((m) => (
              <button
                key={m.id}
                onClick={() => toggleModifier(m.id)}
                className={`text-[10px] font-body px-2 py-0.5 border transition-colors ${
                  modifiers.includes(m.id)
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border text-muted-foreground hover:border-accent'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </Section>

        {/* Variations */}
        <Section title={`VARIATIONS: ${variationCount}`}>
          <Slider
            min={1}
            max={6}
            step={1}
            value={[variationCount]}
            onValueChange={([v]) => onVariationCountChange(v)}
          />
        </Section>

        {/* Generation Mode */}
        <Section title="MODE">
          <div className="flex gap-1">
            <button
              onClick={() => onGenerationModeChange('forge')}
              className={`flex-1 text-[11px] font-body py-1.5 border transition-colors ${
                generationMode === 'forge'
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:border-accent'
              }`}
            >
              ⚒️ FORGE
            </button>
            <button
              onClick={() => onGenerationModeChange('render')}
              className={`flex-1 text-[11px] font-body py-1.5 border transition-colors ${
                generationMode === 'render'
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:border-accent'
              }`}
            >
              🖼️ RENDER
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {generationMode === 'forge'
              ? 'Hex grid via AI. Best ≤48px. Exact palette.'
              : 'Image gen + quantize. Best ≥48px. Approximate palette.'}
          </p>
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
