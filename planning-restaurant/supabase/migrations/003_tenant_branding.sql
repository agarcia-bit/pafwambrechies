-- ============================================================
-- TENANT BRANDING - personnalisation interface (nom + logo)
-- ============================================================
-- Ajoute une colonne logo_url au tenant et crée le bucket Storage
-- pour stocker les logos des restaurants.
-- Chemin fichier attendu : {tenant_id}/{filename}

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

COMMENT ON COLUMN tenants.logo_url IS
  'URL publique du logo du restaurant (Supabase Storage bucket tenant-logos).';

-- Bucket Storage public pour les logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-logos', 'tenant-logos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: lecture publique, écriture uniquement par membres du tenant
DROP POLICY IF EXISTS "tenant_logos_read" ON storage.objects;
CREATE POLICY "tenant_logos_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'tenant-logos');

DROP POLICY IF EXISTS "tenant_logos_write" ON storage.objects;
CREATE POLICY "tenant_logos_write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'tenant-logos'
    AND auth.uid() IN (
      SELECT id FROM profiles WHERE tenant_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "tenant_logos_update" ON storage.objects;
CREATE POLICY "tenant_logos_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'tenant-logos'
    AND auth.uid() IN (
      SELECT id FROM profiles WHERE tenant_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "tenant_logos_delete" ON storage.objects;
CREATE POLICY "tenant_logos_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'tenant-logos'
    AND auth.uid() IN (
      SELECT id FROM profiles WHERE tenant_id::text = (storage.foldername(name))[1]
    )
  );
