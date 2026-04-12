UPDATE sprite_assets
SET
  asset_key = 'mod_' || asset_key,
  unity_path = regexp_replace(unity_path, '/([^/]+)$', '/mod_\1')
WHERE category = 'ui_chrome'
  AND qa_status = 'pending'
  AND asset_key NOT LIKE 'mod_%';