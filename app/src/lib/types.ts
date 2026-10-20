export type Role = 'adherent' | 'bureau' | 'admin';

export type Profile = {
  id: string;
  email: string | null;
  prenom: string | null;
  nom: string | null;
  role: Role;
  tenant_id: string;
};

// Returned by get_my_branding() and resolve_signup_code().
export type Branding = {
  slug: string;
  name: string;
  tenant_name?: string;
  tenant_tagline?: string;
  tenant_primary_color?: string;
  tenant_secondary_color?: string;
  tenant_logo_url?: string;
  tenant_login_bg_url?: string;
  // Per-association configuration, see supabase/tenant_app_config.sql.
  module_annuaire?: string;
  module_offres?: string;
  module_agenda?: string;
  module_idees?: string;
  module_liens?: string;
  label_annuaire?: string;
  label_offres?: string;
  label_nom?: string;
  annuaire_categories?: string;
  offres_categories?: string;
};

export type Count = { count: number }[];

/** The member's own like, embedded with a filter on user_id: empty when not liked. */
export type MyLike = { user_id: string }[];

export type Actu = {
  id: number;
  titre: string;
  date: string;
  created_at: string;
  categorie: string;
  excerpt: string | null;
  contenu: string | null;
  image_url: string | null;
  /** Day of the event the actu announces (not its publication day), if any. */
  date_evenement: string | null;
  /** Bureau member or admin who published it (null for older posts). */
  auteur_id: string | null;
  actus_likes: Count;
  actus_commentaires: Count;
  my_like: MyLike;
};

export type Commentaire = {
  id: number;
  user_id: string;
  prenom: string | null;
  texte: string;
  created_at: string;
};

export type Commercant = {
  id: number;
  nom_entreprise: string;
  prenom_contact: string | null;
  nom_contact: string | null;
  categorie: string;
  adresse: string | null;
  telephone: string | null;
  email: string | null;
  linkedin: string | null;
  instagram: string | null;
  description: string | null;
  photo_url: string | null;
};

export type Offre = {
  id: number;
  commercant: string;
  titre: string;
  description: string | null;
  expiration: string | null;
  tag: string | null;
  categorie: string | null;
};

export type Evenement = {
  id: number;
  titre: string;
  date: string;
  heure: string | null;
  lieu: string | null;
  description: string | null;
};

export type Idee = {
  id: number;
  user_id: string;
  prenom: string | null;
  categorie: string;
  titre: string | null;
  texte: string;
  created_at: string;
  idees_likes: Count;
  idees_commentaires: Count;
  my_like: MyLike;
};

export type Lien = {
  id: number;
  titre: string;
  url: string;
  description: string | null;
};
