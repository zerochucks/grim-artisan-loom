import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const PIXEL_TIERS = ['unit', 'icon', 'tile', 'node', 'ui', 'vfx', 'font'];
const ZOOM_STEPS = [1, 2, 4, 6, 8, 12, 16];

type Tool = 'brush' | 'eraser' | 'fill' | 'eyedrop' | 'marquee';

interface Frame { index: number; name: string; group?: string; url: string; }

export interface EditableAsset {
  asset_key: string;
  tier: string;
  target_w: number;
  target_h: number;
  frame_count: number;
  storage_url: string | null;
  primary_color: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  asset: EditableAsset | null;
  onSaved: (newStorageUrl: string) => void;
}

function isManifestUrl(url: string | null): boolean {
  if (!url) return false;
  return url.endsWith('.json') || url.includes('manifest');
}

export function AssetEditor({ open, onClose, asset, onSaved }: Props) {
  const [frames, setFrames] = useState<Frame[] | null>(null);
  const [frameIdx, setFrameIdx] = useState<number | null>(null);
  const [tool, setTool] = useState<Tool>('brush');
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(1);
  const [zoom, setZoom] = useState(8);
  const [subPrompt, setSubPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [region, setRegion] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [history, setHistory] = useState<ImageData[]>([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const marqueeStart = useRef<{ x: number; y: number } | null>(null);

  const isPixel = asset ? PIXEL_TIERS.includes(asset.tier) : true;
  const isManifest = asset ? isManifestUrl(asset.storage_url) : false;
  // For animated assets in a manifest, each frame is square at target_h
  const cellSize = asset && (asset.tier === 'unit' || asset.tier === 'vfx') ? asset.target_h : 0;
  const nativeW = !asset ? 64 : (isManifest && cellSize ? cellSize : asset.target_w);
  const nativeH = !asset ? 64 : (isManifest && cellSize ? cellSize : asset.target_h);

  // Reset on open
  useEffect(() => {
    if (!open) {
      setFrames(null);
      setFrameIdx(null);
      setRegion(null);
      setSubPrompt('');
      setHistory([]);
    }
  }, [open]);

  // Load manifest frames if applicable
  useEffect(() => {
    if (!open || !asset) return;
    if (!isManifest) { setFrames(null); setFrameIdx(null); return; }
    fetch(asset.storage_url!)
      .then(r => r.json())
      .then(m => {
        setFrames(m.frames || []);
        setFrameIdx(0);
      })
      .catch(() => toast.error('Failed to load frame manifest'));
  }, [open, asset, isManifest]);

  const sourceUrl = frames && frameIdx !== null && frames[frameIdx]
    ? frames[frameIdx].url
    : asset?.storage_url || null;

  // Load source into canvas
  useEffect(() => {
    if (!open || !sourceUrl || !asset) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = nativeW;
    canvas.height = nativeH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.clearRect(0, 0, nativeW, nativeH);
    setRegion(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, nativeW, nativeH);
      setHistory([ctx.getImageData(0, 0, nativeW, nativeH)]);
    };
    img.onerror = () => toast.error('Failed to load image (CORS?)');
    const sep = sourceUrl.includes('?') ? '&' : '?';
    img.src = sourceUrl + sep + 'cb=' + Date.now();
  }, [open, sourceUrl, nativeW, nativeH, asset]);

  const pushHistory = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const snap = ctx.getImageData(0, 0, nativeW, nativeH);
    setHistory(h => [...h.slice(-30), snap]);
  }, [nativeW, nativeH]);

  const undo = () => {
    setHistory(h => {
      if (h.length <= 1) return h;
      const next = h.slice(0, -1);
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) ctx.putImageData(next[next.length - 1], 0, 0);
      return next;
    });
  };

  const pixelFromEvent = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / zoom);
    const y = Math.floor((e.clientY - rect.top) / zoom);
    if (x < 0 || y < 0 || x >= nativeW || y >= nativeH) return null;
    return { x, y };
  };

  const drawAt = (px: number, py: number) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const s = brushSize;
    const x = px - Math.floor(s / 2);
    const y = py - Math.floor(s / 2);
    if (tool === 'eraser') {
      ctx.clearRect(x, y, s, s);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, s, s);
    }
  };

  const floodFill = (px: number, py: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const img = ctx.getImageData(0, 0, nativeW, nativeH);
    const data = img.data;
    const idx = (x: number, y: number) => (y * nativeW + x) * 4;
    const start = idx(px, py);
    const tr = data[start], tg = data[start + 1], tb = data[start + 2], ta = data[start + 3];
    const cr = parseInt(color.slice(1, 3), 16);
    const cg = parseInt(color.slice(3, 5), 16);
    const cb = parseInt(color.slice(5, 7), 16);
    if (tr === cr && tg === cg && tb === cb && ta === 255) return;
    const stack: [number, number][] = [[px, py]];
    while (stack.length) {
      const [x, y] = stack.pop()!;
      if (x < 0 || y < 0 || x >= nativeW || y >= nativeH) continue;
      const i = idx(x, y);
      if (data[i] !== tr || data[i + 1] !== tg || data[i + 2] !== tb || data[i + 3] !== ta) continue;
      data[i] = cr; data[i + 1] = cg; data[i + 2] = cb; data[i + 3] = 255;
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    ctx.putImageData(img, 0, 0);
  };

  const eyedrop = (px: number, py: number) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const d = ctx.getImageData(px, py, 1, 1).data;
    if (d[3] === 0) { toast.info('Transparent pixel'); return; }
    const hex = '#' + [d[0], d[1], d[2]].map(n => n.toString(16).padStart(2, '0')).join('');
    setColor(hex);
    setTool('brush');
  };

  const onMouseDown = (e: React.MouseEvent) => {
    const p = pixelFromEvent(e);
    if (!p) return;
    if (tool === 'marquee') {
      marqueeStart.current = p;
      setRegion({ x: p.x, y: p.y, w: 1, h: 1 });
      return;
    }
    if (tool === 'fill') { pushHistory(); floodFill(p.x, p.y); return; }
    if (tool === 'eyedrop') { eyedrop(p.x, p.y); return; }
    pushHistory();
    drawing.current = true;
    drawAt(p.x, p.y);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const p = pixelFromEvent(e);
    if (!p) return;
    if (tool === 'marquee' && marqueeStart.current) {
      const s = marqueeStart.current;
      setRegion({
        x: Math.min(s.x, p.x),
        y: Math.min(s.y, p.y),
        w: Math.abs(p.x - s.x) + 1,
        h: Math.abs(p.y - s.y) + 1,
      });
      return;
    }
    if (!drawing.current) return;
    drawAt(p.x, p.y);
  };

  const onMouseUp = () => {
    drawing.current = false;
    marqueeStart.current = null;
  };

  // Marquee overlay
  useEffect(() => {
    const o = overlayRef.current;
    if (!o) return;
    o.width = nativeW * zoom;
    o.height = nativeH * zoom;
    const ctx = o.getContext('2d')!;
    ctx.clearRect(0, 0, o.width, o.height);
    if (region) {
      ctx.strokeStyle = '#7C4DFF';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(
        region.x * zoom + 1,
        region.y * zoom + 1,
        region.w * zoom - 2,
        region.h * zoom - 2,
      );
    }
  }, [region, zoom, nativeW, nativeH]);

  const invokeEdit = async (
    payload: Record<string, unknown>,
    successMsg: string,
  ) => {
    if (!asset) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('edit-asset', { body: payload });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success(successMsg);
      onSaved(data.url);
    } catch (e: any) {
      toast.error(`Failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const saveManual = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !asset) return;
    const dataUrl = canvas.toDataURL('image/png');
    await invokeEdit({
      mode: 'manual',
      asset_key: asset.asset_key,
      source_image: dataUrl,
      frame_index: frameIdx,
      target_w: nativeW,
      target_h: nativeH,
      tier: asset.tier,
      is_pixel: isPixel,
    }, 'Manual edit saved');
  };

  const uploadFile = (file: File) => {
    if (!asset) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = async () => {
        const c = document.createElement('canvas');
        c.width = nativeW; c.height = nativeH;
        const cx = c.getContext('2d')!;
        cx.imageSmoothingEnabled = false;
        cx.drawImage(img, 0, 0, nativeW, nativeH);
        const out = c.toDataURL('image/png');
        await invokeEdit({
          mode: 'manual',
          asset_key: asset.asset_key,
          source_image: out,
          frame_index: frameIdx,
          target_w: nativeW, target_h: nativeH,
          tier: asset.tier, is_pixel: isPixel,
        }, 'PNG uploaded');
      };
      img.onerror = () => toast.error('Invalid image file');
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const aiRender = async () => {
    if (!subPrompt.trim()) { toast.error('Enter a change description'); return; }
    const canvas = canvasRef.current;
    if (!canvas || !asset) return;
    const dataUrl = canvas.toDataURL('image/png');
    await invokeEdit({
      mode: 'ai',
      asset_key: asset.asset_key,
      source_image: dataUrl,
      sub_prompt: subPrompt,
      region,
      frame_index: frameIdx,
      target_w: nativeW, target_h: nativeH,
      tier: asset.tier, is_pixel: isPixel,
    }, 'AI re-render complete');
  };

  const swatches = Array.from(new Set([
    '#000000', '#0C0C14', '#ffffff', '#7C4DFF', '#32C882', '#c03030',
    asset?.primary_color || '#888888',
  ]));

  if (!asset) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col bg-card border-border p-4 overflow-y-auto">
        <DialogTitle className="font-display text-sm tracking-widest text-primary">
          🎨 EDIT — {asset.asset_key}
          {frameIdx !== null && frames && frames[frameIdx] && ` · frame ${frameIdx} (${frames[frameIdx].name})`}
        </DialogTitle>
        <DialogDescription className="text-[10px] text-muted-foreground font-body">
          Manual paint = no credits. AI re-render uses credits. Native {nativeW}×{nativeH}px · {asset.tier}
        </DialogDescription>

        {frames && frames.length > 0 && (
          <div className="flex gap-1 overflow-x-auto py-2 border-b border-border">
            {frames.map(f => (
              <button
                key={f.index}
                onClick={() => setFrameIdx(f.index)}
                className={`shrink-0 border-2 ${frameIdx === f.index ? 'border-primary' : 'border-border'} bg-card p-0.5 flex flex-col items-center`}
                title={f.name}
              >
                <img src={f.url} className="h-12 w-12 object-contain" style={{ imageRendering: 'pixelated' }} alt={f.name} />
                <div className="text-[7px] text-center text-muted-foreground tracking-wider">{f.name}</div>
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-4 mt-2 flex-1 min-h-0">
          {/* Tool palette */}
          <div className="flex flex-col gap-2 w-44 shrink-0">
            <div className="grid grid-cols-2 gap-1">
              {(['brush', 'eraser', 'fill', 'eyedrop', 'marquee'] as Tool[]).map(t => (
                <Button
                  key={t}
                  variant={tool === t ? 'default' : 'outline'}
                  size="sm"
                  className="text-[9px] font-display tracking-wider h-7 px-1"
                  onClick={() => setTool(t)}
                >
                  {t === 'brush' ? '🖌' : t === 'eraser' ? '🩹' : t === 'fill' ? '🪣' : t === 'eyedrop' ? '💧' : '⬚'} {t}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-7 w-10 bg-transparent border border-border cursor-pointer" />
              <span className="text-[9px] font-body text-muted-foreground">{color.toUpperCase()}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {swatches.map((c, i) => (
                <button
                  key={i}
                  onClick={() => setColor(c)}
                  className="h-6 w-6 border border-border"
                  style={{ background: c }}
                  title={c}
                />
              ))}
            </div>
            <label className="text-[9px] font-display tracking-wider text-muted-foreground flex flex-col gap-1">
              BRUSH: {brushSize}px
              <input type="range" min={1} max={8} value={brushSize} onChange={e => setBrushSize(+e.target.value)} className="w-full" />
            </label>
            <div className="text-[9px] font-display tracking-wider text-muted-foreground">
              ZOOM
              <div className="flex flex-wrap gap-1 mt-1">
                {ZOOM_STEPS.map(z => (
                  <button
                    key={z}
                    onClick={() => setZoom(z)}
                    className={`text-[9px] px-1.5 py-0.5 border ${zoom === z ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground'}`}
                  >
                    {z}x
                  </button>
                ))}
              </div>
            </div>
            <Button variant="outline" size="sm" className="text-[9px] font-display tracking-wider" onClick={undo} disabled={history.length <= 1}>
              ↶ UNDO
            </Button>
            {region && (
              <>
                <Button variant="outline" size="sm" className="text-[9px] font-display tracking-wider" onClick={() => setRegion(null)}>
                  ✕ CLEAR REGION
                </Button>
                <div className="text-[8px] font-body text-accent">
                  region: ({region.x},{region.y}) {region.w}×{region.h}
                </div>
              </>
            )}
          </div>

          {/* Canvas */}
          <div className="flex-1 overflow-auto bg-[repeating-conic-gradient(hsl(var(--muted))_0%_25%,hsl(var(--background))_0%_50%)] bg-[length:16px_16px] border border-border p-2 flex items-start justify-center">
            <div className="relative" style={{ width: nativeW * zoom, height: nativeH * zoom }}>
              <canvas
                ref={canvasRef}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                style={{
                  width: nativeW * zoom,
                  height: nativeH * zoom,
                  imageRendering: 'pixelated',
                  cursor: 'crosshair',
                  position: 'absolute',
                  inset: 0,
                }}
              />
              <canvas
                ref={overlayRef}
                style={{
                  width: nativeW * zoom,
                  height: nativeH * zoom,
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                }}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
          <div className="flex flex-col gap-2">
            <div className="text-[10px] font-display tracking-widest text-emerald-400">MANUAL — NO CREDITS</div>
            <div className="flex gap-2">
              <Button size="sm" className="text-[10px] font-display tracking-wider flex-1" onClick={saveManual} disabled={busy}>
                💾 SAVE PAINTED EDIT
              </Button>
              <label className="flex-1">
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ''; }}
                />
                <span className="inline-flex items-center justify-center w-full text-[10px] font-display tracking-wider border border-border bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground h-9 px-3 cursor-pointer">
                  ⬆ UPLOAD PNG
                </span>
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-[10px] font-display tracking-widest text-primary">
              AI RE-RENDER — USES CREDITS{region ? ' · SCOPED TO REGION' : ''}
            </div>
            <Textarea
              value={subPrompt}
              onChange={e => setSubPrompt(e.target.value)}
              placeholder={region
                ? 'e.g. "change helmet color to gold" (only inside selection)'
                : 'e.g. "make the robes deeper red", "add a glowing rune on the chest"'}
              className="text-[10px] font-body bg-muted border-border min-h-[60px] resize-none"
            />
            <Button size="sm" className="text-[10px] font-display tracking-wider" onClick={aiRender} disabled={busy || !subPrompt.trim()}>
              {busy ? '⏳ RENDERING…' : `✨ AI RE-RENDER${region ? ' SELECTION' : ''}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}