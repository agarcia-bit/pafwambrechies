import { useEffect, useRef, useState } from 'react';

import { besoinDuCreneau, estDejaPrisALHeure, libelleDeTranche, type Pole } from '../creneaux';
import { Avatar, Icon } from '../Icon';
import type { Inscrit, PlanningEtat } from './usePlanning';

export type Creneau = { pole: Pole; heure: string; planning: PlanningEtat; moi: string };

/**
 * Une case de la grille : qui vient, puis une case en pointillés par personne manquante. Un clic
 * sur une place libre ouvre, sur place, le choix « Je viens » ou « Ajouter quelqu'un ».
 */
export function CaseDuCreneau({ pole, heure, planning, moi }: Creneau) {
  const [estOuvert, setEstOuvert] = useState(false);
  const besoin = besoinDuCreneau(pole, heure);
  const inscrits = planning.inscrits.filter((i) => i.pole_id === pole.id && i.debut === heure);
  const libres = Math.max(0, besoin - inscrits.length);
  return (
    <div className="case-creneau">
      <div className="case-gens">
        {inscrits.map((inscrit) => <Personne key={inscrit.id} inscrit={inscrit} estMoi={inscrit.membre === moi} planning={planning} />)}
        {Array.from({ length: libres }, (_, rang) => (
          <button key={rang} className={'siege' + (estOuvert && rang === 0 ? ' actif' : '')} aria-haspopup="dialog"
            aria-label={`Place libre, ${pole.nom}, ${libelleDeTranche(heure, planning.horaires?.dureeMinutes ?? 60)}`}
            onClick={() => setEstOuvert(true)}>+ Place libre</button>
        ))}
      </div>
      {besoin === 0 && <span className="case-etat muted">Pas besoin</span>}
      {besoin > 0 && !libres && <span className="case-etat rempli"><Icon name="check" size={13} /> Complet</span>}
      {estOuvert && <ChoixDUnePlace pole={pole} heure={heure} planning={planning} moi={moi} onFermer={() => setEstOuvert(false)} />}
    </div>
  );
}

function Personne({ inscrit, estMoi, planning }: { inscrit: Inscrit; estMoi: boolean; planning: PlanningEtat }) {
  function retirer() {
    if (estMoi) {
      if (confirm('Vous ne pouvez plus venir sur ce créneau ? La place redeviendra libre.')) planning.jeMeRetire(inscrit);
    } else if (confirm(`Retirer ${inscrit.nom} de ce créneau ?`)) planning.retirerInscrit(inscrit);
  }
  return (
    <span className={'qui' + (estMoi ? ' moi' : '')} title={inscrit.a_compte ? 'Inscrit depuis l’app ou l’espace bureau' : 'Ajouté à la main'}>
      <span aria-hidden="true"><Avatar name={inscrit.nom} size={24} /></span>
      {estMoi ? 'Vous' : inscrit.nom}
      <button className="qui-retirer" onClick={retirer} aria-label={estMoi ? 'Je ne peux plus venir sur ce créneau' : `Retirer ${inscrit.nom}`}><Icon name="x" size={12} /></button>
    </span>
  );
}

/**
 * Le petit panneau d'une place libre, posé sur la case : il rappelle le pôle et l'heure, propose
 * « Je viens » (sauf si l'on tient déjà un poste à cette heure-là), l'ajout d'un nom et le nombre
 * de places. Échap ou un clic à côté le ferment, sans fermer le reste de la page.
 */
export function ChoixDUnePlace({ pole, heure, planning, moi, onFermer }: Creneau & { onFermer: () => void }) {
  const [nom, setNom] = useState('');
  const panneau = useRef<HTMLDivElement>(null);
  const besoin = besoinDuCreneau(pole, heure);
  const dejaPris = estDejaPrisALHeure(planning.inscrits, moi, heure);
  useEffect(() => {
    const siDehors = (evenement: MouseEvent) => { if (!panneau.current?.contains(evenement.target as Node)) onFermer(); };
    document.addEventListener('mousedown', siDehors);
    return () => document.removeEventListener('mousedown', siDehors);
  }, [onFermer]);
  function ajouter() {
    if (!nom.trim()) return;
    planning.ajouterUnNom(pole, heure, nom);
    onFermer();
  }
  return (
    <div ref={panneau} className="choix-place" role="dialog" aria-label={`${pole.nom}, ${libelleDeTranche(heure, planning.horaires?.dureeMinutes ?? 60)}`}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onFermer(); } }}>
      <div className="choix-titre">{pole.nom} <span>· {libelleDeTranche(heure, planning.horaires?.dureeMinutes ?? 60)}</span></div>
      {dejaPris
        ? <p className="small muted">Vous tenez déjà un poste à cette heure-là.</p>
        : <button className="primary choix-venir" autoFocus onClick={() => { planning.jeViens(pole, heure, moi); onFermer(); }}>Je viens</button>}
      <label className="choix-ajout">
        <span className="small muted">Ajouter quelqu’un sans l’app</span>
        <span className="choix-ligne">
          <input value={nom} placeholder="Prénom Nom" autoFocus={dejaPris} onChange={(e) => setNom(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ajouter()} />
          <button disabled={!nom.trim()} onClick={ajouter}>Ajouter</button>
        </span>
      </label>
      <div className="choix-ligne choix-places">
        <span className="small muted">Places sur ce créneau</span>
        <span className="choix-compteur">
          <button className="icon-btn" disabled={besoin === 0} onClick={() => planning.changerBesoin(pole, heure, besoin - 1)} aria-label="Une place de moins">−</button>
          <b>{besoin}</b>
          <button className="icon-btn" disabled={besoin >= 50} onClick={() => planning.changerBesoin(pole, heure, besoin + 1)} aria-label="Une place de plus">+</button>
        </span>
      </div>
    </div>
  );
}
