
The user wants design spec documents (not a UI feature in the React app) — wireframes + component trees + anchor tables + data binding + interaction specs + responsive rules — for 6 Unity screens, prioritized 1→6. This is a documentation/artifact task, not app development.

Format: one Markdown doc per screen, with an embedded wireframe. Wireframes will be PNG images (dark theme matching the palette) generated programmatically so dimensions are exact. Bundle everything into a downloadable ZIP plus individual files in `/mnt/documents/`.

Approach:
- Generate wireframes with Python + Pillow at 1920×1080 reference, using the canonical palette. Pure rectangles + monospace labels — matches the "ledger / institutional" aesthetic.
- Write 6 markdown spec docs following the exact template the user specified (Summary → Wireframe → Component Tree → Anchor Spec Table → Data Binding Table → Interaction Spec → Responsive Rules).
- Enforce the layout rules: anchor-to-edge clusters for footers, full-width-relative offsets, no center+large-offset anchors, 4px grid, 44px min touch targets, ContentSizeFitter only on scroll Content containers.
- Pull data field names from the existing codebase (`class-system.ts`, `sprite_assets`, `assets`, palette tables) so bindings are realistic, not invented.

Deliverables in `/mnt/documents/rift-divers-ui-specs/`:
1. `01-guild-hall.md` + `01-guild-hall-wireframe.png`
2. `02-ledger.md` + `02-ledger-wireframe.png`
3. `03-world-map.md` + `03-world-map-wireframe.png`
4. `04-merc-sheet.md` + `04-merc-sheet-wireframe.png`
5. `05-guild-base.md` + `05-guild-base-wireframe.png`
6. `06-combat-hud.md` + `06-combat-hud-wireframe.png`
7. `00-shared-tokens.md` — palette hexes, type scale, spacing grid, anchor patterns, ContentSizeFitter rules (referenced by all 6 docs to keep them DRY)
8. `rift-divers-ui-specs.zip` — full bundle

QA: render each wireframe → view as image → check no clipping, all regions labeled, palette correct → fix → re-render.

No code changes to the React app. Pure artifact generation via `code--exec` (Python/Pillow for wireframes, file writes for markdown, zip for bundle).
