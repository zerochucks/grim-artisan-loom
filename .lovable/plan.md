# PIXEL FORGE — Grimdark Asset Generator

## Phase 1: Core App Shell & UI

### Design System

- Dark charcoal theme matching the design brief: `#0a0a0f` backgrounds, `#c03030` blood-red accents, `#2b2d38` iron borders, `#d4a878` warm amber text
- Fonts: Silkscreen (Google Fonts) for headers, IBM Plex Mono for body
- Sharp corners (0-2px radius), 1px borders, no soft shadows
- Checkerboard canvas background with `conic-gradient`
- Iron "forge" aesthetic throughout — dense, utilitarian, workbench feel

### Auth (Lovable Cloud)

- Email + password signup/login
- Dark landing page with "FORGE NEW ASSETS" hero
- Password reset flow with `/reset-password` page

### Generator Page (Main)

- **Left sidebar (260px):** Asset type selector (8 types with icons + prefixes), resolution picker (grid of presets + custom W×H), palette selector (8 built-in palettes with swatch previews), style modifier chips (multi-select), variation count slider (1-6), generation mode toggle (Forge vs Render)
- **Center:** Prompt textarea with example placeholders at top. Large preview area with checkerboard transparency background and `image-rendering: pixelated`. Session history grid below.
- **Collapsible right panel:** Unity import settings reference, naming convention guide, export buttons

### Canvas Rendering

- Render hex grid JSON onto offscreen canvas at exact pixel dimensions
- Scale display with CSS `image-rendering: pixelated`
- Export via `canvas.toDataURL('image/png')`
- Auto-naming: `{type_prefix}{descriptor}_{index}_{width}x{height}.png`

## Phase 2: Backend + AI Generation

### Database (Lovable Cloud)

- **assets** table: id, user_id, name, prompt, asset_type, width, height, palette_id, grid_data (jsonb), image_url, style_modifiers (text[]), generation_mode, created_at
- **palettes** table: id, user_id (nullable for built-ins), name, description, colors (text[]), is_builtin, created_at
- **projects** table: id, user_id, name, description, default_resolution_w/h, default_palette_id, created_at
- RLS: users read/write own rows; built-in palettes readable by all
- Storage bucket: `pixel-assets` with user-scoped paths
- Seed the 8 built-in palettes (Blightborne, Crimson Sanctum, Stonevault, Candlewick, Moonsorrow, Ironblood, Rotwood, Abyssal)

### Edge Function: `generate-pixel-art` (Mode 1 — Forge)

- Uses Lovable AI gateway with `google/gemini-3-flash-preview`
- Sends the full grimdark system prompt with palette, resolution, modifiers, asset type
- Parses hex grid JSON response, strips markdown fences, validates dimensions
- Returns validated grid to frontend
- Handles 429/402 rate limit errors gracefully

### Edge Function: `generate-image-asset` (Mode 2 — Render)

- Uses Lovable AI gateway with `google/gemini-2.5-flash-image`
- Constructs a prompt enforcing pixel art style + dark fantasy aesthetic
- Returns base64 image to frontend
- Client-side post-processing: downscale with nearest-neighbor, quantize to active palette, threshold alpha for transparency removal

### Asset Persistence

- Save generated assets to database with full metadata
- Upload rendered PNGs to Supabase Storage
- Support re-generate and "create variation" from saved assets

## Phase 3: Asset Library & Export

### Asset Library Page

- Grid view of all saved assets with pixelated rendering
- Filter by: asset type, palette, resolution, date range
- Search by prompt text
- Click to expand: full preview, original prompt, metadata, re-generate button, create variation button

### Export Features

- Download single transparent PNG
- Spritesheet: arrange selected assets in configurable grid (columns, padding, transparent/solid background)
- ZIP of multiple PNGs using jszip
- Metadata JSON export for Unity importer scripts
- Bulk select for mass operations

### Status Messages

- Forge-themed: "EXTRACTING PIXELS...", "QUENCHING PALETTE...", "ARTIFACT SAVED TO VAULT."
- Blood-red pulse animation on generate button during loading
- Scanline animation across canvas during generation

&nbsp;

See below for direction on the color scheme and pallette.  
  
How to use this doc

Use one palette at a time. Copy the “Prompt snippet” into your image generator prompt.

If you need consistency across a series:

- Keep **Background**, **Primary**, and **Accent 1** the same
- Only swap **Accent 2** / **Highlight** between variations
- Keep lighting and material notes consistent

---

## Palette format (use this structure in prompts)

- **Background:** (HEX)
- **Primary:** (HEX)
- **Secondary:** (HEX)
- **Accent 1:** (HEX)
- **Accent 2:** (HEX)
- **Highlight:** (HEX)
- **Neutrals:** (2–3 HEX values)
- **Avoid:** (colors to avoid)
- **Materials + lighting notes:**

---

## Palette 0: Riftdivers “Shattered Reality” (canonical UI / tactical ledger)

This palette is pulled directly from the Riftdivers UI direction. Use this as the default for UI-forward, corporate, cold, accusatory visuals.

- **Background:** #000000 (Obsidian Black, use ~85% opacity if layering)
- **Primary:** #FFFFFF (Pure White)
- **Secondary:** #1A1A1A (Muted dark grey)
- **Accent 1:** #7C4DFF (Electric Violet)
- **Accent 2:** #FFFFFF (keep secondary accents minimal)
- **Highlight:** #FFFFFF (use sparingly)
- **Neutrals:** #0A0A0A, #111111, #2A2A2A
- **Avoid:** warm creams, soft pastels, “friendly” brand colors, low contrast greys
- **Materials + lighting notes:** crisp UI glow, sharp edges, minimal texture, high legibility, subtle glitch/shatter effects, high contrast

**Prompt snippet:**

Color palette: background #000000, primary #FFFFFF, secondary #1A1A1A, accent #7C4DFF. Cold, corporate, tactical ledger UI. High legibility, high contrast. Limit palette to these colors.

---

## Palette 1: Rift Dawn (secondary exploration, premium but still restrained)

Use when you want “premium” without losing the Riftdivers seriousness. Keep accents muted.

- **Background:** #F6F4EF (warm off-white)
- **Primary:** #1F2A44 (deep navy)
- **Secondary:** #2F6F7E (deep teal)
- **Accent 1:** #C86B4A (burnt coral)
- **Accent 2:** #D6B25E (muted gold)
- **Highlight:** #EAF2FF (cool glow tint)
- **Neutrals:** #111827, #6B7280, #D1D5DB
- **Avoid:** neon hues, overly saturated purples
- **Materials + lighting notes:** matte ceramics, brushed metal accents, soft morning light, gentle bloom, low noise

**Prompt snippet:**

Color palette: background #F6F4EF, primary #1F2A44, secondary #2F6F7E, accents #C86B4A and #D6B25E, highlight #EAF2FF, neutrals #111827 #6B7280 #D1D5DB. Premium, restrained, still serious.

---

## Palette 2: Rift Night Ops (secondary exploration, cinematic tactical)

Closest to the canonical mood, but with more “scene” lighting options.

- **Background:** #0B1020 (near-black navy)
- **Primary:** #D9E2F2 (cool off-white)
- **Secondary:** #3A4C7A (steel indigo)
- **Accent 1:** #FF4D2E (signal orange-red)
- **Accent 2:** #00B3A4 (electric teal)
- **Highlight:** #9BB7FF (cold rim light)
- **Neutrals:** #0F172A, #334155, #94A3B8
- **Avoid:** warm beige backgrounds, pastel palettes
- **Materials + lighting notes:** hard surfaces, carbon fiber, glossy glass UI, rim lighting, volumetric haze, high contrast

**Prompt snippet:**

Color palette: background #0B1020, primary #D9E2F2, secondary #3A4C7A, accents #FF4D2E and #00B3A4, highlight #9BB7FF, neutrals #0F172A #334155 #94A3B8. Cinematic, tactical, high contrast.

---

## Palette 3: Rift Bio-Analog (secondary exploration, grounded “natural tech”)

Use sparingly for locations, factions, or contrast moments. Keep it controlled so it still feels like Riftdivers.

- **Background:** #F2EFE7 (bone)
- **Primary:** #20312B (deep forest)
- **Secondary:** #4D6B57 (sage)
- **Accent 1:** #B85C38 (clay)
- **Accent 2:** #2C7DA0 (river blue)
- **Highlight:** #E6FFFA (soft mint glow)
- **Neutrals:** #1F2937, #737373, #E5E7EB
- **Avoid:** candy colors, heavy saturation, playful palettes
- **Materials + lighting notes:** organic textures, linen, wood grain, recycled plastics, diffused daylight, soft shadows

**Prompt snippet:**

Color palette: background #F2EFE7, primary #20312B, secondary #4D6B57, accents #B85C38 and #2C7DA0, highlight #E6FFFA, neutrals #1F2937 #737373 #E5E7EB. Earthy, grounded, natural-tech.

---

## Palette 4: Shattered Reality Variant (canonical colors, modern UI accents)

This stays faithful to the canonical hex values, but gives you optional “support” neutrals for UI depth.

- **Background:** #000000
- **Primary:** #FFFFFF
- **Secondary:** #1A1A1A
- **Accent 1:** #7C4DFF
- **Accent 2:** #2A2A2A
- **Highlight:** #FFFFFF
- **Neutrals:** #0A0A0A, #111111, #2A2A2A
- **Avoid:** warm tones, low-contrast greys
- **Materials + lighting notes:** crisp UI glow, clean edges, minimal noise, high clarity, subtle glitch edges

**Prompt snippet:**

Color palette: background #000000, primary #FFFFFF, secondary #1A1A1A, accent #7C4DFF, neutrals #0A0A0A #111111 #2A2A2A. Tactical UI, high legibility. Limit palette to specified HEX colors.

---

## Consistency controls (optional add-ons)

Use these as extra lines in prompts when you need repeatable output:

- “Limit palette to the specified HEX colors, no additional hues.”
- “Keep saturation moderate, avoid oversaturation.”
- “Use a single dominant accent color; keep other accents subtle.”
- “Match white balance to (cool / neutral / warm) and keep consistent.”
- “Maintain consistent contrast curve and shadow density.”

## Accessibility / readability notes (for text-over-image)

- Keep background at least 2–3 steps lighter/darker than text
- Prefer one accent for CTAs, not multiple accents competing
- Avoid placing small text on detailed textures