import { useEffect, useState } from 'react';

import { prechargerLesOnglets } from './prechargement';

// Au premier affichage du bureau, plutôt qu'un outil qui « rame » d'onglet en onglet : un court
// écran de préparation, le temps de tout charger une fois. Au-delà de quelques secondes (réseau
// lent), on entre quand même : les onglets finiront de charger d'eux-mêmes.
const ATTENTE_MAXIMUM_MS = 8000;
let dejaPrepare = false;

export function useEspacePrepare(profilCharge: boolean) {
  const [pret, setPret] = useState(dejaPrepare);
  const [avancement, setAvancement] = useState(0);
  useEffect(() => {
    if (!profilCharge || dejaPrepare) return;
    const terminer = () => { dejaPrepare = true; setPret(true); };
    const minuteur = setTimeout(terminer, ATTENTE_MAXIMUM_MS);
    prechargerLesOnglets((faits, total) => setAvancement(faits / total)).then(terminer);
    return () => clearTimeout(minuteur);
  }, [profilCharge]);
  return { pret, avancement };
}

export function EcranDePreparation({ association, logo, avancement }: { association: string; logo: string | null; avancement: number }) {
  return (
    <div className="center ecran-preparation" role="status" aria-live="polite">
      {logo ? <img src={logo} alt="" className="preparation-logo" /> : <div className="preparation-logo vide">{association.slice(0, 1)}</div>}
      <strong>{association}</strong>
      <span className="muted small">Préparation de votre espace…</span>
      <div className="preparation-piste"><span style={{ width: `${Math.max(8, Math.round(avancement * 100))}%` }} /></div>
    </div>
  );
}
