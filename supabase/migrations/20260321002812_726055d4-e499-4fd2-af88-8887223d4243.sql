DROP POLICY "Authenticated users can insert sprite_assets" ON public.sprite_assets;
DROP POLICY "Authenticated users can update sprite_assets" ON public.sprite_assets;

-- Add user_id column for ownership
ALTER TABLE public.sprite_assets ADD COLUMN user_id uuid REFERENCES auth.users(id);

-- Update existing seed rows to have no owner (system-level)
-- INSERT scoped to authenticated user
CREATE POLICY "Users can insert own sprite_assets"
ON public.sprite_assets FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- UPDATE scoped to owner
CREATE POLICY "Users can update own sprite_assets"
ON public.sprite_assets FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR user_id IS NULL);