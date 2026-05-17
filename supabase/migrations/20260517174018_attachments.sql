-- attachments: ref pro Supabase Storage com metadata.
-- Bucket privado; path prefixado com operation_id/ (Inv. 11).

-- ============================================================================
-- BUCKET
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STORAGE POLICIES (RLS já habilitado pelo Supabase no schema storage)
-- ============================================================================
DROP POLICY IF EXISTS storage_attachments_authenticated_read ON storage.objects;
CREATE POLICY storage_attachments_authenticated_read
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'attachments');

DROP POLICY IF EXISTS storage_attachments_authenticated_insert ON storage.objects;
CREATE POLICY storage_attachments_authenticated_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attachments');

DROP POLICY IF EXISTS storage_attachments_authenticated_delete ON storage.objects;
CREATE POLICY storage_attachments_authenticated_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'attachments');

-- Sem UPDATE: substituir = delete + upload novo.

-- ============================================================================
-- TABLE attachments
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL,
  meeting_id uuid,
  storage_path text NOT NULL,
  filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  description text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_attachments_operation_id
    FOREIGN KEY (operation_id) REFERENCES public.operations(id) ON DELETE CASCADE,
  CONSTRAINT fk_attachments_meeting_id
    FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE SET NULL,
  CONSTRAINT fk_attachments_uploaded_by
    FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT chk_attachments_size_range
    CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  CONSTRAINT chk_attachments_path_prefix
    CHECK (storage_path LIKE operation_id::text || '/%')
);

CREATE INDEX IF NOT EXISTS idx_attachments_operation_created
  ON public.attachments (operation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_attachments_meeting_created
  ON public.attachments (meeting_id, created_at DESC)
  WHERE meeting_id IS NOT NULL;

COMMENT ON TABLE public.attachments IS
  'attachment: ref pro Supabase Storage. Path prefixado com operation_id/ (Inv. 11). Meeting_id opcional pra ata/slides.';

-- ============================================================================
-- TRIGGER updated_at
-- ============================================================================
DROP TRIGGER IF EXISTS set_attachments_updated_at ON public.attachments;
CREATE TRIGGER set_attachments_updated_at
  BEFORE UPDATE ON public.attachments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS attachments_authenticated_full ON public.attachments;
CREATE POLICY attachments_authenticated_full
  ON public.attachments FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
