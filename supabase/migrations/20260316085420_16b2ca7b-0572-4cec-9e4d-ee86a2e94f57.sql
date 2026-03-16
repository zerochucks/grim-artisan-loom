CREATE TABLE public.style_recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  modifiers TEXT[] NOT NULL DEFAULT '{}',
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.style_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own recipes" ON public.style_recipes FOR SELECT USING (auth.uid() = user_id OR is_builtin = true);
CREATE POLICY "Users can create own recipes" ON public.style_recipes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recipes" ON public.style_recipes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own recipes" ON public.style_recipes FOR DELETE USING (auth.uid() = user_id);