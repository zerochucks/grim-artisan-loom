import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ASSET_TYPES, type GeneratedAsset, type AssetTypeId } from '@/lib/forge-constants';
import { downloadPNG, exportZip, createSpritesheetAsync, generateMetadataJSON } from '@/lib/export-utils';
import { useNavigate } from 'react-router-dom';

const LibraryPage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [assets, setAssets] = useState<GeneratedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<GeneratedAsset | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchAssets = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase
      .from('assets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (filterType !== 'all') {
      query = query.eq('asset_type', filterType);
    }
    if (searchQuery.trim()) {
      query = query.ilike('prompt', `%${searchQuery.trim()}%`);
    }

    const { data, error } = await query;
    if (error) {
      toast.error('VAULT ACCESS DENIED.');
      console.error(error);
    } else {
      setAssets(
        (data || []).map((row: any) => ({
          id: row.id,
          name: row.name,
          prompt: row.prompt,
          assetType: row.asset_type,
          width: row.width,
          height: row.height,
          paletteColors: [],
          paletteName: '',
          gridData: row.grid_data?.grid,
          imageDataUrl: row.image_url || '',
          styleModifiers: row.style_modifiers || [],
          generationMode: row.generation_mode || 'forge',
          createdAt: row.created_at,
        }))
      );
    }
    setLoading(false);
  }, [user, filterType, searchQuery]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === assets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(assets.map((a) => a.id!)));
    }
  };

  const handleDownloadAll = async () => {
    const target = selectedIds.size > 0 ? selectedAssets : assets;
    if (target.length === 0) {
      toast.error('NO ASSETS TO DOWNLOAD.');
      return;
    }
    toast.info(`PACKAGING ${target.length} ASSETS...`);
    await exportZip(target);
    toast.success('ZIP DISPATCHED.');
  };

  const selectedAssets = assets.filter((a) => a.id && selectedIds.has(a.id));

  const handleBulkExportZip = async () => {
    if (selectedAssets.length === 0) {
      toast.error('SELECT ASSETS FIRST.');
      return;
    }
    await exportZip(selectedAssets);
    toast.success('ZIP DISPATCHED.');
  };

  const handleBulkSpritesheet = async () => {
    if (selectedAssets.length === 0) {
      toast.error('SELECT ASSETS FIRST.');
      return;
    }
    const dataUrl = await createSpritesheetAsync(selectedAssets, 4, 1);
    if (dataUrl) {
      downloadPNG(dataUrl, 'spritesheet.png');
      toast.success('SPRITESHEET FORGED.');
    }
  };

  const handleExportMetadata = () => {
    const target = selectedAssets.length > 0 ? selectedAssets : assets;
    const json = generateMetadataJSON(target);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'pixel-forge-metadata.json';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('METADATA EXPORTED.');
  };

  const handleDeleteAsset = async (id: string) => {
    const { error } = await supabase.from('assets').delete().eq('id', id);
    if (error) {
      toast.error('DELETION FAILED.');
    } else {
      setAssets((prev) => prev.filter((a) => a.id !== id));
      setSelectedAsset(null);
      toast.success('ARTIFACT DESTROYED.');
    }
  };

  return (
    <div className="flex h-screen bg-background flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-4">
          <h1 className="font-display text-sm text-primary tracking-widest">ASSET VAULT</h1>
          <span className="text-xs text-muted-foreground">{assets.length} artifacts</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/generator')}
            className="text-xs text-muted-foreground hover:text-accent transition-colors font-body"
          >
            FORGE
          </button>
          <button
            onClick={signOut}
            className="text-xs text-muted-foreground hover:text-primary transition-colors font-body"
          >
            EXIT
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2 flex-wrap">
        <Input
          placeholder="Search prompts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-48 bg-muted border-border text-sm h-8"
        />
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40 bg-muted border-border h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {ASSET_TYPES.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.icon} {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        {selectedIds.size > 0 && (
          <span className="text-xs text-accent">{selectedIds.size} selected</span>
        )}
        <Button size="sm" variant="outline" onClick={handleSelectAll} className="text-xs h-8">
          {selectedIds.size === assets.length && assets.length > 0 ? 'DESELECT ALL' : 'SELECT ALL'}
        </Button>
        <Button size="sm" variant="default" onClick={handleDownloadAll} className="text-xs h-8">
          {selectedIds.size > 0 ? `DOWNLOAD ${selectedIds.size}` : 'DOWNLOAD ALL'}
        </Button>
        <Button size="sm" variant="outline" onClick={handleBulkExportZip} className="text-xs h-8">
          ZIP
        </Button>
        <Button size="sm" variant="outline" onClick={handleBulkSpritesheet} className="text-xs h-8">
          SPRITESHEET
        </Button>
        <Button size="sm" variant="outline" onClick={handleExportMetadata} className="text-xs h-8">
          METADATA
        </Button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="font-display text-sm text-muted-foreground animate-pulse">ACCESSING VAULT...</p>
          </div>
        ) : assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <p className="font-display text-sm text-muted-foreground">VAULT EMPTY</p>
            <Button variant="outline" onClick={() => navigate('/generator')} className="text-xs">
              FORGE FIRST ARTIFACT
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className={`group relative border bg-card cursor-pointer transition-colors hover:border-accent ${
                  asset.id && selectedIds.has(asset.id) ? 'border-primary' : 'border-border'
                }`}
                onClick={() => setSelectedAsset(asset)}
              >
                {/* Selection checkbox */}
                <button
                  className="absolute top-1 left-1 z-10 w-4 h-4 border border-border bg-background flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (asset.id) toggleSelect(asset.id);
                  }}
                >
                  {asset.id && selectedIds.has(asset.id) ? '✓' : ''}
                </button>

                <div className="checkerboard aspect-square flex items-center justify-center p-2">
                  <img
                    src={asset.imageDataUrl}
                    alt={asset.name}
                    className="pixel-render max-w-full max-h-full object-contain"
                  />
                </div>
                <div className="px-2 py-1 border-t border-border">
                  <p className="text-[10px] text-muted-foreground truncate font-body">{asset.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {asset.width}×{asset.height}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedAsset} onOpenChange={() => setSelectedAsset(null)}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-sm tracking-widest">{selectedAsset?.name}</DialogTitle>
          </DialogHeader>
          {selectedAsset && (
            <div className="space-y-4">
              <div className="checkerboard flex items-center justify-center p-4 border border-border">
                <img
                  src={selectedAsset.imageDataUrl}
                  alt={selectedAsset.name}
                  className="pixel-render"
                  style={{
                    width: Math.min(selectedAsset.width * 4, 384),
                    height: Math.min(selectedAsset.height * 4, 384),
                  }}
                />
              </div>
              <div className="space-y-2 text-xs text-muted-foreground font-body">
                <p><span className="text-accent">PROMPT:</span> {selectedAsset.prompt}</p>
                <p><span className="text-accent">TYPE:</span> {selectedAsset.assetType}</p>
                <p><span className="text-accent">SIZE:</span> {selectedAsset.width}×{selectedAsset.height}</p>
                <p><span className="text-accent">MODE:</span> {selectedAsset.generationMode}</p>
                <p><span className="text-accent">MODIFIERS:</span> {selectedAsset.styleModifiers.join(', ') || 'none'}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => downloadPNG(selectedAsset.imageDataUrl, selectedAsset.name)} className="text-xs">
                  DOWNLOAD PNG
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigate('/generator');
                    // TODO: pre-fill prompt from asset
                  }}
                  className="text-xs"
                >
                  CREATE VARIATION
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => selectedAsset.id && handleDeleteAsset(selectedAsset.id)}
                  className="text-xs ml-auto"
                >
                  DESTROY
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LibraryPage;
