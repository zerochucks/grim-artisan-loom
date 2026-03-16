import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { BUILT_IN_PALETTES } from '@/lib/forge-constants';
import { useNavigate } from 'react-router-dom';

interface PaletteEntry {
  id: string;
  name: string;
  description: string;
  colors: string[];
  isBuiltin: boolean;
  userId: string | null;
}

const PaletteManagerPage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [palettes, setPalettes] = useState<PaletteEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Create/edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPalette, setEditingPalette] = useState<PaletteEntry | null>(null);
  const [paletteName, setPaletteName] = useState('');
  const [paletteDesc, setPaletteDesc] = useState('');
  const [paletteColors, setPaletteColors] = useState<string[]>(['#0a0a0f', '#1a1420', '#2d1b2e', '#3d2040', '#5c3a50', '#8b6070', '#c49888', '#e8ccb0']);

  // Extract from image
  const [extractDialogOpen, setExtractDialogOpen] = useState(false);
  const [extractedColors, setExtractedColors] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hexFileInputRef = useRef<HTMLInputElement>(null);

  const fetchPalettes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('palettes')
      .select('*')
      .order('is_builtin', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('FAILED TO LOAD PALETTES.');
      console.error(error);
    } else {
      setPalettes(
        (data || []).map((row: any) => ({
          id: row.id,
          name: row.name,
          description: row.description || '',
          colors: row.colors || [],
          isBuiltin: row.is_builtin,
          userId: row.user_id,
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPalettes();
  }, [fetchPalettes]);

  // --- Color manipulation ---
  const addColor = () => {
    if (paletteColors.length >= 32) {
      toast.error('MAX 32 COLORS.');
      return;
    }
    setPaletteColors([...paletteColors, '#555555']);
  };

  const removeColor = (index: number) => {
    if (paletteColors.length <= 8) {
      toast.error('MIN 8 COLORS.');
      return;
    }
    setPaletteColors(paletteColors.filter((_, i) => i !== index));
  };

  const updateColor = (index: number, color: string) => {
    const next = [...paletteColors];
    next[index] = color;
    setPaletteColors(next);
  };

  // --- Save palette ---
  const handleSave = async () => {
    if (!paletteName.trim()) {
      toast.error('NAME YOUR PALETTE, SMITH.');
      return;
    }
    if (paletteColors.length < 8) {
      toast.error('MINIMUM 8 COLORS REQUIRED.');
      return;
    }

    try {
      if (editingPalette) {
        const { error } = await supabase
          .from('palettes')
          .update({
            name: paletteName.trim(),
            description: paletteDesc.trim(),
            colors: paletteColors,
          })
          .eq('id', editingPalette.id);
        if (error) throw error;
        toast.success('PALETTE REFORGED.');
      } else {
        const { error } = await supabase
          .from('palettes')
          .insert({
            user_id: user!.id,
            name: paletteName.trim(),
            description: paletteDesc.trim(),
            colors: paletteColors,
            is_builtin: false,
          });
        if (error) throw error;
        toast.success('NEW PALETTE FORGED.');
      }
      setDialogOpen(false);
      setEditingPalette(null);
      fetchPalettes();
    } catch (err: any) {
      toast.error(`SAVE FAILED: ${err.message}`);
    }
  };

  const handleDelete = async (palette: PaletteEntry) => {
    if (palette.isBuiltin) return;
    const { error } = await supabase.from('palettes').delete().eq('id', palette.id);
    if (error) {
      toast.error('DELETION FAILED.');
    } else {
      toast.success('PALETTE DESTROYED.');
      fetchPalettes();
    }
  };

  const openCreateDialog = () => {
    setEditingPalette(null);
    setPaletteName('');
    setPaletteDesc('');
    setPaletteColors(['#0a0a0f', '#1a1420', '#2d1b2e', '#3d2040', '#5c3a50', '#8b6070', '#c49888', '#e8ccb0']);
    setDialogOpen(true);
  };

  const openEditDialog = (palette: PaletteEntry) => {
    if (palette.isBuiltin) return;
    setEditingPalette(palette);
    setPaletteName(palette.name);
    setPaletteDesc(palette.description);
    setPaletteColors([...palette.colors]);
    setDialogOpen(true);
  };

  // --- .hex file import ---
  const handleHexImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      const colors: string[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        // Support "#RRGGBB", "RRGGBB", or just hex digits
        const match = trimmed.match(/^#?([0-9a-fA-F]{6})$/);
        if (match) {
          colors.push(`#${match[1].toLowerCase()}`);
        }
      }

      if (colors.length < 2) {
        toast.error('NO VALID HEX COLORS FOUND.');
        return;
      }

      // Clamp to 8-32
      const clamped = colors.slice(0, 32);
      while (clamped.length < 8) {
        clamped.push('#000000');
      }

      setPaletteColors(clamped);
      setPaletteName(file.name.replace(/\.(hex|txt|pal)$/i, ''));
      setPaletteDesc(`Imported from ${file.name}`);
      setDialogOpen(true);
      toast.success(`IMPORTED ${clamped.length} COLORS.`);
    };
    reader.readAsText(file);
    // Reset input
    if (hexFileInputRef.current) hexFileInputRef.current.value = '';
  };

  // --- Extract from image ---
  const handleExtractFromImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('NOT AN IMAGE FILE.');
      return;
    }

    setExtracting(true);
    setExtractDialogOpen(true);
    setExtractedColors([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        // Draw to canvas
        const canvas = canvasRef.current || document.createElement('canvas');
        const maxDim = 128;
        const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Extract all pixel colors
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const colorCounts = new Map<string, number>();

        for (let i = 0; i < imageData.data.length; i += 4) {
          const a = imageData.data[i + 3];
          if (a < 128) continue;
          const r = imageData.data[i];
          const g = imageData.data[i + 1];
          const b = imageData.data[i + 2];
          const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
          colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);
        }

        // Sort by frequency, take top 16
        const sorted = [...colorCounts.entries()]
          .sort((a, b) => b[1] - a[1]);

        // Reduce to 16 distinct colors using simple distance filtering
        const distinct: string[] = [];
        const hexToRgb = (hex: string) => ({
          r: parseInt(hex.slice(1, 3), 16),
          g: parseInt(hex.slice(3, 5), 16),
          b: parseInt(hex.slice(5, 7), 16),
        });

        for (const [hex] of sorted) {
          if (distinct.length >= 16) break;
          const rgb = hexToRgb(hex);
          const tooClose = distinct.some((d) => {
            const drgb = hexToRgb(d);
            const dist = Math.sqrt(
              (rgb.r - drgb.r) ** 2 + (rgb.g - drgb.g) ** 2 + (rgb.b - drgb.b) ** 2
            );
            return dist < 30;
          });
          if (!tooClose) distinct.push(hex);
        }

        // Sort by luminance (dark to light)
        distinct.sort((a, b) => {
          const la = hexToRgb(a);
          const lb = hexToRgb(b);
          return (la.r * 0.299 + la.g * 0.587 + la.b * 0.114) -
                 (lb.r * 0.299 + lb.g * 0.587 + lb.b * 0.114);
        });

        setExtractedColors(distinct);
        setExtracting(false);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const useExtractedColors = () => {
    const colors = [...extractedColors];
    while (colors.length < 8) colors.push('#000000');
    setPaletteColors(colors.slice(0, 32));
    setPaletteName('Extracted Palette');
    setPaletteDesc('Extracted from uploaded image');
    setExtractDialogOpen(false);
    setDialogOpen(true);
  };

  return (
    <div className="flex h-screen bg-background flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-4">
          <h1 className="font-display text-sm text-primary tracking-widest">PALETTE MANAGER</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/generator')} className="text-xs text-muted-foreground hover:text-accent transition-colors font-body">
            FORGE
          </button>
          <button onClick={() => navigate('/library')} className="text-xs text-muted-foreground hover:text-accent transition-colors font-body">
            VAULT
          </button>
          <button onClick={signOut} className="text-xs text-muted-foreground hover:text-primary transition-colors font-body">
            EXIT
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <Button size="sm" onClick={openCreateDialog} className="text-xs h-8">
          + NEW PALETTE
        </Button>
        <Button size="sm" variant="outline" onClick={() => hexFileInputRef.current?.click()} className="text-xs h-8">
          IMPORT .HEX
        </Button>
        <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="text-xs h-8">
          EXTRACT FROM IMAGE
        </Button>
        <input ref={hexFileInputRef} type="file" accept=".hex,.txt,.pal" className="hidden" onChange={handleHexImport} />
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleExtractFromImage} />
      </div>

      {/* Palette Grid */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="font-display text-sm text-muted-foreground animate-pulse">LOADING PALETTES...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Built-in */}
            <div>
              <h2 className="font-display text-[10px] text-accent tracking-widest mb-3">BUILT-IN PALETTES</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {palettes.filter((p) => p.isBuiltin).map((palette) => (
                  <PaletteCard key={palette.id} palette={palette} />
                ))}
              </div>
            </div>

            {/* Custom */}
            <div>
              <h2 className="font-display text-[10px] text-accent tracking-widest mb-3">CUSTOM PALETTES</h2>
              {palettes.filter((p) => !p.isBuiltin).length === 0 ? (
                <p className="text-xs text-muted-foreground font-body">No custom palettes yet. Create one above.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {palettes.filter((p) => !p.isBuiltin).map((palette) => (
                    <PaletteCard
                      key={palette.id}
                      palette={palette}
                      onEdit={() => openEditDialog(palette)}
                      onDelete={() => handleDelete(palette)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-sm tracking-widest">
              {editingPalette ? 'EDIT PALETTE' : 'FORGE NEW PALETTE'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] text-accent font-display tracking-widest">NAME</label>
              <Input
                value={paletteName}
                onChange={(e) => setPaletteName(e.target.value)}
                placeholder="My Custom Palette"
                className="bg-muted border-border text-sm h-8"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] text-accent font-display tracking-widest">DESCRIPTION</label>
              <Input
                value={paletteDesc}
                onChange={(e) => setPaletteDesc(e.target.value)}
                placeholder="Short description..."
                className="bg-muted border-border text-sm h-8"
              />
            </div>

            {/* Swatch Strip Preview */}
            <div>
              <label className="text-[10px] text-accent font-display tracking-widest">PREVIEW</label>
              <div className="flex mt-1 border border-border">
                {paletteColors.map((c, i) => (
                  <div key={i} className="h-6 flex-1" style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>

            {/* Color Grid */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] text-accent font-display tracking-widest">
                  COLORS ({paletteColors.length}/32)
                </label>
                <Button size="sm" variant="outline" onClick={addColor} className="text-[10px] h-6 px-2" disabled={paletteColors.length >= 32}>
                  + ADD
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {paletteColors.map((color, i) => (
                  <div key={i} className="flex items-center gap-1 border border-border p-1">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => updateColor(i, e.target.value)}
                      className="w-6 h-6 cursor-pointer bg-transparent border-0 p-0"
                    />
                    <Input
                      value={color}
                      onChange={(e) => updateColor(i, e.target.value)}
                      className="flex-1 bg-muted border-0 text-[10px] h-6 px-1 font-body"
                    />
                    <button
                      onClick={() => removeColor(i)}
                      className="text-[10px] text-muted-foreground hover:text-primary px-1"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} className="flex-1 font-display text-xs tracking-widest">
                {editingPalette ? 'SAVE CHANGES' : 'CREATE PALETTE'}
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="text-xs">
                CANCEL
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Extract from Image Dialog */}
      <Dialog open={extractDialogOpen} onOpenChange={setExtractDialogOpen}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-sm tracking-widest">EXTRACT PALETTE</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {extracting ? (
              <div className="flex items-center justify-center py-8">
                <p className="font-display text-sm text-primary animate-pulse">ANALYZING PIXELS...</p>
              </div>
            ) : extractedColors.length > 0 ? (
              <>
                <div>
                  <label className="text-[10px] text-accent font-display tracking-widest mb-2 block">
                    EXTRACTED {extractedColors.length} DOMINANT COLORS
                  </label>
                  <div className="flex border border-border">
                    {extractedColors.map((c, i) => (
                      <div key={i} className="h-8 flex-1" style={{ backgroundColor: c }} title={c} />
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {extractedColors.map((c, i) => (
                    <div key={i} className="text-[10px] text-muted-foreground font-body text-center py-1 border border-border" style={{ backgroundColor: c + '30' }}>
                      {c}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button onClick={useExtractedColors} className="flex-1 font-display text-xs tracking-widest">
                    USE THIS PALETTE
                  </Button>
                  <Button variant="outline" onClick={() => setExtractDialogOpen(false)} className="text-xs">
                    DISCARD
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground font-body">No colors extracted.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

function PaletteCard({
  palette,
  onEdit,
  onDelete,
}: {
  palette: PaletteEntry;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="border border-border bg-card p-3 space-y-2 group">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-xs text-foreground font-body font-semibold">{palette.name}</h3>
          <p className="text-[10px] text-muted-foreground">{palette.description}</p>
        </div>
        {palette.isBuiltin && (
          <span className="text-[9px] text-accent border border-accent/30 px-1 py-0.5">BUILT-IN</span>
        )}
      </div>

      {/* Swatch */}
      <div className="flex border border-border">
        {palette.colors.map((c, i) => (
          <div key={i} className="h-5 flex-1" style={{ backgroundColor: c }} title={c} />
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground">{palette.colors.length} colors</p>

      {!palette.isBuiltin && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <Button size="sm" variant="outline" onClick={onEdit} className="text-[10px] h-6 px-2">
              EDIT
            </Button>
          )}
          {onDelete && (
            <Button size="sm" variant="destructive" onClick={onDelete} className="text-[10px] h-6 px-2">
              DELETE
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default PaletteManagerPage;
