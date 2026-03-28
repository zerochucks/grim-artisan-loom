import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { exportClassSystemJSON } from '@/lib/class-system';
import JSZip from 'jszip';

interface SpriteAssetRow {
  id: string;
  asset_key: string;
  tier: string;
  unity_path: string;
  target_w: number;
  target_h: number;
  frame_count: number;
  ppu: number;
  filter_mode: string;
  storage_url: string | null;
  approved: boolean;
  qa_status: string;
  prompt_template: string | null;
  primary_color: string | null;
}

type QaStatus = 'pending' | 'queued' | 'generating' | 'generated' | 'qa_pass' | 'approved' | 'rejected';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  queued: 'bg-secondary text-secondary-foreground',
  generating: 'bg-accent text-accent-foreground animate-pulse',
  retrying: 'bg-amber-900/40 text-amber-400 animate-pulse',
  generated: 'bg-primary/20 text-primary',
  qa_pass: 'bg-emerald-900/40 text-emerald-400',
  approved: 'bg-emerald-900/60 text-emerald-300',
  rejected: 'bg-destructive/20 text-destructive',
};

const TIER_ICONS: Record<string, string> = {
  unit: '⚔️',
  portrait: '🖼️',
  background: '🏔️',
  icon: '💎',
  tile: '🧱',
  node: '🔮',
};

const BatchQueuePage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [assets, setAssets] = useState<SpriteAssetRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState<Set<string>>(new Set());
  const [retrying, setRetrying] = useState<Map<string, number>>(new Map());
  const [batchRunning, setBatchRunning] = useState(false);
  const batchAbort = useRef(false);
  const [filterTier, setFilterTier] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [previewAsset, setPreviewAsset] = useState<SpriteAssetRow | null>(null);
  const [editingAsset, setEditingAsset] = useState<SpriteAssetRow | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const PAGE_SIZE = 100;
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await supabase
      .from('sprite_assets')
      .select('id,asset_key,tier,unity_path,target_w,target_h,frame_count,ppu,filter_mode,primary_color,prompt_template,storage_url,qa_status,approved,user_id,created_at', { count: 'exact' })
      .order('tier')
      .order('asset_key')
      .range(from, to);

    if (error) {
      toast.error(`Failed to load assets: ${error.message}`);
      setLoading(false);
      return;
    }
    setAssets((data as unknown as SpriteAssetRow[]) || []);
    if (count !== null) setTotalCount(count);
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const toggleSelect = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const selectAllFiltered = () => {
    const filtered = getFilteredAssets();
    const allSelected = filtered.every(a => selected.has(a.asset_key));
    if (allSelected) {
      setSelected(prev => {
        const next = new Set(prev);
        filtered.forEach(a => next.delete(a.asset_key));
        return next;
      });
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        filtered.forEach(a => next.add(a.asset_key));
        return next;
      });
    }
  };

  const getFilteredAssets = () => {
    return assets.filter(a => {
      if (filterTier !== 'all' && a.tier !== filterTier) return false;
      if (filterStatus !== 'all' && a.qa_status !== filterStatus) return false;
      return true;
    });
  };

  const generateSingle = async (assetKey: string) => {
    setGenerating(prev => new Set(prev).add(assetKey));

    // Optimistically set status
    setAssets(prev => prev.map(a =>
      a.asset_key === assetKey ? { ...a, qa_status: 'generating' } : a
    ));

    try {
      const { data, error } = await supabase.functions.invoke('batch-generate', {
        body: { asset_key: assetKey },
      });

      if (error) throw new Error(error.message);
      if (data?.error) {
        if (data.retryable) {
          toast.warning(`${assetKey}: ${data.error}`);
          setAssets(prev => prev.map(a =>
            a.asset_key === assetKey ? { ...a, qa_status: 'pending' } : a
          ));
        } else {
          throw new Error(data.error);
        }
        return false;
      }

      const retries = data?.retries ?? 0;
      setAssets(prev => prev.map(a =>
        a.asset_key === assetKey ? { ...a, qa_status: 'generated', storage_url: data.image } : a
      ));

      toast.success(`${assetKey} generated${retries > 0 ? ` (${retries} retry${retries > 1 ? 'ies' : ''})` : ''}`);
      return true;
    } catch (err: any) {
      toast.error(`${assetKey} failed: ${err.message}`);
      setAssets(prev => prev.map(a =>
        a.asset_key === assetKey ? { ...a, qa_status: 'pending' } : a
      ));
      return false;
    } finally {
      setGenerating(prev => {
        const next = new Set(prev);
        next.delete(assetKey);
        return next;
      });
    }
  };

  const handleBatchGenerate = async () => {
    const queue = Array.from(selected).filter(key => {
      const asset = assets.find(a => a.asset_key === key);
      return asset && asset.prompt_template;
    });

    if (queue.length === 0) {
      toast.error('No valid assets selected (need prompt templates)');
      return;
    }

    batchAbort.current = false;
    setBatchRunning(true);
    toast.info(`Starting batch: ${queue.length} assets. Generating sequentially to avoid rate limits...`);

    for (let i = 0; i < queue.length; i++) {
      if (batchAbort.current) {
        toast.warning(`Batch stopped after ${i}/${queue.length} assets.`);
        break;
      }
      toast.info(`[${i + 1}/${queue.length}] Generating ${queue[i]}...`);
      const success = await generateSingle(queue[i]);

      // Delay between calls to avoid rate limits
      if (i < queue.length - 1 && !batchAbort.current) {
        await new Promise(r => setTimeout(r, success ? 3000 : 5000));
      }
    }

    setBatchRunning(false);
    if (!batchAbort.current) {
      toast.success(`Batch complete. ${queue.length} assets processed.`);
    }
    setSelected(new Set());
  };

  const handleStopBatch = () => {
    batchAbort.current = true;
    toast.warning('Stopping batch after current asset finishes...');
  };

  const setQaStatus = async (assetKey: string, status: QaStatus) => {
    const updateData: Record<string, unknown> = { qa_status: status };
    if (status === 'approved') updateData.approved = true;
    if (status === 'rejected') updateData.approved = false;

    const { error } = await supabase
      .from('sprite_assets')
      .update(updateData)
      .eq('asset_key', assetKey);

    if (error) {
      toast.error(`Failed to update status: ${error.message}`);
      return;
    }

    setAssets(prev => prev.map(a =>
      a.asset_key === assetKey ? { ...a, qa_status: status, approved: status === 'approved' } : a
    ));

    toast.success(`${assetKey} → ${status.toUpperCase()}`);
  };

  const handleSavePrompt = async () => {
    if (!editingAsset) return;
    const { error } = await supabase
      .from('sprite_assets')
      .update({ prompt_template: editPrompt })
      .eq('asset_key', editingAsset.asset_key);

    if (error) {
      toast.error(`Failed to save prompt: ${error.message}`);
      return;
    }

    setAssets(prev => prev.map(a =>
      a.asset_key === editingAsset.asset_key ? { ...a, prompt_template: editPrompt } : a
    ));
    toast.success(`Prompt updated for ${editingAsset.asset_key}`);
    setEditingAsset(null);
  };

  const openEditPrompt = (asset: SpriteAssetRow) => {
    setEditingAsset(asset);
    setEditPrompt(asset.prompt_template || '');
  };

  const parseCSVRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { current += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ',') { result.push(current); current = ''; }
        else { current += ch; }
      }
    }
    result.push(current);
    return result;
  };

  const handleDownloadCSV = () => {
    const headers = ['asset_key', 'tier', 'unity_path', 'target_w', 'target_h', 'frame_count', 'ppu', 'filter_mode', 'qa_status', 'prompt_template', 'primary_color'];
    const rows = assets.map(a =>
      headers.map(h => {
        const val = (a as any)[h];
        if (val === null || val === undefined) return '';
        const str = String(val);
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sprite-assets-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${assets.length} rows as CSV`);
  };

  const handleUploadCSV = async (file: File) => {
    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) {
      toast.error('CSV must have a header row and at least one data row');
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const keyIdx = headers.indexOf('asset_key');
    if (keyIdx === -1) {
      toast.error('CSV must contain an "asset_key" column');
      return;
    }

    const updatableFields = ['tier', 'unity_path', 'target_w', 'target_h', 'frame_count', 'ppu', 'filter_mode', 'prompt_template', 'primary_color'];
    const existingKeys = new Set(assets.map(a => a.asset_key));

    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVRow(lines[i]);
      if (row.length < headers.length) continue;

      const assetKey = row[keyIdx]?.trim();
      if (!assetKey || !existingKeys.has(assetKey)) {
        skipped++;
        continue;
      }

      const updateData: Record<string, unknown> = {};
      for (const field of updatableFields) {
        const idx = headers.indexOf(field);
        if (idx === -1) continue;
        const val = row[idx]?.trim();
        if (val === '' || val === undefined) continue;

        if (['target_w', 'target_h', 'frame_count', 'ppu'].includes(field)) {
          const num = parseInt(val, 10);
          if (!isNaN(num)) updateData[field] = num;
        } else {
          updateData[field] = val;
        }
      }

      if (Object.keys(updateData).length === 0) continue;

      const { error } = await supabase
        .from('sprite_assets')
        .update(updateData)
        .eq('asset_key', assetKey);

      if (error) {
        errors.push(`${assetKey}: ${error.message}`);
      } else {
        updated++;
      }
    }

    await fetchAssets();
    toast.success(`Updated ${updated} rows. ${skipped} skipped (not in DB).`);
    if (errors.length > 0) {
      toast.error(`${errors.length} errors: ${errors.slice(0, 3).join('; ')}`);
    }
  };

  const handleDownloadAllZip = async () => {
    const downloadable = assets.filter(
      a => a.storage_url && ['generated', 'qa_pass', 'approved'].includes(a.qa_status)
    );
    if (downloadable.length === 0) {
      toast.error('NO GENERATED ASSETS TO DOWNLOAD.');
      return;
    }
    toast.info(`PACKAGING ${downloadable.length} ASSETS...`);
    const zip = new JSZip();

    for (const asset of downloadable) {
      const url = asset.storage_url!;
      try {
        // Reconstruct folder structure from unity_path
        const pathParts = asset.unity_path.replace(/^Assets\//, '');
        if (url.startsWith('data:')) {
          const base64 = url.split(',')[1];
          if (base64) zip.file(pathParts, base64, { base64: true });
        } else {
          const resp = await fetch(url);
          if (resp.ok) {
            const blob = await resp.blob();
            zip.file(pathParts, blob);
          }
        }
      } catch (e) {
        console.error(`Failed to add ${asset.asset_key}:`, e);
      }
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const dlUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'riftdivers-assets.zip';
    link.href = dlUrl;
    link.click();
    URL.revokeObjectURL(dlUrl);
    toast.success(`ZIP DISPATCHED — ${downloadable.length} ASSETS.`);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredAssets = getFilteredAssets();
  const tiers = [...new Set(assets.map(a => a.tier))].sort();
  const statuses = [...new Set(assets.map(a => a.qa_status))].sort();

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const stats = {
    total: totalCount,
    pending: assets.filter(a => a.qa_status === 'pending').length,
    generated: assets.filter(a => a.qa_status === 'generated').length,
    approved: assets.filter(a => a.qa_status === 'approved').length,
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-4">
          <h1 className="font-display text-sm text-primary tracking-widest">BATCH QUEUE</h1>
          <div className="flex gap-2 text-[10px] font-body text-muted-foreground">
            <span>{stats.total} total</span>
            <span className="text-accent">·</span>
            <span>{stats.pending} pending</span>
            <span className="text-accent">·</span>
            <span>{stats.generated} generated</span>
            <span className="text-accent">·</span>
            <span className="text-emerald-400">{stats.approved} approved</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const json = exportClassSystemJSON();
              const blob = new Blob([json], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'class-system.json';
              a.click();
              URL.revokeObjectURL(url);
              toast.success('CLASS SYSTEM EXPORTED.');
            }}
            className="text-xs text-accent hover:text-primary transition-colors font-body"
          >
            📦 EXPORT CLASSES
          </button>
          <button
            onClick={handleDownloadCSV}
            className="text-xs text-accent hover:text-primary transition-colors font-body"
          >
            ⬇ DOWNLOAD CSV
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-accent hover:text-primary transition-colors font-body"
          >
            ⬆ UPLOAD CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleUploadCSV(file);
                e.target.value = '';
              }
            }}
          />
          <button
            onClick={handleDownloadAllZip}
            className="text-xs text-accent hover:text-primary transition-colors font-body"
          >
            📥 DOWNLOAD ZIP
          </button>
          <button onClick={() => navigate('/generator')} className="text-xs text-muted-foreground hover:text-accent transition-colors font-body">FORGE</button>
          <button onClick={() => navigate('/library')} className="text-xs text-muted-foreground hover:text-accent transition-colors font-body">VAULT</button>
          <button onClick={signOut} className="text-xs text-muted-foreground hover:text-primary transition-colors font-body">EXIT</button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        {/* Filters */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-display text-muted-foreground tracking-widest">TIER</span>
          <select
            value={filterTier}
            onChange={e => setFilterTier(e.target.value)}
            className="bg-muted border border-border text-foreground text-xs px-2 py-1 font-body"
          >
            <option value="all">ALL</option>
            {tiers.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-display text-muted-foreground tracking-widest">STATUS</span>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-muted border border-border text-foreground text-xs px-2 py-1 font-body"
          >
            <option value="all">ALL</option>
            {statuses.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
          </select>
        </div>

        <div className="flex-1" />

        <Button
          variant="outline"
          size="sm"
          onClick={selectAllFiltered}
          className="text-[10px] font-display tracking-widest"
        >
          {filteredAssets.every(a => selected.has(a.asset_key)) ? 'DESELECT ALL' : 'SELECT ALL'}
        </Button>

        <Button
          onClick={handleBatchGenerate}
          disabled={selected.size === 0 || batchRunning}
          size="sm"
          className="text-[10px] font-display tracking-widest px-6"
        >
          {batchRunning
            ? `GENERATING (${generating.size})...`
            : `FORGE ${selected.size} SELECTED`}
        </Button>

        {batchRunning && (
          <Button
            onClick={handleStopBatch}
            variant="destructive"
            size="sm"
            className="text-[10px] font-display tracking-widest px-4"
          >
            STOP
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="font-display text-sm text-primary animate-pulse tracking-widest">LOADING ASSET REGISTRY...</p>
          </div>
        ) : (
          <table className="w-full text-xs font-body">
            <thead className="sticky top-0 bg-card border-b border-border z-10">
              <tr>
                <th className="px-3 py-2 text-left w-8">
                  <Checkbox
                    checked={filteredAssets.length > 0 && filteredAssets.every(a => selected.has(a.asset_key))}
                    onCheckedChange={selectAllFiltered}
                  />
                </th>
                <th className="px-3 py-2 text-left font-display text-[10px] tracking-widest text-muted-foreground">ASSET KEY</th>
                <th className="px-3 py-2 text-left font-display text-[10px] tracking-widest text-muted-foreground">TIER</th>
                <th className="px-3 py-2 text-left font-display text-[10px] tracking-widest text-muted-foreground">SIZE</th>
                <th className="px-3 py-2 text-left font-display text-[10px] tracking-widest text-muted-foreground">FRAMES</th>
                <th className="px-3 py-2 text-left font-display text-[10px] tracking-widest text-muted-foreground">STATUS</th>
                <th className="px-3 py-2 text-left font-display text-[10px] tracking-widest text-muted-foreground">PREVIEW</th>
                <th className="px-3 py-2 text-left font-display text-[10px] tracking-widest text-muted-foreground">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.map((asset) => (
                <tr
                  key={asset.asset_key}
                  className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${
                    generating.has(asset.asset_key) ? 'bg-accent/5' : ''
                  }`}
                >
                  <td className="px-3 py-2">
                    <Checkbox
                      checked={selected.has(asset.asset_key)}
                      onCheckedChange={() => toggleSelect(asset.asset_key)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-display text-[11px] text-foreground tracking-wide">
                        {asset.asset_key}
                      </span>
                      {asset.prompt_template && (
                        <span className="text-[9px] text-muted-foreground truncate max-w-[200px]" title={asset.prompt_template}>
                          {asset.prompt_template}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-[10px]">
                      {TIER_ICONS[asset.tier] || '📦'} {asset.tier}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {asset.target_w}×{asset.target_h}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {asset.frame_count > 1 ? `${asset.frame_count}f` : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant="outline"
                      className={`text-[9px] font-display tracking-wider ${STATUS_COLORS[asset.qa_status] || ''}`}
                    >
                      {asset.qa_status.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    {asset.storage_url ? (
                      <div className="flex items-center gap-1.5">
                        <img
                          src={asset.storage_url}
                          alt={asset.asset_key}
                          className="h-8 border border-border bg-card cursor-pointer hover:ring-1 hover:ring-primary transition-all"
                          style={{ imageRendering: 'pixelated' }}
                          onClick={() => setPreviewAsset(asset)}
                          title="Click to enlarge"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-[9px] text-muted-foreground hover:text-accent"
                          title="Download"
                          onClick={() => {
                            const a = document.createElement('a');
                            a.href = asset.storage_url!;
                            a.download = `${asset.asset_key}.png`;
                            a.click();
                          }}
                        >
                          ⬇
                        </Button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-[9px]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                     <div className="flex items-center gap-1">
                       {/* Edit prompt button — always available */}
                       <Button
                         variant="ghost"
                         size="sm"
                         className="h-6 w-6 p-0 text-[9px] text-muted-foreground hover:text-accent"
                         title="Edit prompt"
                         onClick={() => openEditPrompt(asset)}
                       >
                         ✏️
                       </Button>

                       {/* Generate button */}
                       {(asset.qa_status === 'pending' || asset.qa_status === 'rejected') && (
                         <Button
                           variant="outline"
                           size="sm"
                           className="h-6 px-2 text-[9px] font-display tracking-wider"
                           disabled={generating.has(asset.asset_key) || !asset.prompt_template}
                           onClick={() => generateSingle(asset.asset_key)}
                         >
                           {generating.has(asset.asset_key) ? '...' : '⚒️'}
                         </Button>
                       )}

                       {/* QA Pass */}
                       {asset.qa_status === 'generated' && (
                         <>
                           <Button
                             variant="outline"
                             size="sm"
                             className="h-6 px-2 text-[9px] font-display tracking-wider text-emerald-400 border-emerald-800 hover:bg-emerald-900/30"
                             onClick={() => setQaStatus(asset.asset_key, 'qa_pass')}
                           >
                             ✓ QA
                           </Button>
                           <Button
                             variant="outline"
                             size="sm"
                             className="h-6 px-2 text-[9px] font-display tracking-wider text-destructive border-destructive/50 hover:bg-destructive/10"
                             onClick={() => setQaStatus(asset.asset_key, 'rejected')}
                           >
                             ✗
                           </Button>
                         </>
                       )}

                       {/* Approve */}
                       {asset.qa_status === 'qa_pass' && (
                         <>
                           <Button
                             variant="outline"
                             size="sm"
                             className="h-6 px-2 text-[9px] font-display tracking-wider text-emerald-300 border-emerald-700 hover:bg-emerald-900/40"
                             onClick={() => setQaStatus(asset.asset_key, 'approved')}
                           >
                             ✓ APPROVE
                           </Button>
                           <Button
                             variant="outline"
                             size="sm"
                             className="h-6 px-2 text-[9px] font-display tracking-wider text-destructive border-destructive/50 hover:bg-destructive/10"
                             onClick={() => setQaStatus(asset.asset_key, 'rejected')}
                           >
                             ✗
                           </Button>
                         </>
                       )}

                       {/* Approved — show label + regenerate option */}
                       {asset.qa_status === 'approved' && (
                         <Button
                           variant="ghost"
                           size="sm"
                           className="h-6 px-2 text-[9px] font-display tracking-wider text-muted-foreground hover:text-accent"
                           onClick={() => {
                             if (confirm(`Re-generate ${asset.asset_key}? This will overwrite the approved version.`)) {
                               setQaStatus(asset.asset_key, 'pending');
                             }
                           }}
                         >
                           ↻
                         </Button>
                       )}

                       {/* Rejected — regenerate */}
                       {asset.qa_status === 'rejected' && (
                         <Button
                           variant="outline"
                           size="sm"
                           className="h-6 px-2 text-[9px] font-display tracking-wider"
                           disabled={generating.has(asset.asset_key)}
                           onClick={() => generateSingle(asset.asset_key)}
                         >
                           ↻ RETRY
                         </Button>
                       )}
                     </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {/* Preview Modal */}
      <Dialog open={!!previewAsset} onOpenChange={(open) => !open && setPreviewAsset(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-4 bg-card border-border p-6">
          <DialogTitle className="sr-only">Asset Preview</DialogTitle>
          <DialogDescription className="sr-only">Preview and QA the selected asset</DialogDescription>
          {previewAsset && (
            <>
              <div className="flex items-center justify-between w-full">
                <div>
                  <h2 className="font-display text-sm tracking-widest text-primary">{previewAsset.asset_key}</h2>
                  <p className="text-[10px] text-muted-foreground font-body">
                    {previewAsset.tier} · {previewAsset.target_w}×{previewAsset.target_h} · {previewAsset.frame_count > 1 ? `${previewAsset.frame_count} frames` : 'static'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-[9px] font-display tracking-wider ${STATUS_COLORS[previewAsset.qa_status] || ''}`}>
                    {previewAsset.qa_status.toUpperCase()}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[10px] font-display tracking-wider"
                    onClick={() => {
                      const a = document.createElement('a');
                      a.href = previewAsset.storage_url!;
                      a.download = `${previewAsset.asset_key}.png`;
                      a.click();
                    }}
                  >
                    ⬇ DOWNLOAD
                  </Button>
                </div>
              </div>
              {previewAsset.storage_url && (
                <div className="flex-1 flex items-center justify-center overflow-auto bg-[repeating-conic-gradient(hsl(var(--muted))_0%_25%,hsl(var(--background))_0%_50%)] bg-[length:16px_16px] rounded border border-border p-4 w-full">
                  <img
                    src={previewAsset.storage_url}
                    alt={previewAsset.asset_key}
                    className="max-w-full max-h-[70vh] object-contain"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>
              )}
              {previewAsset.prompt_template && (
                <p className="text-[10px] text-muted-foreground font-body w-full">{previewAsset.prompt_template}</p>
              )}
              <div className="flex items-center gap-2 w-full justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[10px] font-display tracking-wider"
                  onClick={() => { openEditPrompt(previewAsset); setPreviewAsset(null); }}
                >
                  ✏️ EDIT PROMPT
                </Button>
                {previewAsset.qa_status === 'generated' && (
                  <>
                    <Button
                      size="sm"
                      className="text-[10px] font-display tracking-wider"
                      onClick={() => { setQaStatus(previewAsset.asset_key, 'qa_pass'); setPreviewAsset(null); }}
                    >
                      ✓ QA PASS
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="text-[10px] font-display tracking-wider"
                      onClick={() => { setQaStatus(previewAsset.asset_key, 'rejected'); setPreviewAsset(null); }}
                    >
                      ✗ REJECT
                    </Button>
                  </>
                )}
                {previewAsset.qa_status === 'qa_pass' && (
                  <>
                    <Button
                      size="sm"
                      className="text-[10px] font-display tracking-wider"
                      onClick={() => { setQaStatus(previewAsset.asset_key, 'approved'); setPreviewAsset(null); }}
                    >
                      ✓ APPROVE
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="text-[10px] font-display tracking-wider"
                      onClick={() => { setQaStatus(previewAsset.asset_key, 'rejected'); setPreviewAsset(null); }}
                    >
                      ✗ REJECT
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Prompt Modal */}
      <Dialog open={!!editingAsset} onOpenChange={(open) => !open && setEditingAsset(null)}>
        <DialogContent className="max-w-2xl bg-card border-border p-6">
          <DialogTitle className="font-display text-sm tracking-widest text-primary">
            EDIT PROMPT — {editingAsset?.asset_key}
          </DialogTitle>
          <DialogDescription className="text-[10px] text-muted-foreground font-body">
            {editingAsset?.tier} · {editingAsset?.target_w}×{editingAsset?.target_h}
            {editingAsset?.qa_status === 'rejected' && ' · Previously rejected — refine and re-generate.'}
          </DialogDescription>
          {editingAsset && (
            <div className="flex flex-col gap-4 mt-2">
              {editingAsset.storage_url && (
                <div className="flex items-center gap-3">
                  <img
                    src={editingAsset.storage_url}
                    alt={editingAsset.asset_key}
                    className="h-16 border border-border bg-card"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  <Badge variant="outline" className={`text-[9px] font-display tracking-wider ${STATUS_COLORS[editingAsset.qa_status] || ''}`}>
                    {editingAsset.qa_status.toUpperCase()}
                  </Badge>
                </div>
              )}
              <Textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                className="min-h-[200px] text-xs font-body bg-muted border-border resize-y"
                placeholder="Enter the prompt template for this asset..."
              />
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-muted-foreground font-body">
                  {editPrompt.length} chars
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[10px] font-display tracking-wider"
                    onClick={() => setEditingAsset(null)}
                  >
                    CANCEL
                  </Button>
                  <Button
                    size="sm"
                    className="text-[10px] font-display tracking-wider px-6"
                    onClick={handleSavePrompt}
                  >
                    SAVE PROMPT
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BatchQueuePage;
