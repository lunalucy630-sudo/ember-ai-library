CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.items ADD COLUMN IF NOT EXISTS content_hash TEXT;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS embedded_at TIMESTAMPTZ;

ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS ai_managed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS cover_gradient TEXT;
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE TRIGGER collections_updated_at BEFORE UPDATE ON public.collections
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.chat_threads ADD COLUMN IF NOT EXISTS collection_id UUID REFERENCES public.collections(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS chat_threads_collection_idx ON public.chat_threads(collection_id);

CREATE TABLE public.item_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  timestamp_label TEXT,
  section_label TEXT,
  embedding vector(3072) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.item_chunks TO authenticated;
GRANT ALL ON public.item_chunks TO service_role;
ALTER TABLE public.item_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own item_chunks" ON public.item_chunks FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS item_chunks_item_idx ON public.item_chunks(item_id);
CREATE INDEX IF NOT EXISTS item_chunks_embedding_idx
  ON public.item_chunks USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

CREATE TABLE public.organize_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'proposed',
  plan JSONB NOT NULL DEFAULT '[]'::jsonb,
  items_processed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organize_runs TO authenticated;
GRANT ALL ON public.organize_runs TO service_role;
ALTER TABLE public.organize_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own organize_runs" ON public.organize_runs FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER organize_runs_updated_at BEFORE UPDATE ON public.organize_runs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.match_item_chunks(
  query_embedding vector(3072),
  match_count int DEFAULT 12,
  filter_collection_id uuid DEFAULT NULL,
  filter_item_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  item_id uuid,
  content text,
  timestamp_label text,
  section_label text,
  similarity float
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT c.id, c.item_id, c.content, c.timestamp_label, c.section_label,
         1 - (c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) AS similarity
  FROM public.item_chunks c
  WHERE c.user_id = auth.uid()
    AND (filter_item_id IS NULL OR c.item_id = filter_item_id)
    AND (
      filter_collection_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.item_collections ic
        WHERE ic.item_id = c.item_id AND ic.collection_id = filter_collection_id
      )
    )
  ORDER BY c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  LIMIT match_count;
$$;