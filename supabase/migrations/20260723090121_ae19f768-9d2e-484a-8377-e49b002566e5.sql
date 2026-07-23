
-- 1) Related resources table
CREATE TABLE public.related_resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('url','item')),
  target_item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
  url TEXT,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.related_resources TO authenticated;
GRANT ALL ON public.related_resources TO service_role;

ALTER TABLE public.related_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own related_resources" ON public.related_resources
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX related_resources_item_idx ON public.related_resources(item_id);

-- 2) Manual thumbnail override on items
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS manual_thumbnail_url TEXT;
