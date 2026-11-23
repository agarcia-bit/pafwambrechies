import { useState } from 'react';

import { libelleDeTranche, minutesDe, tranchesDeLaJournee, type Horaires } from '../creneaux';
import type { PlanningEtat } from './usePlanning';

const TOUS = 'tous';

/**
 * Préparer plus vite : « de 10 h à 14 h, 3 personnes », sur un pôle ou sur tous, au lieu de
 * changer chaque tranche une par une. Revenir au nombre du pôle efface les exceptions.
 */
export function PlusieursCreneaux({ planning, horaires }: { planning: PlanningEtat; horaires: Horaires }) {
  const tranches = tranchesDeLaJournee(horaires);
  const [pole, setPole] = useState(TOUS);
  const [depuis, setDepuis] = useState(tranches[0] ?? '');
  const [jusqua, setJusqua] = useState(tranches.at(-1) ?? '');
  const [besoin, setBesoin] = useState(2);
  const [enCours, setEnCours] = useState(false);
  if (!tranches.length || !planning.poles.length) return null;

  const heures = tranches.filter((h) => minutesDe(h) >= minutesDe(depuis) && minutesDe(h) <= minutesDe(jusqua));
  const poles = pole === TOUS ? planning.poles : planning.poles.filter((p) => String(p.id) === pole);
  const fin = (h: string) => libelleDeTranche(h, horaires.dureeMinutes).split(' – ')[1];
  async function appliquer() {
    setEnCours(true);
    await planning.changerPlusieursBesoins(poles, heures, besoin);
    setEnCours(false);
  }
  return (
    <fieldset className="plusieurs-creneaux">
      <legend>Changer plusieurs créneaux d’un coup</legend>
      <div className="plusieurs-ligne">
        <label>Pôle
          <select value={pole} onChange={(e) => setPole(e.target.value)}>
            <option value={TOUS}>Tous les pôles</option>
            {planning.poles.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
          </select>
        </label>
        <label>De
          <select value={depuis} onChange={(e) => setDepuis(e.target.value)}>
            {tranches.map((h) => <option key={h} value={h}>{libelleDeTranche(h, horaires.dureeMinutes).split(' – ')[0]}</option>)}
          </select>
        </label>
        <label>À
          <select value={jusqua} onChange={(e) => setJusqua(e.target.value)}>
            {tranches.map((h) => <option key={h} value={h}>{fin(h)}</option>)}
          </select>
        </label>
        <label>Personnes
          <input type="number" min={0} max={50} value={besoin} onChange={(e) => setBesoin(Math.max(0, Math.min(50, Number(e.target.value) || 0)))} />
        </label>
      </div>
      <p className="small muted">
        {heures.length ? `${heures.length} tranche${heures.length > 1 ? 's' : ''} × ${poles.length} pôle${poles.length > 1 ? 's' : ''} passeront à ${besoin} personne${besoin > 1 ? 's' : ''}${besoin === 0 ? ' (fermées)' : ''}.` : 'Choisissez une heure de fin après l’heure de début.'}
      </p>
      <button className="primary" disabled={!heures.length || enCours} onClick={appliquer}>{enCours ? 'Enregistrement…' : 'Appliquer'}</button>
    </fieldset>
  );
}
