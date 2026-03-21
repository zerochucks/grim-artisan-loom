
UPDATE sprite_assets SET prompt_template = 
'pixel art SINGLE HORIZONTAL STRIP sprite sheet. CRITICAL LAYOUT: exactly 10 frames in ONE ROW left-to-right, NO multiple rows, NO scattered placement. Each frame in a uniform 32x32 cell. Strip is 320x32 total. Frame order: Idle1, Walk1, Walk2, Walk3, AttackWindup, AttackSwing, AttackRecover, HitStagger, DeathFall, DeadFlat. Warden class — grimdark frontline tank/breach-guard. Kite shield left hand, hand axe right, full plate armor muted steel, dark red surcoat, visor-down helmet. Root-pin feet to pixel row 30-31 in EVERY frame. DeadFlat frame must fit within 32x32 cell (compress horizontally). Dark background #0C0C14, 1px dark outline, hard pixel edges, no anti-aliasing, no alpha bleed.',
qa_status = 'pending', approved = false, storage_url = NULL
WHERE asset_key = 'unit_warden';

UPDATE sprite_assets SET prompt_template = 
'pixel art SINGLE HORIZONTAL STRIP sprite sheet. CRITICAL LAYOUT: exactly 10 frames in ONE ROW left-to-right, NO multiple rows, NO scattered placement. Each frame in a uniform 32x32 cell. Strip is 320x32 total. Frame order: Idle1, Walk1, Walk2, Walk3, AttackWindup, AttackSwing, AttackRecover, HitStagger, DeathFall, DeadFlat. Fighter class — heavy melee warrior, longsword, chainmail armor, sturdy build. Root-pin feet to pixel row 30-31 in EVERY frame. DeadFlat frame must fit within 32x32 cell. Dark background #0C0C14, 1px dark outline, hard pixel edges, no anti-aliasing, no alpha bleed.',
qa_status = 'pending', approved = false, storage_url = NULL
WHERE asset_key = 'unit_fighter';

UPDATE sprite_assets SET prompt_template = 
'pixel art SINGLE HORIZONTAL STRIP sprite sheet. CRITICAL LAYOUT: exactly 10 frames in ONE ROW left-to-right, NO multiple rows, NO scattered placement. Each frame in a uniform 32x32 cell. Strip is 320x32 total. Frame order: Idle1, Walk1, Walk2, Walk3, AttackWindup, AttackSwing, AttackRecover, HitStagger, DeathFall, DeadFlat. Rogue class — agile assassin, dual daggers, dark leather armor, hood. Root-pin feet to pixel row 30-31 in EVERY frame. DeadFlat frame must fit within 32x32 cell. Dark background #0C0C14, 1px dark outline, hard pixel edges, no anti-aliasing, no alpha bleed.',
qa_status = 'pending', approved = false, storage_url = NULL
WHERE asset_key = 'unit_rogue';

UPDATE sprite_assets SET prompt_template = 
'pixel art SINGLE HORIZONTAL STRIP sprite sheet. CRITICAL LAYOUT: exactly 10 frames in ONE ROW left-to-right, NO multiple rows, NO scattered placement. Each frame in a uniform 32x32 cell. Strip is 320x32 total. Frame order: Idle1, Walk1, Walk2, Walk3, AttackWindup, AttackSwing, AttackRecover, HitStagger, DeathFall, DeadFlat. Ranger class — bow-wielding scout, shortbow, leather bracers, forest cloak. Root-pin feet to pixel row 30-31 in EVERY frame. DeadFlat frame must fit within 32x32 cell. Dark background #0C0C14, 1px dark outline, hard pixel edges, no anti-aliasing, no alpha bleed.',
qa_status = 'pending', approved = false, storage_url = NULL
WHERE asset_key = 'unit_ranger';

UPDATE sprite_assets SET prompt_template = 
'pixel art SINGLE HORIZONTAL STRIP sprite sheet. CRITICAL LAYOUT: exactly 10 frames in ONE ROW left-to-right, NO multiple rows, NO scattered placement. Each frame in a uniform 32x32 cell. Strip is 320x32 total. Frame order: Idle1, Walk1, Walk2, Walk3, AttackWindup, AttackSwing, AttackRecover, HitStagger, DeathFall, DeadFlat. Mage class — arcane caster, staff, dark robes with glowing rune accents, pointed hat or hood. Root-pin feet to pixel row 30-31 in EVERY frame. DeadFlat frame must fit within 32x32 cell. Dark background #0C0C14, 1px dark outline, hard pixel edges, no anti-aliasing, no alpha bleed.',
qa_status = 'pending', approved = false, storage_url = NULL
WHERE asset_key = 'unit_mage';

UPDATE sprite_assets SET prompt_template = 
'pixel art SINGLE HORIZONTAL STRIP sprite sheet. CRITICAL LAYOUT: exactly 10 frames in ONE ROW left-to-right, NO multiple rows, NO scattered placement. Each frame in a uniform 32x32 cell. Strip is 320x32 total. Frame order: Idle1, Walk1, Walk2, Walk3, AttackWindup, AttackSwing, AttackRecover, HitStagger, DeathFall, DeadFlat. Cleric class — armored healer, mace and holy symbol, medium armor with white/gold tabard. Root-pin feet to pixel row 30-31 in EVERY frame. DeadFlat frame must fit within 32x32 cell. Dark background #0C0C14, 1px dark outline, hard pixel edges, no anti-aliasing, no alpha bleed.',
qa_status = 'pending', approved = false, storage_url = NULL
WHERE asset_key = 'unit_cleric';

UPDATE sprite_assets SET prompt_template = 
'pixel art SINGLE HORIZONTAL STRIP sprite sheet. CRITICAL LAYOUT: exactly 10 frames in ONE ROW left-to-right, NO multiple rows, NO scattered placement. Each frame in a uniform 32x32 cell. Strip is 320x32 total. Frame order: Idle1, Walk1, Walk2, Walk3, AttackWindup, AttackSwing, AttackRecover, HitStagger, DeathFall, DeadFlat. Basic enemy — generic dark rift creature, hunched posture, corrupted armor, glowing red eyes. Root-pin feet to pixel row 30-31 in EVERY frame. DeadFlat frame must fit within 32x32 cell. Dark background #0C0C14, 1px dark outline, hard pixel edges, no anti-aliasing, no alpha bleed.',
qa_status = 'pending', approved = false, storage_url = NULL
WHERE asset_key = 'unit_enemy_basic';

UPDATE sprite_assets SET prompt_template = 
'pixel art SINGLE HORIZONTAL STRIP sprite sheet. CRITICAL LAYOUT: exactly 10 frames in ONE ROW left-to-right, NO multiple rows, NO scattered placement. Each frame in a uniform 48x48 cell. Strip is 480x48 total. Frame order: Idle1, Walk1, Walk2, Walk3, AttackWindup, AttackSwing, AttackRecover, HitStagger, DeathFall, DeadFlat. Boss enemy — massive rift champion, imposing silhouette, heavy corrupted plate armor, glowing weapon, 1.5x size of normal units. Root-pin feet to pixel row 46-47 in EVERY frame. DeadFlat frame must fit within 48x48 cell. Dark background #0C0C14, 1px dark outline, hard pixel edges, no anti-aliasing, no alpha bleed.',
qa_status = 'pending', approved = false, storage_url = NULL
WHERE asset_key = 'unit_enemy_boss';
