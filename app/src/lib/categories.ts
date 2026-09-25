// Same lists as the PAF web app (values are stored as-is in the database).

export const ACTU_CATEGORIES = ['Tous', 'Actu Asso', 'Infos pratiques', 'Événement', 'Membres'] as const;
export const ACTU_HUES: Record<string, string> = {
  'Actu Asso': '#4F46E5',
  'Infos pratiques': '#059669',
  'Événement': '#EA580C',
  Partenaire: '#9333EA',
  Membres: '#DB2777',
};

export const ANNUAIRE_CATEGORIES = ['Tous', 'Commerçant', 'Restauration', 'Services'] as const;

export const OFFRE_CATEGORIES = ['Tous', 'Particulier', 'Professionnel'] as const;

export const IDEE_CATEGORIES = [
  'Réseautage',
  'Animations & Événements',
  "Fonctionnement de l'asso",
  'Autre',
] as const;
