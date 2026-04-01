-- ============================================================
-- Photos annuaire – À exécuter dans l'éditeur SQL Supabase
-- ============================================================

-- 1. Ajouter les colonnes à la table annuaire
ALTER TABLE public.annuaire ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.annuaire ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.annuaire ADD COLUMN IF NOT EXISTS linkedin text;
ALTER TABLE public.annuaire ADD COLUMN IF NOT EXISTS instagram text;

-- 2. Politique de lecture publique sur le bucket (à créer d'abord via Dashboard)
-- Storage → New bucket → nom : "annuaire-photos" → cocher "Public bucket"
-- Puis exécuter :

INSERT INTO storage.buckets (id, name, public)
VALUES ('annuaire-photos', 'annuaire-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Permettre aux admins d'uploader
CREATE POLICY "Admins peuvent uploader des photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'annuaire-photos'
  AND public.is_admin()
);

-- 4. Lecture publique des photos
CREATE POLICY "Lecture publique des photos annuaire"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'annuaire-photos');
