import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ASSET_TYPES, BUILT_IN_PALETTES, STYLE_MODIFIERS, RESOLUTION_PRESETS,
  type AssetTypeId, type StyleModifierId,
} from '@/lib/forge-constants';
import { ANIMATION_PRESETS } from '@/lib/animation-presets';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

interface StyleRecipe {
  id: string;
  name: string;
  description: string;
  modifiers: string[];
  isBuiltin: boolean;
}

const BUILTIN_RECIPES: Omit<StyleRecipe, 'id'>[] = [
  { name: 'Stoneshard Bandit', description: 'Earthy detailed characters', modifiers: ['thin_outline', 'hue_shifted', 'textured', 'warm_lighting'], isBuiltin: true },
  { name: 'Darkest Icon', description: 'Dense painterly skill icons', modifiers: ['heavy_outline', 'high_detail', 'symmetry', 'blood_gore'], isBuiltin: true },
  { name: 'Dungeon Tile', description: 'Atmospheric stone floors', modifiers: ['no_outline', 'dithered', 'textured', 'cold_lighting'], isBuiltin: true },
  { name: 'Gothic UI', description: 'Clean gothic borders', modifiers: ['heavy_outline', 'flat', 'symmetry'], isBuiltin: true },
  { name: 'Eldritch Horror', description: 'Arcane creatures with glow', modifiers: ['thin_outline', 'smooth', 'hue_shifted', 'cold_lighting', 'arcane_glow'], isBuiltin: true },
  { name: 'Blood & Iron', description: 'Warfare equipment, gritty', modifiers: ['heavy_outline', 'high_detail', 'textured', 'warm_lighting', 'blood_gore'], isBuiltin: true },
];

export interface GeneratorSidebarProps {
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
  generationMode: 'forge' | 'render' | 'scene';
  onGenerationModeChange: (v: 'forge' | 'render' | 'scene') => void;
  animationPreset: string | null;
  onAnimationPresetChange: (v: string | null) => void;
  referenceImage: string | null;
  onReferenceUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearReference: () => void;
}

export function GeneratorSidebar({
  assetType, onAssetTypeChange,
  width, height, onWidthChange, onHeightChange,
  paletteIndex, onPaletteIndexChange,
  modifiers, onModifiersChange,
  variationCount, onVariationCountChange,
  generationMode, onGenerationModeChange,
  animationPreset, onAnimationPresetChange,
  referenceImage, onReferenceUpload, onClearReference,
}: GeneratorSidebarProps) {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<StyleRecipe[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [recipeName, setRecipeName] = useState('');
  const [recipeDesc, setRecipeDesc] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchRecipes = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('style_recipes')
      .select('*')
      .order('created_at', { ascending: false });
    setRecipes(
      (data || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        description: r.description || '',
        modifiers: r.modifiers || [],
        isBuiltin: r.is_builtin,
      }))
    );
  }, [user]);

  useEffect(() => { fetchRecipes(); }, [fetchRecipes]);

  const toggleModifier = (id: StyleModifierId) => {
    const mod = STYLE_MODIFIERS.find((m) => m.id === id)!;
    const sameGroup = STYLE_MODIFIERS.filter((m) => m.group === mod.group).map((m) => m.id);
    const filtered = modifiers.filter((m) => !sameGroup.includes(m));
    if (modifiers.includes(id)) {
      onModifiersChange(filtered);
    } else {
      onModifiersChange([...filtered, id]);
    }
  };

  const applyRecipe = (recipe: Omit<StyleRecipe, 'id'> | StyleRecipe) => {
    onModifiersChange(recipe.modifiers as StyleModifierId[]);
    toast.success(`RECIPE APPLIED: ${recipe.name}`);
  };

  const handleSaveRecipe = async () => {
    if (!recipeName.trim()) { toast.error('NAME YOUR RECIPE.'); return; }
    if (modifiers.length === 0) { toast.error('SELECT MODIFIERS FIRST.'); return; }
    const { error } = await supabase.from('style_recipes').insert({
      user_id: user!.id,
      name: recipeName.trim(),
      description: recipeDesc.trim(),
      modifiers: [...modifiers],
      is_builtin: false,
    });
    if (error) { toast.error('SAVE FAILED.'); return; }
    toast.success('RECIPE SAVED.');
    setSaveDialogOpen(false);
    setRecipeName('');
    setRecipeDesc('');
    fetchRecipes();
  };

  const handleDeleteRecipe = async (id: string) => {
    await supabase.from('style_recipes').delete().eq('id', id);
    toast.success('RECIPE DESTROYED.');
    fetchRecipes();
  };

  const applicableAnimations = ANIMATION_PRESETS.filter(p => p.assetTypes.includes(assetType));

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
              <Input type="number" min={8} max={128} value={width} onChange={(e) => onWidthChange(Number(e.target.value))} className="h-6 text-xs bg-muted border-border px-1" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground">H</label>
              <Input type="number" min={8} max={128} value={height} onChange={(e) => onHeightChange(Number(e.target.value))} className="h-6 text-xs bg-muted border-border px-1" />
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
                  paletteIndex === i ? 'border-primary bg-primary/10' : 'border-border hover:border-accent'
                }`}
              >
                <p className="text-[11px] text-foreground font-body mb-1">{p.name}</p>
                <div className="flex gap-0">
                  {p.colors.slice(0, 16).map((c, ci) => (
                    <div key={ci} className="h-3 flex-1" style={{ backgroundColor: c }} />
                  ))}
                </div>
              </button>
            ))}
          </div>
        </Section>

        {/* Reference Image */}
        <Section title="REFERENCE IMAGE">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onReferenceUpload}
          />
          {referenceImage ? (
            <div className="space-y-1">
              <div className="border border-accent p-1">
                <img src={referenceImage} alt="Reference" className="w-full h-auto pixel-render max-h-[80px] object-contain" />
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="flex-1 text-[10px] h-6">
                  REPLACE
                </Button>
                <Button size="sm" variant="outline" onClick={onClearReference} className="text-[10px] h-6 px-2">
                  ✕
                </Button>
              </div>
              <p className="text-[9px] text-muted-foreground">AI will use this as style reference for consistency.</p>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full text-[10px] h-7">
              📌 UPLOAD REFERENCE
            </Button>
          )}
        </Section>

        {/* Style Recipes */}
        <Section title="STYLE RECIPES">
          <div className="space-y-1">
            {BUILTIN_RECIPES.map((r) => (
              <button
                key={r.name}
                onClick={() => applyRecipe(r)}
                className="w-full text-left border border-border hover:border-accent p-1.5 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-foreground font-body">{r.name}</span>
                  <span className="text-[9px] text-accent border border-accent/30 px-1 opacity-0 group-hover:opacity-100 transition-opacity">APPLY</span>
                </div>
                <p className="text-[9px] text-muted-foreground">{r.description}</p>
              </button>
            ))}

            {recipes.map((r) => (
              <div key={r.id} className="flex items-center gap-1">
                <button
                  onClick={() => applyRecipe(r)}
                  className="flex-1 text-left border border-border hover:border-accent p-1.5 transition-colors"
                >
                  <span className="text-[11px] text-foreground font-body">{r.name}</span>
                  {r.description && <p className="text-[9px] text-muted-foreground">{r.description}</p>}
                </button>
                <button
                  onClick={() => handleDeleteRecipe(r.id)}
                  className="text-[10px] text-muted-foreground hover:text-primary px-1 py-1"
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            ))}

            <Button
              size="sm"
              variant="outline"
              onClick={() => { setRecipeName(''); setRecipeDesc(''); setSaveDialogOpen(true); }}
              className="w-full text-[10px] h-6 mt-1"
              disabled={modifiers.length === 0}
            >
              💾 SAVE CURRENT AS RECIPE
            </Button>
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
          <Slider min={1} max={6} step={1} value={[variationCount]} onValueChange={([v]) => onVariationCountChange(v)} />
        </Section>

        {/* Generation Mode */}
        <Section title="MODE">
          <div className="flex gap-1">
            <button
              onClick={() => onGenerationModeChange('forge')}
              className={`flex-1 text-[11px] font-body py-1.5 border transition-colors ${
                generationMode === 'forge' ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:border-accent'
              }`}
            >
              ⚒️ FORGE
            </button>
            <button
              onClick={() => onGenerationModeChange('render')}
              className={`flex-1 text-[11px] font-body py-1.5 border transition-colors ${
                generationMode === 'render' ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:border-accent'
              }`}
            >
              🖼️ RENDER
            </button>
            <button
              onClick={() => onGenerationModeChange('scene')}
              className={`flex-1 text-[11px] font-body py-1.5 border transition-colors ${
                generationMode === 'scene' ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:border-accent'
              }`}
            >
              🎬 SCENE
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {generationMode === 'forge'
              ? 'Hex grid via AI. Best ≤48px. Exact palette.'
              : generationMode === 'render'
              ? 'Image gen + downscale. Best ≥48px.'
              : 'Generates portrait + props + background as 3 separate assets.'}
          </p>
        </Section>

        {/* Animation */}
        {applicableAnimations.length > 0 && (
          <Section title="ANIMATION">
            <div className="space-y-1">
              <button
                onClick={() => onAnimationPresetChange(null)}
                className={`w-full text-left text-[11px] font-body px-2 py-1.5 border transition-colors ${
                  !animationPreset ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:border-accent'
                }`}
              >
                🚫 No Animation (single frame)
              </button>
              {applicableAnimations.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onAnimationPresetChange(p.id)}
                  className={`w-full text-left px-2 py-1.5 border transition-colors ${
                    animationPreset === p.id ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:border-accent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-body">{p.icon} {p.label}</span>
                    <span className="text-[9px] text-accent">{p.frameCount}F</span>
                  </div>
                  <p className="text-[9px] text-muted-foreground">{p.description}</p>
                </button>
              ))}
            </div>
          </Section>
        )}
      </div>

      {/* Save Recipe Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-sm tracking-widest">SAVE STYLE RECIPE</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] text-accent font-display tracking-widest">NAME</label>
              <Input value={recipeName} onChange={(e) => setRecipeName(e.target.value)} placeholder="My Recipe" className="bg-muted border-border text-sm h-8" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-accent font-display tracking-widest">DESCRIPTION</label>
              <Input value={recipeDesc} onChange={(e) => setRecipeDesc(e.target.value)} placeholder="Short description..." className="bg-muted border-border text-sm h-8" />
            </div>
            <div>
              <label className="text-[10px] text-accent font-display tracking-widest">MODIFIERS</label>
              <div className="flex flex-wrap gap-1 mt-1">
                {modifiers.map((m) => {
                  const mod = STYLE_MODIFIERS.find((s) => s.id === m);
                  return (
                    <span key={m} className="text-[10px] font-body px-2 py-0.5 border border-primary bg-primary/10 text-foreground">
                      {mod?.label || m}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSaveRecipe} className="flex-1 font-display text-xs tracking-widest">SAVE RECIPE</Button>
              <Button variant="outline" onClick={() => setSaveDialogOpen(false)} className="text-xs">CANCEL</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
