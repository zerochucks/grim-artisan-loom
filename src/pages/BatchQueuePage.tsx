import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

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
  const [filterTier, setFilterTier] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const fetchAssets = useCallback(async () => {
    const { data, error } = await supabase
      .from('sprite_assets')
      .select('*')
      .order('tier')
      .order('asset_key');

    if (error) {
      toast.error(`Failed to load assets: ${error.message}`);
      return;
    }
    setAssets((data as unknown as SpriteAssetRow[]) || []);
    setLoading(false);
  }, []);

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

      setAssets(prev => prev.map(a =>
        a.asset_key === assetKey ? { ...a, qa_status: 'generated', storage_url: data.image } : a
      ));

      toast.success(`${assetKey} generated`);
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

    toast.info(`Starting batch: ${queue.length} assets. Generating sequentially to avoid rate limits...`);

    for (let i = 0; i < queue.length; i++) {
      toast.info(`[${i + 1}/${queue.length}] Generating ${queue[i]}...`);
      const success = await generateSingle(queue[i]);

      // Delay between calls to avoid rate limits
      if (i < queue.length - 1) {
        await new Promise(r => setTimeout(r, success ? 3000 : 5000));
      }
    }

    toast.success(`Batch complete. ${queue.length} assets processed.`);
    setSelected(new Set());
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

  const filteredAssets = getFilteredAssets();
  const tiers = [...new Set(assets.map(a => a.tier))].sort();
  const statuses = [...new Set(assets.map(a => a.qa_status))].sort();

  const stats = {
    total: assets.length,
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
          disabled={selected.size === 0 || generating.size > 0}
          size="sm"
          className="text-[10px] font-display tracking-widest px-6"
        >
          {generating.size > 0
            ? `GENERATING (${generating.size})...`
            : `FORGE ${selected.size} SELECTED`}
        </Button>
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
                      <img
                        src={asset.storage_url}
                        alt={asset.asset_key}
                        className="h-8 border border-border bg-card"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    ) : (
                      <span className="text-muted-foreground text-[9px]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
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
    </div>
  );
};

export default BatchQueuePage;
