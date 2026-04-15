

# Fix: Per-Frame Pipeline Output Still Producing Monolithic Sheets

## What's Wrong

The uploaded `unit_artilleryengineer.png` proves the generation is **still producing a single multi-row spritesheet** instead of 10 individual frame PNGs. The metadata shows `320×32` (a leftover stub) and the background is solid `#0C0C14`.

This means either:
1. This asset was generated **before** the per-frame edge function was deployed, OR
2. The `frame_count` or `tier` didn't match the animated path (`isAnimated` check on line 427 requires `frame_count > 1 AND tier in [unit, vfx]`)

## Root Causes to Fix

| Issue | Cause | Fix |
|-------|-------|-----|
| Monolithic sheet output | Asset may have been generated before deploy, or fell through to the non-animated path | Reset and regenerate after confirming deploy is live |
| `320×32` in metadata | `sprite_specs.ts` has wrong `targetW/targetH` for this asset, or the export uses spec values instead of actual dimensions | Fix the spec entry for `unit_artilleryengineer` and audit all unit specs |
| Solid `#0C0C14` background | The non-animated prompt path still had solid background language for units (now fixed in per-frame path) | Already fixed in per-frame prompts; regeneration will resolve |
| 9 frames instead of 10 | AI sometimes drops the last frame | Add a retry/validation step that checks frame count before finalizing manifest |

## Plan

### 1. Verify edge function deployment is current
- Check edge function logs to confirm the per-frame path was actually used for this asset (look for `"per_frame_async"` log lines)

### 2. Add frame-count validation in `batch-generate/index.ts`
- After generating all frames, verify `frameUrls.length === frameCount`
- If a frame failed or is missing, retry that specific frame (up to 2 retries)
- Only write the manifest if all frames are present

### 3. Fix sprite spec dimensions
- Audit `sprite_specs.ts` entries for all 10-frame units to ensure `targetW` and `targetH` are correct (should be `128×128` per cell, not `320×32`)
- The export metadata pulls from these specs, so fixing the source fixes the metadata

### 4. Reset and regenerate
- Reset `unit_artilleryengineer` (and any other units still showing old monolithic output) to `pending`
- Regenerate using the deployed per-frame pipeline

### 5. Post-generation QA enhancement in `BatchQueuePage.tsx`
- When previewing a manifest asset, show a warning badge if `frame_count` in manifest doesn't match expected `frame_count` from the spec
- Show image dimensions next to each frame thumbnail so you can spot wrong sizes immediately

