import { chargerAttentesDeReponse } from './attentes-de-reponse';
import { chargerFichesResumees } from './collegues';
import { chargerEngagement } from './engagement';
import { chargerFonctions, loadBureau, loadCotisConfig, loadLastSends, loadMembers, loadTenantConfig, prechargerDansLeCache } from './lib';
import { chargerCodeDAcces, chargerInscrits, chargerInvitations } from './pages/Adherents';
import { chargerFichesAnnuaire, chargerGroupesEnvoi } from './pages/useDestinataires';

// À l'ouverture du bureau, les données des onglets principaux se chargent en arrière-plan : le
// premier passage sur chacun s'affiche aussitôt au lieu d'attendre la base (un quart de seconde par
// demande, plusieurs demandes par onglet).
const CHARGEMENTS: (() => Promise<unknown>)[] = [
  loadMembers, loadBureau, loadCotisConfig, loadLastSends, loadTenantConfig, chargerFonctions,
  chargerEngagement, chargerInscrits, chargerInvitations, chargerCodeDAcces,
  chargerFichesAnnuaire, chargerGroupesEnvoi, chargerAttentesDeReponse, chargerFichesResumees,
];

/** Lancé une fois, juste après l'affichage de la première page, pour ne pas la ralentir. */
export function prechargerLesOnglets() {
  return Promise.all(CHARGEMENTS.map((charger) => prechargerDansLeCache(charger)));
}
