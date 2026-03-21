import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { GeneratorSidebar } from '@/components/generator/GeneratorSidebar';
import { GeneratorCanvas } from '@/components/generator/GeneratorCanvas';
import { GeneratorRightPanel } from '@/components/generator/GeneratorRightPanel';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { renderGrid, generateAssetName } from '@/lib/canvas-utils';
import { processAdHoc } from '@/lib/pipeline';
import { inferTier } from '@/lib/sprite-specs';
import {
  ASSET_TYPES, BUILT_IN_PALETTES, EXAMPLE_PROMPTS,
  SCENE_PIECES, SCENE_EXAMPLE_PROMPT,
  type AssetTypeId, type StyleModifierId, type GeneratedAsset,
} from '@/lib/forge-constants';
import { ANIMATION_PRESETS, buildAnimationFramePrompt, buildAnimationSheet, type AnimationPreset } from '@/lib/animation-presets';
import { useNavigate } from 'react-router-dom';

const GeneratorPage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [prompt, setPrompt] = useState('');
  const [assetType, setAssetType] = useState<AssetTypeId>('character');
  const [width, setWidth] = useState(48);
  const [height, setHeight] = useState(64);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [modifiers, setModifiers] = useState<StyleModifierId[]>(['hue_shifted', 'textured']);
  const [variationCount, setVariationCount] = useState(1);
  const [generationMode, setGenerationMode] = useState<'forge' | 'render' | 'scene'>('forge');

  const [generating, setGenerating] = useState(false);
  const [currentAssets, setCurrentAssets] = useState<GeneratedAsset[]>([]);
  const [sessionHistory, setSessionHistory] = useState<GeneratedAsset[]>([]);
  const [compareAssets, setCompareAssets] = useState<GeneratedAsset[] | null>(null);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [animationPreset, setAnimationPreset] = useState<string | null>(null);

  const selectedPalette = BUILT_IN_PALETTES[paletteIndex];
  const currentAssetType = ASSET_TYPES.find((t) => t.id === assetType)!;
  const placeholderPrompt = generationMode === 'scene' ? SCENE_EXAMPLE_PROMPT : EXAMPLE_PROMPTS[assetType];

  const generateRenderAsset = useCallback(async (
    assetPrompt: string,
    assetTypeId: AssetTypeId,
    w: number,
    h: number,
    refImage?: string | null,
  ) => {
    const tier = inferTier(assetTypeId, w, h);
    const body: Record<string, unknown> = {
      prompt: assetPrompt,
      assetType: assetTypeId,
      width: w,
      height: h,
      tier,
      paletteDescription: `${selectedPalette.name} palette: ${selectedPalette.colors.join(', ')}`,
      styleModifiers: modifiers,
      skipQuantize: tier === 'background',
    };
    if (refImage) {
      body.referenceImage = refImage;
    }

    const { data, error } = await supabase.functions.invoke('generate-image-asset', { body });

    if (error) throw new Error(error.message || 'Generation failed');
    if (data?.error) throw new Error(data.error);

    const skipQuantize = data.skipQuantize ?? (tier === 'background');
    return processAdHoc(data.image, assetTypeId, w, h, selectedPalette.colors, skipQuantize);
  }, [selectedPalette, modifiers]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error('DESCRIBE YOUR ASSET, SMITH.');
      return;
    }

    setGenerating(true);

    try {
      const newAssets: GeneratedAsset[] = [];

      // Check if animation mode is active
      const activeAnimPreset = animationPreset
        ? ANIMATION_PRESETS.find(p => p.id === animationPreset)
        : null;

      if (activeAnimPreset) {
        toast.info(`GENERATING ${activeAnimPreset.frameCount}-FRAME ${activeAnimPreset.label.toUpperCase()}...`);

        const framePromises = Array.from({ length: activeAnimPreset.frameCount }, (_, frameIdx) => {
          const framePrompt = buildAnimationFramePrompt(prompt.trim(), activeAnimPreset, frameIdx);
          return generateRenderAsset(framePrompt, currentAssetType.id, width, height, referenceImage);
        });

        const results = await Promise.allSettled(framePromises);
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          if (result.status === 'fulfilled') {
            newAssets.push({
              name: generateAssetName(`${prompt}_frame${i + 1}`, currentAssetType.prefix, width, height, sessionHistory.length + i + 1),
              prompt: buildAnimationFramePrompt(prompt.trim(), activeAnimPreset, i),
              assetType,
              width,
              height,
              paletteColors: selectedPalette.colors,
              paletteName: selectedPalette.name,
              imageDataUrl: result.value,
              styleModifiers: [...modifiers],
              generationMode: 'render',
              scenePiece: `Frame ${i + 1}`,
              createdAt: new Date().toISOString(),
            });
          } else {
            toast.error(`FRAME ${i + 1} FAILED: ${result.reason?.message || 'Unknown'}`);
          }
        }

        // Also generate the combined spritesheet
        if (newAssets.length > 1) {
          const sheetDataUrl = await buildAnimationSheet(newAssets);
          if (sheetDataUrl) {
            newAssets.push({
              name: generateAssetName(`${prompt}_${activeAnimPreset.id}_sheet`, currentAssetType.prefix, width * newAssets.length, height, sessionHistory.length + newAssets.length + 1),
              prompt: `${activeAnimPreset.label} spritesheet: ${prompt.trim()}`,
              assetType,
              width: width * (newAssets.length - 1), // exclude sheet itself from count
              height,
              paletteColors: selectedPalette.colors,
              paletteName: selectedPalette.name,
              imageDataUrl: sheetDataUrl,
              styleModifiers: [...modifiers],
              generationMode: 'render',
              scenePiece: 'Spritesheet',
              createdAt: new Date().toISOString(),
            });
          }
        }
      } else if (generationMode === 'scene') {
        toast.info('ASSEMBLING SCENE — 3 PIECES FORGING IN PARALLEL...');

        const piecePromises = SCENE_PIECES.map(async (piece) => {
          const piecePrompt = `${prompt.trim()}, ${piece.promptSuffix}`;
          const typeInfo = ASSET_TYPES.find((t) => t.id === piece.assetType)!;
          const imageDataUrl = await generateRenderAsset(piecePrompt, piece.assetType, width, height, referenceImage);

          return {
            name: generateAssetName(`${piece.label} ${prompt}`, typeInfo.prefix, width, height, sessionHistory.length + 1),
            prompt: piecePrompt,
            assetType: piece.assetType,
            width,
            height,
            paletteColors: selectedPalette.colors,
            paletteName: selectedPalette.name,
            imageDataUrl,
            styleModifiers: [...modifiers],
            generationMode: 'scene' as const,
            scenePiece: piece.label,
            createdAt: new Date().toISOString(),
          };
        });

        const results = await Promise.allSettled(piecePromises);
        for (const result of results) {
          if (result.status === 'fulfilled') {
            newAssets.push(result.value);
          } else {
            console.error('Scene piece failed:', result.reason);
            toast.error(`PIECE FAILED: ${result.reason?.message || 'Unknown'}`);
          }
        }

        if (newAssets.length === 0) throw new Error('All scene pieces failed');
      } else {
        toast.info('EXTRACTING PIXELS...');
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
            const imageDataUrl = await generateRenderAsset(prompt.trim(), currentAssetType.id, width, height, referenceImage);

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
      }

      // Store previous for A/B compare
      if (currentAssets.length > 0) {
        setCompareAssets(currentAssets);
      }

      setCurrentAssets(newAssets);
      setSessionHistory((prev) => [...newAssets, ...prev]);

      const msg = activeAnimPreset
        ? `${activeAnimPreset.label.toUpperCase()} — ${newAssets.length} FRAMES FORGED.`
        : generationMode === 'scene'
          ? `SCENE ASSEMBLED — ${newAssets.length}/3 PIECES FORGED.`
          : 'ARTIFACT FORGED SUCCESSFULLY.';
      toast.success(msg);
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
  }, [prompt, assetType, width, height, paletteIndex, modifiers, variationCount, generationMode, animationPreset, selectedPalette, currentAssetType, sessionHistory.length, generateRenderAsset, referenceImage]);

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

  const handleReroll = useCallback((asset: GeneratedAsset) => {
    setPrompt(asset.prompt);
    // Re-forge with the same prompt triggers on next FORGE click
    toast.info('PROMPT LOADED — HIT FORGE TO RE-ROLL.');
  }, []);

  const handleVariation = useCallback((asset: GeneratedAsset) => {
    setPrompt(`${asset.prompt}, slight variation`);
    setReferenceImage(asset.imageDataUrl);
    toast.info('VARIATION QUEUED — HIT FORGE. Reference image set.');
  }, []);

  const handleReferenceUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setReferenceImage(reader.result as string);
      toast.success('REFERENCE IMAGE LOADED.');
    };
    reader.readAsDataURL(file);
  }, []);

  const activeAnimPreset = animationPreset ? ANIMATION_PRESETS.find(p => p.id === animationPreset) : null;

  const statusLine = activeAnimPreset
    ? `🎞️ Animation: ${activeAnimPreset.label} · ${activeAnimPreset.frameCount} frames · ${width}×${height} · ${selectedPalette.name} · ⌘+Enter to forge`
    : generationMode === 'scene'
      ? `🎬 Scene Mode · ${width}×${height} · ${selectedPalette.name} · Portrait + Props + Background · ⌘+Enter to forge`
      : `${currentAssetType.icon} ${currentAssetType.label} · ${width}×${height} · ${selectedPalette.name} · ${generationMode === 'forge' ? 'HEX GRID' : 'IMAGE GEN'} · ⌘+Enter to forge`;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
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
        animationPreset={animationPreset}
        onAnimationPresetChange={setAnimationPreset}
        referenceImage={referenceImage}
        onReferenceUpload={handleReferenceUpload}
        onClearReference={() => setReferenceImage(null)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <h1 className="font-display text-sm text-primary tracking-widest">PIXEL FORGE</h1>
          <div className="flex items-center gap-3">
            {compareAssets && (
              <button onClick={() => setCompareAssets(null)} className="text-xs text-accent hover:text-primary transition-colors font-body">
                CLEAR A/B
              </button>
            )}
            <button onClick={() => navigate('/batch')} className="text-xs text-muted-foreground hover:text-accent transition-colors font-body">BATCH</button>
            <button onClick={() => navigate('/library')} className="text-xs text-muted-foreground hover:text-accent transition-colors font-body">VAULT</button>
            <button onClick={() => navigate('/palettes')} className="text-xs text-muted-foreground hover:text-accent transition-colors font-body">PALETTES</button>
            <button onClick={signOut} className="text-xs text-muted-foreground hover:text-primary transition-colors font-body">EXIT</button>
          </div>
        </div>

        <div className="border-b border-border p-4 space-y-3">
          <div className="flex gap-3">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={placeholderPrompt}
              className="flex-1 bg-muted border-border text-foreground font-body text-sm min-h-[60px] max-h-[100px] resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate();
              }}
            />
            <Button
              onClick={handleGenerate}
              disabled={generating}
              className={`font-display text-xs tracking-widest px-6 self-end ${generating ? 'forge-pulse' : ''}`}
            >
              {generating
                ? (activeAnimPreset ? 'ANIMATING...' : generationMode === 'scene' ? 'ASSEMBLING...' : 'FORGING...')
                : 'FORGE'}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground flex-1">
              {statusLine}
              {generationMode === 'forge' && (width > 64 || height > 64) && (
                <span className="text-primary ml-2">⚠ Forge caps at 64×64 — switch to IMAGE GEN or SCENE for larger</span>
              )}
            </p>
            {referenceImage && (
              <span className="text-[10px] text-accent font-display tracking-widest">📌 REF IMAGE SET</span>
            )}
          </div>
        </div>

        <GeneratorCanvas
          currentAssets={currentAssets}
          sessionHistory={sessionHistory}
          generating={generating}
          compareAssets={compareAssets}
          onSave={handleSaveAsset}
          onLoadFromHistory={(assets) => setCurrentAssets(assets)}
          onReroll={handleReroll}
          onVariation={handleVariation}
        />
      </div>

      <GeneratorRightPanel
        currentAssets={currentAssets}
        sessionHistory={sessionHistory}
      />
    </div>
  );
};

export default GeneratorPage;
