

## Bulk Prompt Upgrade for Pending Assets

### The Gap

Your well-written prompts (e.g. `gear_armor_heavy`, `compass_voidadjacent`, your divider example) follow a structured format:
1. **Opening line**: `Pixel art [tier type] ([subject]), [WxH], [background].` with a brief description
2. **Design section**: Bullet-pointed visual specifics (shape, details, accents)
3. **Rendering rules**: Hard pixel edges, outline, contrast tiers, alpha bleed rules
4. **Palette guidance**: Specific material colors and accent placement
5. **Negative prompts**: Explicit "no text, no watermark..." list

~500 pending assets have prompts ranging from one-liners ("Red tint overlay, semi-transparent") to vague descriptions missing rendering rules. The worst offenders by category:

| Category | Count | Avg prompt length | Quality |
|----------|-------|-------------------|---------|
| slot | 6 | 109 chars | Very weak |
| tile | 28 | 79 chars | Very weak |
| status | 30 | 130 chars | Weak |
| ui (icon) | 14 | 105 chars | Weak |
| node | 12+7 | 119 chars | Weak |
| gear (32px weapons) | ~20 | ~130 chars | Moderate |
| relic (32px) | ~26 | ~130 chars | Weak |
| gear (64px weapons) | ~36 | ~160 chars | Moderate - missing rendering rules |
| relic (64px) | ~26 | ~180 chars | Moderate - missing rendering rules |
| creature portraits | 28 | ~133 chars | Weak |
| vfx | 16 | mixed | Some good, some weak |

### Approach

Run an AI-powered batch script that:

1. **Fetches all pending assets** from the database
2. **Filters to assets needing upgrade** (prompt length < 400 chars or missing key phrases like "rendering rules", "hard pixel edges", "Design:")
3. **Sends each to Gemini** with a system prompt containing:
   - The tier-specific template (pixel header for icons/tiles/ui/vfx/nodes, ink header for portraits/backgrounds)
   - 3 examples of your best prompts as few-shot references
   - The asset's metadata (tier, category, dimensions, asset_key, primary_color)
   - Instructions to expand the existing description into the full structured format without changing the subject matter
4. **Updates `prompt_template`** in the database via SQL inserts batched in groups

The script will output a CSV of all changes to `/mnt/documents/` for your review before committing, or optionally commit directly.

### Template Categories (tier × category routing)

Each asset gets routed to the correct template skeleton:

- **icon/gear 32px**: Pixel art gear icon format (like `gear_armor_heavy`)
- **icon/gear 64px**: Pixel art gear icon format scaled for 64px readability
- **icon/status 16px**: Pixel art status effect micro-icon format
- **icon/slot 48px**: Pixel art equipment slot silhouette format
- **icon/relic 32px/64px**: Pixel art void relic icon format
- **tile 16-64px**: Pixel art tileable game tile format (flat top-down, tileable edges)
- **node 24-48px**: Pixel art node icon format (bold shape, 3-value shading)
- **ui**: Pixel art UI element format (9-slice friendly)
- **vfx**: Pixel art VFX spritesheet format (chunky shapes, timing beats)
- **portrait/creature**: Ink-and-gold creature portrait format
- **portrait/character**: Already mostly well-written, skip if >350 chars
- **marketing**: Ink-and-gold illustration format

### Implementation Steps

1. **Create the rewrite script** (`/tmp/rewrite_prompts.py`) using the AI gateway skill
2. **Generate rewrites** — AI expands each prompt into the structured format, preserving the original subject/description
3. **Output review CSV** to `/mnt/documents/prompt_upgrades.csv` with columns: `asset_key, tier, category, old_prompt, new_prompt`
4. **After your approval**, run an update script that writes the new prompts to the database via the edge function or direct SQL

### What Won't Change

- Assets already at `approved`/`generated`/`rejected` status — untouched
- Assets with prompts already >400 chars and containing "Design:" or "Rendering rules:" — skipped
- The subject matter of each prompt — only the structure/format is upgraded
- The backend prompt assembly in `batch-generate` (brand header, tier rules, QA checks are already prepended server-side)

