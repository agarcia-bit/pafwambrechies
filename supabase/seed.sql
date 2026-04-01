-- ============================================================
-- PAF Wambrechies – Seed data
-- Run after schema.sql
-- ============================================================

-- ── Actus ─────────────────────────────────────────────────────────────────
insert into public.actus (titre, date, categorie, excerpt, contenu) values
(
  'Braderie de printemps 2026',
  '2026-04-12',
  'Événement',
  'La grande braderie printanière revient le 12 avril sur la Grand-Place ! Plus de 50 exposants attendus.',
  'La braderie de printemps se tiendra le samedi 12 avril de 9 h à 18 h sur la Grand-Place de Wambrechies. Plus de 50 commerçants et artisans seront présents. Au programme : animations musicales en plein air, jeux pour enfants, dégustation de produits locaux et vide-grenier. Venez profiter de cette journée festive avec toute la famille !'
),
(
  'Nouveau parking gratuit rue de la Lys',
  '2026-03-20',
  'Infos pratiques',
  'La mairie a inauguré 40 nouvelles places de stationnement gratuites à deux pas du centre-ville.',
  'Bonne nouvelle pour les commerçants et leurs clients : un nouveau parking gratuit de 40 places a été ouvert rue de la Lys, à moins de 100 mètres de la Grand-Place. Il est accessible 7j/7, 24h/24. Cette initiative fait suite aux demandes répétées de la PAF auprès de la municipalité. Merci à tous les adhérents qui ont soutenu cette démarche !'
),
(
  'Résultats du concours vitrine de Pâques',
  '2026-03-28',
  'Concours',
  'Le jury a délibéré ! Découvrez les trois lauréats du concours de décoration de vitrine.',
  'Le concours de décoration de vitrine sur le thème de Pâques a réuni 18 participants cette année, un record ! Après délibération du jury citoyen, les lauréats sont : 1er prix – Boulangerie Artisanale Leroy ; 2e prix – Fleuriste Les Jardins de Flandre ; 3e prix – Librairie Au Fil des Pages. Félicitations à tous les participants pour leur créativité !'
),
(
  'Compte-rendu de la réunion PAF – mars 2026',
  '2026-03-15',
  'Association',
  'Retour sur les décisions prises lors de la réunion mensuelle : budget événements, communication digitale et agenda.',
  'La réunion mensuelle du bureau PAF du 15 mars a réuni 24 adhérents. Points abordés : validation du budget pour la braderie (5 500 €), lancement de la newsletter mensuelle numérique, discussion sur l''organisation du marché nocturne d''avril, et présentation de la nouvelle application mobile pour les adhérents. La prochaine réunion aura lieu le 19 avril à 19 h à la salle des associations.'
),
(
  'Bienvenue à nos 3 nouveaux adhérents !',
  '2026-03-05',
  'Association',
  'La PAF accueille trois nouveaux commerçants wambrechiens en ce début de printemps.',
  'La PAF est heureuse d''accueillir trois nouveaux membres : La Crêperie du Moulin (rue du Château), le Cabinet de Kinésithérapie Duplessis (allée des Flandres) et le Salon de Thé Chez Léonie (Grand-Place). Ils bénéficieront dès maintenant de tous les avantages de l''adhésion. N''hésitez pas à leur souhaiter la bienvenue !'
);

-- ── Annuaire ──────────────────────────────────────────────────────────────
insert into public.annuaire (nom, categorie, adresse, telephone, description) values
(
  'Boulangerie Artisanale Leroy',
  'Alimentation',
  '3 Grand-Place, Wambrechies',
  '03 20 68 12 45',
  'Pains spéciaux, viennoiseries et pâtisseries faites maison. Ouvert du mardi au dimanche.'
),
(
  'Fleuriste Les Jardins de Flandre',
  'Mode & Maison',
  '17 rue du Château, Wambrechies',
  '03 20 68 34 21',
  'Compositions florales sur mesure, plantes, bouquets de saison et deuil.'
),
(
  'Restaurant La Brasserie du Canal',
  'Restauration',
  '8 quai de la Lys, Wambrechies',
  '03 20 39 55 60',
  'Cuisine traditionnelle du Nord, spécialités flamandes, terrasse au bord du canal.'
),
(
  'Pharmacie Centrale de Wambrechies',
  'Santé',
  '2 Grand-Place, Wambrechies',
  '03 20 68 10 08',
  'Pharmacie de garde, conseils en parapharmacie, vaccinations et tests. Livraison à domicile.'
),
(
  'Coiffure Style & Co',
  'Beauté',
  '11 rue de Marquette, Wambrechies',
  '03 20 68 47 99',
  'Coiffure mixte et enfants, colorations végétales, extensions. Sur rendez-vous et sans rendez-vous.'
),
(
  'Optique Wambrechies',
  'Santé',
  '5 rue de la Lys, Wambrechies',
  '03 20 77 22 14',
  'Lunettes de vue, solaires et lentilles. Bilan de vue gratuit, tiers payant accepté.'
),
(
  'Épicerie Fine du Terroir',
  'Alimentation',
  '14 Grand-Place, Wambrechies',
  '03 20 68 58 03',
  'Produits locaux et régionaux, bières artisanales, fromages affinés, charcuterie de qualité.'
),
(
  'Auto-École du Pont',
  'Services',
  '22 rue du Pont, Wambrechies',
  '03 20 68 31 77',
  'Formation permis B, moto (A1/A2/A), code de la route. Financement CPF accepté.'
),
(
  'Cabinet Médical Dr Martin',
  'Santé',
  '6 allée des Flandres, Wambrechies',
  '03 20 39 44 20',
  'Médecine générale, pédiatrie et suivi grossesse. Téléconsultation disponible.'
),
(
  'Librairie Papeterie Au Fil des Pages',
  'Services',
  '9 Grand-Place, Wambrechies',
  '03 20 68 19 55',
  'Livres, papeterie, presse, jeux de société et cadeaux. Commandes spéciales sous 48 h.'
);

-- ── Offres ────────────────────────────────────────────────────────────────
insert into public.offres (commercant, titre, description, expiration, tag) values
(
  'Boulangerie Artisanale Leroy',
  '–15 % sur toutes les pâtisseries',
  'Présentez votre carte adhérent PAF et bénéficiez de 15 % de réduction sur l''ensemble de la gamme de pâtisseries.',
  '2026-04-30',
  '–15 %'
),
(
  'Fleuriste Les Jardins de Flandre',
  'Un bouquet offert dès 30 € d''achat',
  'Pour tout achat de 30 € ou plus, recevez un bouquet de saison en cadeau. Sur présentation de la carte adhérent.',
  '2026-05-15',
  'Cadeau'
),
(
  'La Brasserie du Canal',
  'Menu du jour à –10 %',
  '10 % de réduction sur le menu du jour du lundi au vendredi, midi uniquement, sur présentation de votre carte PAF.',
  '2026-06-30',
  '–10 %'
),
(
  'Pharmacie Centrale',
  'Bilan minceur offert',
  'Analyse de composition corporelle (poids, IMC, masse graisseuse) offerte pour tout adhérent PAF. Sur rendez-vous.',
  '2026-05-31',
  'Offert'
),
(
  'Coiffure Style & Co',
  'Coupe + brushing à –20 %',
  '20 % de réduction sur la prestation coupe + brushing pour femme ou homme. Valable du lundi au mercredi.',
  '2026-04-30',
  '–20 %'
),
(
  'Optique Wambrechies',
  'Bilan de vue 100 % gratuit',
  'Profitez d''un bilan visuel complet offert, sans engagement d''achat. Prenez rendez-vous en mentionnant votre adhésion PAF.',
  '2026-06-15',
  'Gratuit'
);

-- ── Événements ────────────────────────────────────────────────────────────
insert into public.evenements (titre, date, heure, lieu, description) values
(
  'Braderie de printemps',
  '2026-04-12',
  '09:00 – 18:00',
  'Grand-Place, Wambrechies',
  'Grande braderie annuelle avec exposants, animations et restauration.'
),
(
  'Marché nocturne',
  '2026-04-18',
  '18:00 – 23:00',
  'Place de l''Église, Wambrechies',
  'Marché vespéral, artisanat local, dégustations et musique live.'
),
(
  'Atelier dégustation vins & fromages',
  '2026-04-25',
  '19:30 – 22:00',
  'Épicerie Fine du Terroir',
  'Soirée dégustation organisée par l''Épicerie Fine. Places limitées – inscription obligatoire.'
),
(
  'Fête du Muguet',
  '2026-05-01',
  '10:00 – 13:00',
  'Grand-Place, Wambrechies',
  'Distribution de muguet et petit marché festif pour le 1er mai.'
),
(
  'Journée Portes Ouvertes des commerces',
  '2026-05-10',
  '10:00 – 18:00',
  'Tous les commerces PAF',
  'Les adhérents PAF ouvrent leurs portes et proposent des démonstrations et offres spéciales.'
),
(
  'Concert en plein air',
  '2026-05-17',
  '15:00 – 19:00',
  'Parc du Château, Wambrechies',
  'Concert gratuit de musiques du monde, en partenariat avec la PAF et la mairie.'
),
(
  'Grand Vide-Grenier',
  '2026-05-24',
  '08:00 – 17:00',
  'Parking de la Mairie, Wambrechies',
  'Vide-grenier géant. Inscriptions des exposants ouvertes jusqu''au 17 mai.'
),
(
  'Soirée gastronomique PAF',
  '2026-05-31',
  '19:30 – 23:30',
  'La Brasserie du Canal',
  'Dîner de gala annuel des adhérents PAF. Menu gastronomique 4 services. Réservation obligatoire.'
);
