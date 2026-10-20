// Actu categories are the same for every association (values are stored as-is).
// Directory and offer categories are set per association, see tenant-config.ts.

export const ACTU_CATEGORIES = ['Tous', 'Actu Asso', 'Infos pratiques', 'Événement', 'Membres'] as const;
export const ACTU_HUES: Record<string, string> = {
  'Actu Asso': '#4F46E5',
  'Infos pratiques': '#059669',
  'Événement': '#0891B2',
  Partenaire: '#9333EA',
  Membres: '#DB2777',
};

export const IDEE_CATEGORIES = [
  'Réseautage',
  'Animations & Événements',
  "Fonctionnement de l'asso",
  'Autre',
] as const;
