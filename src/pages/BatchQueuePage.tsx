import { useState, useEffect, useCallback, useRef } from 'react';
import { Slider } from '@/components/ui/slider';
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
  category: string | null;
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

type QaStatus = 'pending' | 'queued' | 'generating' | 'generated' | 'approved' | 'rejected';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  queued: 'bg-secondary text-secondary-foreground',
  generating: 'bg-accent text-accent-foreground animate-pulse',
  retrying: 'bg-amber-900/40 text-amber-400 animate-pulse',
  generated: 'bg-primary/20 text-primary',
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
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [previewAsset, setPreviewAsset] = useState<SpriteAssetRow | null>(null);
  const [editingAsset, setEditingAsset] = useState<SpriteAssetRow | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [variationStrength, setVariationStrength] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [globalTiers, setGlobalTiers] = useState<string[]>([]);
  const [globalStatuses, setGlobalStatuses] = useState<string[]>([]);
  const [globalCategories, setGlobalCategories] = useState<string[]>([]);
  const [globalStats, setGlobalStats] = useState<Record<string, number>>({});

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('sprite_assets')
      .select('id,asset_key,tier,category,unity_path,target_w,target_h,frame_count,ppu,filter_mode,primary_color,prompt_template,storage_url,qa_status,approved,user_id,created_at', { count: 'exact' });

    // Server-side filters
    if (filterTier !== 'all') query = query.eq('tier', filterTier);
    if (filterStatus !== 'all') query = query.eq('qa_status', filterStatus);
    if (filterCategory !== 'all') {
      if (filterCategory === 'misc') {
        query = query.or('category.eq.misc,category.is.null');
      } else {
        query = query.eq('category', filterCategory);
      }
    }

    const { data, error, count } = await query
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
  }, [page, filterTier, filterStatus, filterCategory]);

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
    return assets; // filtering is now server-side
  };

  const generateSingle = async (assetKey: string) => {
    setGenerating(prev => new Set(prev).add(assetKey));

    // Optimistically set status
    setAssets(prev => prev.map(a =>
      a.asset_key === assetKey ? { ...a, qa_status: 'generating' } : a
    ));

    try {
      const MAX_CLIENT_RETRIES = 3;
      let lastError = '';

      for (let attempt = 0; attempt < MAX_CLIENT_RETRIES; attempt++) {
        const { data, error } = await supabase.functions.invoke('batch-generate', {
          body: { asset_key: assetKey, variation_strength: variationStrength },
        });

        if (error) throw new Error(error.message);

        if (data?.error) {
          if (data.retryable && attempt < MAX_CLIENT_RETRIES - 1) {
            lastError = data.error;
            const waitSec = (attempt + 1) * 4;
            setAssets(prev => prev.map(a =>
              a.asset_key === assetKey ? { ...a, qa_status: `retry ${attempt + 1}/${MAX_CLIENT_RETRIES}` as any } : a
            ));
            toast.warning(`${assetKey}: ${data.error} — retrying in ${waitSec}s (${attempt + 1}/${MAX_CLIENT_RETRIES})`);
            await new Promise(r => setTimeout(r, waitSec * 1000));
            continue;
          }
          if (data.retryable) {
            throw new Error(`${data.error} (after ${MAX_CLIENT_RETRIES} retries)`);
          }
          throw new Error(data.error);
        }

        // Success — break out of retry loop
        const retries = data?.retries ?? 0;
        setAssets(prev => prev.map(a =>
          a.asset_key === assetKey ? { ...a, qa_status: 'generated', storage_url: data.image } : a
        ));
        toast.success(`${assetKey} generated${retries > 0 || attempt > 0 ? ` (${retries + attempt} retries)` : ''}`);
        return true;
      }

      throw new Error(lastError || 'Max retries exceeded');

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
    const approved = status === 'approved';
    const rejected = status === 'rejected';

    const { error } = await supabase
      .from('sprite_assets')
      .update({
        qa_status: status,
        approved: approved ? true : rejected ? false : undefined,
      })
      .eq('asset_key', assetKey);

    if (error) {
      toast.error(`Failed to update status: ${error.message}`);
      return;
    }

    // On approval, save a versioned copy to the vault (assets table)
    if (approved && user) {
      const asset = assets.find(a => a.asset_key === assetKey);
      if (asset && asset.storage_url) {
        // Check existing versions for this asset_key
        const { data: existing } = await supabase
          .from('assets')
          .select('version')
          .eq('user_id', user.id)
          .eq('name', asset.asset_key)
          .order('version', { ascending: false })
          .limit(1);

        const nextVersion = (existing && existing.length > 0) ? existing[0].version + 1 : 1;

        const { error: vaultError } = await supabase
          .from('assets')
          .insert({
            user_id: user.id,
            name: asset.asset_key,
            prompt: asset.prompt_template || '',
            asset_type: asset.tier,
            width: asset.target_w,
            height: asset.target_h,
            image_url: asset.storage_url,
            generation_mode: 'batch',
            version: nextVersion,
            source_asset_key: asset.asset_key,
          });

        if (vaultError) {
          console.error('Vault save failed:', vaultError);
          toast.error('Approved but failed to save to vault.');
        } else {
          toast.success(`${assetKey} → APPROVED (v${nextVersion} saved to vault)`);
        }
      }
    }

    setAssets(prev => prev.map(a =>
      a.asset_key === assetKey ? { ...a, qa_status: status, approved } : a
    ));

    if (!approved) {
      toast.success(`${assetKey} → ${status.toUpperCase()}`);
    }
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

  const handleDownloadCSV = async () => {
    const headers = ['asset_key', 'tier', 'unity_path', 'target_w', 'target_h', 'frame_count', 'ppu', 'filter_mode', 'qa_status', 'prompt_template', 'primary_color'];
    toast.info('Fetching all assets…');
    // Fetch ALL rows, not just current page
    let allRows: SpriteAssetRow[] = [];
    let from = 0;
    const batchSize = 500;
    while (true) {
      const { data, error } = await supabase
        .from('sprite_assets')
        .select('asset_key,tier,unity_path,target_w,target_h,frame_count,ppu,filter_mode,qa_status,prompt_template,primary_color')
        .order('tier')
        .order('asset_key')
        .range(from, from + batchSize - 1);
      if (error) { toast.error('Failed to fetch assets'); return; }
      if (!data || data.length === 0) break;
      allRows = allRows.concat(data as unknown as SpriteAssetRow[]);
      if (data.length < batchSize) break;
      from += batchSize;
    }
    const rows = allRows.map(a =>
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
    toast.success(`Downloaded ${allRows.length} rows as CSV`);
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
        .update(updateData as any)
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
    toast.info('FETCHING ASSET LIST...');
    const allDownloadable: SpriteAssetRow[] = [];
    const batchSize = 500;
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('sprite_assets')
        .select('asset_key, unity_path, storage_url, qa_status')
        .in('qa_status', ['generated', 'approved'])
        .not('storage_url', 'is', null)
        .order('asset_key')
        .range(from, from + batchSize - 1);
      if (error || !data) break;
      allDownloadable.push(...(data as unknown as SpriteAssetRow[]));
      if (data.length < batchSize) break;
      from += batchSize;
    }

    if (allDownloadable.length === 0) {
      toast.error('NO GENERATED ASSETS TO DOWNLOAD.');
      return;
    }

    const CHUNK = 50;
    const totalChunks = Math.ceil(allDownloadable.length / CHUNK);
    toast.info(`DOWNLOADING ${allDownloadable.length} ASSETS IN ${totalChunks} CHUNKS OF ${CHUNK}...`);
    let globalAdded = 0;
    let globalFailed = 0;

    for (let c = 0; c < totalChunks; c++) {
      const chunk = allDownloadable.slice(c * CHUNK, (c + 1) * CHUNK);
      const zip = new JSZip();
      let added = 0;
      let failed = 0;

      for (const asset of chunk) {
        const url = asset.storage_url!;
        try {
          const pathParts = asset.unity_path.replace(/^Assets\//, '');
          const filename = pathParts.endsWith('.png') ? pathParts : `${pathParts}.png`;
          if (url.startsWith('data:')) {
            const base64 = url.split(',')[1];
            if (base64) { zip.file(filename, base64, { base64: true }); added++; }
          } else {
            const resp = await fetch(url, { mode: 'cors' });
            if (resp.ok) {
              const blob = await resp.blob();
              if (blob.size > 0) { zip.file(filename, blob); added++; }
              else { console.warn(`Empty blob for ${asset.asset_key}`); failed++; }
            } else {
              console.error(`HTTP ${resp.status} for ${asset.asset_key}: ${url}`);
              failed++;
            }
          }
        } catch (e) {
          console.error(`Failed to add ${asset.asset_key}:`, e);
          failed++;
        }
      }

      globalAdded += added;
      globalFailed += failed;

      if (added > 0) {
        const blob = await zip.generateAsync({ type: 'blob' });
        const dlUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = totalChunks === 1 ? 'riftdivers-assets.zip' : `riftdivers-assets-part${c + 1}.zip`;
        link.href = dlUrl;
        link.click();
        URL.revokeObjectURL(dlUrl);
      }

      toast.info(`Chunk ${c + 1}/${totalChunks} done (${added} files).`);
      // Small delay between chunks to let browser breathe
      if (c < totalChunks - 1) await new Promise(r => setTimeout(r, 1000));
    }

    toast.success(`DOWNLOAD COMPLETE — ${globalAdded} assets in ${totalChunks} ZIPs.${globalFailed > 0 ? ` ${globalFailed} failed.` : ''}`);
  };

  const [syncing, setSyncing] = useState(false);

  const handleSyncToVault = async () => {
    if (!user) return;
    setSyncing(true);
    try {
      // Fetch all approved assets with storage URLs
      const allApproved: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('sprite_assets')
          .select('asset_key, tier, target_w, target_h, storage_url, prompt_template')
          .eq('qa_status', 'approved')
          .not('storage_url', 'is', null)
          .order('asset_key')
          .range(from, from + 999);
        if (error || !data || data.length === 0) break;
        allApproved.push(...data);
        if (data.length < 1000) break;
        from += 1000;
      }

      if (allApproved.length === 0) {
        toast.info('No approved assets to sync.');
        setSyncing(false);
        return;
      }

      // Fetch existing vault entries by source_asset_key
      const { data: existingVault } = await supabase
        .from('assets')
        .select('source_asset_key, version')
        .eq('user_id', user.id)
        .not('source_asset_key', 'is', null);

      const vaultMap = new Map<string, number>();
      for (const e of existingVault || []) {
        const cur = vaultMap.get(e.source_asset_key!) || 0;
        if (e.version > cur) vaultMap.set(e.source_asset_key!, e.version);
      }

      let inserted = 0;
      let skipped = 0;
      for (const asset of allApproved) {
        const existingVersion = vaultMap.get(asset.asset_key);
        // Skip if already in vault with same URL (no re-generation happened)
        if (existingVersion !== undefined) {
          skipped++;
          continue;
        }
        const { error } = await supabase.from('assets').insert({
          user_id: user.id,
          name: asset.asset_key,
          prompt: asset.prompt_template || '',
          asset_type: asset.tier,
          width: asset.target_w,
          height: asset.target_h,
          image_url: asset.storage_url,
          generation_mode: 'batch',
          version: 1,
          source_asset_key: asset.asset_key,
        });
        if (!error) inserted++;
      }

      toast.success(`VAULT SYNC: ${inserted} new, ${skipped} already synced.`);
    } catch (e) {
      console.error('Sync failed:', e);
      toast.error('Vault sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredAssets = getFilteredAssets();

  useEffect(() => {
    const fetchGlobalMeta = async () => {
      const { data: allRows } = await supabase
        .from('sprite_assets')
        .select('tier, category, qa_status');
      if (!allRows) return;
      setGlobalTiers([...new Set(allRows.map((a: any) => a.tier))].sort());
      setGlobalStatuses([...new Set(allRows.map((a: any) => a.qa_status))].sort());
      setGlobalCategories([...new Set(allRows.map((a: any) => a.category || 'misc'))].sort());
      const counts: Record<string, number> = {};
      let total = 0;
      for (const r of allRows) {
        counts[r.qa_status] = (counts[r.qa_status] || 0) + 1;
        total++;
      }
      counts.total = total;
      setGlobalStats(counts);
    };
    fetchGlobalMeta();
  }, []);

  const tiers = globalTiers.length > 0 ? globalTiers : [...new Set(assets.map(a => a.tier))].sort();
  const statuses = globalStatuses.length > 0 ? globalStatuses : [...new Set(assets.map(a => a.qa_status))].sort();
  const categories = globalCategories.length > 0 ? globalCategories : [...new Set(assets.map(a => a.category || 'misc'))].sort();

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const stats = {
    total: globalStats.total || totalCount,
    pending: globalStats.pending || 0,
    generated: globalStats.generated || 0,
    approved: globalStats.approved || 0,
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
            onClick={async () => {
              const allRows: any[] = [];
              let from = 0;
              while (true) {
                const { data, error } = await supabase
                  .from('sprite_assets')
                  .select('asset_key, unity_path, storage_url, qa_status')
                  .in('qa_status', ['generated', 'approved'])
                  .not('storage_url', 'is', null)
                  .order('asset_key')
                  .range(from, from + 999);
                if (error || !data || data.length === 0) break;
                allRows.push(...data);
                if (data.length < 1000) break;
                from += 1000;
              }
              if (allRows.length === 0) { toast.error('NO ASSETS WITH URLS.'); return; }
              const csv = ['asset_key,unity_path,status,storage_url', ...allRows.map((r: any) =>
                `${r.asset_key},${r.unity_path},${r.qa_status},${r.storage_url}`
              )].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = 'asset-download-links.csv'; a.click();
              URL.revokeObjectURL(url);
              toast.success(`EXPORTED ${allRows.length} DOWNLOAD LINKS.`);
            }}
            className="text-xs text-accent hover:text-primary transition-colors font-body"
          >
            🔗 LINKS CSV
          </button>
          <button
            onClick={handleDownloadAllZip}
            className="text-xs text-accent hover:text-primary transition-colors font-body"
          >
            📥 DOWNLOAD ZIP
          </button>
          <button
            onClick={handleSyncToVault}
            disabled={syncing}
            className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-body disabled:opacity-50"
          >
            {syncing ? '⏳ SYNCING…' : '🔄 SYNC TO VAULT'}
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
            onChange={e => { setFilterTier(e.target.value); setPage(0); }}
            className="bg-muted border border-border text-foreground text-xs px-2 py-1 font-body"
          >
            <option value="all">ALL</option>
            {tiers.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-display text-muted-foreground tracking-widest">CATEGORY</span>
          <select
            value={filterCategory}
            onChange={e => { setFilterCategory(e.target.value); setPage(0); }}
            className="bg-muted border border-border text-foreground text-xs px-2 py-1 font-body"
          >
            <option value="all">ALL</option>
            {categories.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-display text-muted-foreground tracking-widest">STATUS</span>
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(0); }}
            className="bg-muted border border-border text-foreground text-xs px-2 py-1 font-body"
          >
            <option value="all">ALL</option>
            {statuses.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2 ml-4">
          <span className="text-[10px] font-display text-muted-foreground tracking-widest whitespace-nowrap">VARIATION</span>
          <Slider
            value={[variationStrength]}
            onValueChange={([v]) => setVariationStrength(v)}
            min={0}
            max={100}
            step={10}
            className="w-24"
          />
          <span className="text-[10px] font-body text-foreground w-8 text-right">{variationStrength}%</span>
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
                <th className="px-3 py-2 text-left font-display text-[10px] tracking-widest text-muted-foreground">CAT</th>
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
                  <td className="px-3 py-2">
                    <span className="text-[9px] text-muted-foreground uppercase">{asset.category || 'misc'}</span>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-2">
          <span className="text-[10px] font-body text-muted-foreground">
            Page {page + 1} of {totalPages} · Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-[10px] font-display tracking-wider"
              disabled={page === 0}
              onClick={() => setPage(0)}
            >
              ⟨⟨ FIRST
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-[10px] font-display tracking-wider"
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
            >
              ⟨ PREV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-[10px] font-display tracking-wider"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
            >
              NEXT ⟩
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-[10px] font-display tracking-wider"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(totalPages - 1)}
            >
              LAST ⟩⟩
            </Button>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      <Dialog open={!!previewAsset} onOpenChange={(open) => !open && setPreviewAsset(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col items-center gap-4 bg-card border-border p-6 overflow-y-auto">
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
                    className="max-w-full max-h-[50vh] object-contain"
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
