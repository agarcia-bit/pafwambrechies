import { useState } from 'react';

import { Empty, Icon, Skeleton } from '../Icon';
import { formatRelative, toast, useAsync } from '../lib';
import {
  changerLeStatut, chargerLesRetours, LIBELLES_DES_STATUTS, LIBELLES_DES_TYPES, lienDeLaCapture,
  type Retour, type StatutDeRetour,
} from '../retours';

const FILTRES: { cle: StatutDeRetour | 'tous'; libelle: string }[] = [
  { cle: 'nouveau', libelle: 'Nouveaux' }, { cle: 'en_cours', libelle: 'En cours' }, { cle: 'fait', libelle: 'Faits' }, { cle: 'tous', libelle: 'Tous' },
];

/** Réservée au propriétaire de la plateforme : les bugs et idées envoyés par les membres de toutes les associations. */
export function Retours() {
  const retours = useAsync(chargerLesRetours, []);
  const [filtre, setFiltre] = useState<StatutDeRetour | 'tous'>('nouveau');
  const liste = (retours.data ?? []).filter((retour) => filtre === 'tous' || retour.statut === filtre);
  const combien = (cle: StatutDeRetour | 'tous') => (retours.data ?? []).filter((retour) => cle === 'tous' || retour.statut === cle).length;

  return (
    <>
      <div className="toolbar">
        <div className="chips">
          {FILTRES.map(({ cle, libelle }) => (
            <button key={cle} className={filtre === cle ? 'chip on' : 'chip'} onClick={() => setFiltre(cle)}>{libelle} ({combien(cle)})</button>
          ))}
        </div>
      </div>
      {retours.loading && !retours.data ? <div className="card"><Skeleton lines={4} /></div>
        : retours.error ? <p className="error">{retours.error}</p>
        : !liste.length ? <Empty icon="check" title="Rien ici" hint="Les membres écrivent depuis « Un bug ? Une idée ? », dans l’app ou en bas du menu de l’espace bureau." />
        : liste.map((retour) => <CarteDeRetour key={retour.id} retour={retour} onChange={retours.reload} />)}
    </>
  );
}

function CarteDeRetour({ retour, onChange }: { retour: Retour; onChange: () => void }) {
  async function changer(statut: StatutDeRetour) {
    try { await changerLeStatut(retour.id, statut); onChange(); } catch (err) { toast((err as Error).message, 'error'); }
  }
  async function ouvrirLaCapture() {
    const lien = retour.capture && await lienDeLaCapture(retour.capture);
    if (lien) open(lien, '_blank', 'noopener');
    else toast('Capture introuvable', 'error');
  }
  const appareil = ['support', 'systeme', 'version', 'ecran'].map((cle) => retour.appareil?.[cle]).filter(Boolean).join(' · ');
  return (
    <section className="card carte-retour">
      <div className="head">
        <div>
          <span className={retour.type === 'bug' ? 'pill bad' : 'pill info'}>{LIBELLES_DES_TYPES[retour.type]}</span>
          <strong> {retour.association ?? 'Association inconnue'}</strong>
          <span className="muted small"> · {retour.email ? <a href={`mailto:${retour.email}`}>{retour.auteur ?? retour.email}</a> : retour.auteur ?? 'Membre'} · {formatRelative(retour.created_at)}</span>
        </div>
        <select value={retour.statut} onChange={(e) => changer(e.target.value as StatutDeRetour)} aria-label="Statut">
          {(Object.keys(LIBELLES_DES_STATUTS) as StatutDeRetour[]).map((statut) => <option key={statut} value={statut}>{LIBELLES_DES_STATUTS[statut]}</option>)}
        </select>
      </div>
      <p className="pre">{retour.texte}</p>
      <div className="muted small row">
        {appareil && <span>{appareil}</span>}
        {retour.capture && <button className="link" onClick={ouvrirLaCapture}><Icon name="external" size={14} /> Voir la capture</button>}
      </div>
    </section>
  );
}
