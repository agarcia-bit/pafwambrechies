-- ============================================================
-- Likes et commentaires sur les actus
-- À exécuter dans l'éditeur SQL Supabase
-- ============================================================

-- 1. Table des likes
CREATE TABLE IF NOT EXISTS public.actus_likes (
  id         bigserial PRIMARY KEY,
  actu_id    bigint NOT NULL REFERENCES public.actus(id) ON DELETE CASCADE,
  user_id    uuid   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (actu_id, user_id)
);
ALTER TABLE public.actus_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lecture likes actus"  ON public.actus_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Like actu authentifié"         ON public.actus_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Unlike actu authentifié"       ON public.actus_likes FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 2. Table des commentaires
CREATE TABLE IF NOT EXISTS public.actus_commentaires (
  id         bigserial PRIMARY KEY,
  actu_id    bigint NOT NULL REFERENCES public.actus(id) ON DELETE CASCADE,
  user_id    uuid   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prenom     text,
  texte      text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.actus_commentaires ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lecture commentaires actus"  ON public.actus_commentaires FOR SELECT TO authenticated USING (true);
CREATE POLICY "Commenter actu authentifié"           ON public.actus_commentaires FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Supprimer son commentaire actu"       ON public.actus_commentaires FOR DELETE TO authenticated USING (user_id = auth.uid());
