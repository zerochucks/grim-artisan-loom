import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { GeneratorSidebar } from '@/components/generator/GeneratorSidebar';
import { GeneratorCanvas } from '@/components/generator/GeneratorCanvas';
import { GeneratorRightPanel } from '@/components/generator/GeneratorRightPanel';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { renderGrid, postProcessRender, generateAssetName } from '@/lib/canvas-utils';
import {
  ASSET_TYPES, BUILT_IN_PALETTES, EXAMPLE_PROMPTS,
  type AssetTypeId, type StyleModifierId, type GeneratedAsset,
} from '@/lib/forge-constants';
import { useNavigate } from 'react-router-dom';

const GeneratorPage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Generator state
  const [prompt, setPrompt] = useState('');
  const [assetType, setAssetType] = useState<AssetTypeId>('character');
  const [width, setWidth] = useState(48);
  const [height, setHeight] = useState(64);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [modifiers, setModifiers] = useState<StyleModifierId[]>(['hue_shifted', 'textured']);
  const [variationCount, setVariationCount] = useState(1);
  const [generationMode, setGenerationMode] = useState<'forge' | 'render'>('forge');

  // Results
  const [generating, setGenerating] = useState(false);
  const [currentAssets, setCurrentAssets] = useState<GeneratedAsset[]>([]);
  const [sessionHistory, setSessionHistory] = useState<GeneratedAsset[]>([]);

  const selectedPalette = BUILT_IN_PALETTES[paletteIndex];
  const currentAssetType = ASSET_TYPES.find((t) => t.id === assetType)!;
  const placeholderPrompt = EXAMPLE_PROMPTS[assetType];

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error('DESCRIBE YOUR ASSET, SMITH.');
      return;
    }

    setGenerating(true);
    toast.info('EXTRACTING PIXELS...');

    try {
      const newAssets: GeneratedAsset[] = [];

      for (let v = 0; v < variationCount; v++) {
        if (generationMode === 'forge') {
          const { data, error } = await supabase.functions.invoke('generate-pixel-art', {
            body: {
              prompt: prompt.trim(),
              assetType: currentAssetType.id,
              width,
              height,
              paletteColors: selectedPalette.colors,
              styleModifiers: modifiers,
              variationIndex: v,
            },
          });

          if (error) throw new Error(error.message || 'Generation failed');
          if (data?.error) throw new Error(data.error);

          const gridRows: string[] = data.grid;
          const imageDataUrl = renderGrid(gridRows, selectedPalette.colors, width, height);

          newAssets.push({
            name: generateAssetName(prompt, currentAssetType.prefix, width, height, sessionHistory.length + v + 1),
            prompt: prompt.trim(),
            assetType,
            width,
            height,
            paletteColors: selectedPalette.colors,
            paletteName: selectedPalette.name,
            gridData: gridRows,
            imageDataUrl,
            styleModifiers: [...modifiers],
            generationMode: 'forge',
            createdAt: new Date().toISOString(),
          });
        } else {
          // Render mode
          const { data, error } = await supabase.functions.invoke('generate-image-asset', {
            body: {
              prompt: prompt.trim(),
              assetType: currentAssetType.id,
              width,
              height,
              paletteDescription: `${selectedPalette.name} palette: ${selectedPalette.colors.join(', ')}`,
              styleModifiers: modifiers,
            },
          });

          if (error) throw new Error(error.message || 'Generation failed');
          if (data?.error) throw new Error(data.error);

          const imageDataUrl = await postProcessRender(
            data.image,
            width,
            height,
            selectedPalette.colors
          );

          newAssets.push({
            name: generateAssetName(prompt, currentAssetType.prefix, width, height, sessionHistory.length + v + 1),
            prompt: prompt.trim(),
            assetType,
            width,
            height,
            paletteColors: selectedPalette.colors,
            paletteName: selectedPalette.name,
            imageDataUrl,
            styleModifiers: [...modifiers],
            generationMode: 'render',
            createdAt: new Date().toISOString(),
          });
        }
      }

      setCurrentAssets(newAssets);
      setSessionHistory((prev) => [...newAssets, ...prev]);
      toast.success('ARTIFACT FORGED SUCCESSFULLY.');
    } catch (err: any) {
      console.error('Generation error:', err);
      if (err.message?.includes('429') || err.message?.includes('rate limit')) {
        toast.error('FORGE OVERHEATED. WAIT AND TRY AGAIN.');
      } else if (err.message?.includes('402') || err.message?.includes('payment')) {
        toast.error('FORGE FUEL DEPLETED. ADD CREDITS.');
      } else {
        toast.error(`FORGING FAILED: ${err.message}`);
      }
    } finally {
      setGenerating(false);
    }
  }, [prompt, assetType, width, height, paletteIndex, modifiers, variationCount, generationMode, selectedPalette, currentAssetType, sessionHistory.length]);

  const handleSaveAsset = useCallback(async (asset: GeneratedAsset) => {
    try {
      const { error } = await supabase.from('assets').insert({
        user_id: user!.id,
        name: asset.name,
        prompt: asset.prompt,
        asset_type: asset.assetType,
        width: asset.width,
        height: asset.height,
        grid_data: asset.gridData ? { grid: asset.gridData } : null,
        image_url: asset.imageDataUrl,
        style_modifiers: asset.styleModifiers,
        generation_mode: asset.generationMode,
      });

      if (error) throw error;
      toast.success('ARTIFACT SAVED TO VAULT.');
    } catch (err: any) {
      toast.error(`SAVE FAILED: ${err.message}`);
    }
  }, [user]);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Left Sidebar */}
      <GeneratorSidebar
        assetType={assetType}
        onAssetTypeChange={setAssetType}
        width={width}
        height={height}
        onWidthChange={setWidth}
        onHeightChange={setHeight}
        paletteIndex={paletteIndex}
        onPaletteIndexChange={setPaletteIndex}
        modifiers={modifiers}
        onModifiersChange={setModifiers}
        variationCount={variationCount}
        onVariationCountChange={setVariationCount}
        generationMode={generationMode}
        onGenerationModeChange={setGenerationMode}
      />

      {/* Center */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <h1 className="font-display text-sm text-primary tracking-widest">PIXEL FORGE</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/library')}
              className="text-xs text-muted-foreground hover:text-accent transition-colors font-body"
            >
              VAULT
            </button>
            <button
              onClick={signOut}
              className="text-xs text-muted-foreground hover:text-primary transition-colors font-body"
            >
              EXIT
            </button>
          </div>
        </div>

        {/* Prompt Area */}
        <div className="border-b border-border p-4 space-y-3">
          <div className="flex gap-3">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={placeholderPrompt}
              className="flex-1 bg-muted border-border text-foreground font-body text-sm min-h-[60px] max-h-[100px] resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleGenerate();
                }
              }}
            />
            <Button
              onClick={handleGenerate}
              disabled={generating}
              className={`font-display text-xs tracking-widest px-6 self-end ${generating ? 'forge-pulse' : ''}`}
            >
              {generating ? 'FORGING...' : 'FORGE'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {currentAssetType.icon} {currentAssetType.label} · {width}×{height} · {selectedPalette.name} · {generationMode === 'forge' ? 'HEX GRID' : 'IMAGE GEN'} · ⌘+Enter to forge
          </p>
        </div>

        {/* Canvas / Preview */}
        <GeneratorCanvas
          currentAssets={currentAssets}
          sessionHistory={sessionHistory}
          generating={generating}
          onSave={handleSaveAsset}
        />
      </div>

      {/* Right Panel */}
      <GeneratorRightPanel
        currentAssets={currentAssets}
        sessionHistory={sessionHistory}
      />
    </div>
  );
};

export default GeneratorPage;
