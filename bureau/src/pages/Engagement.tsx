import { useState } from 'react';

import type { PageProps } from '../App';
import { Kpi } from '../components/ui/Kpi';
import {
  calculerNote, chargerEngagement, classerEngagement, compterParStatut, completerSemaines, PERIODE_JOURS, STATUTS,
  type Engagement as Donnees, type MembreEngagement, type Statut,
} from '../engagement';
import { Avatar, Empty, Skeleton } from '../Icon';
import { formatDay, fullName, useAsync } from '../lib';
import { BarreDeNote, FicheEngagement } from './FicheEngagement';

const NOMBRE_SEMAINES = 12;
const infoStatut = (cle: Statut) => STATUTS.find((s) => s.cle === cle)!;

/** Qui ouvre l'app, lit, réagit et propose : pour savoir avec qui reprendre contact. */
export function Engagement(_props: PageProps) {
  const engagement = useAsync(chargerEngagement, []);
  const [filtre, setFiltre] = useState<Statut | 'tous'>('tous');

  if (engagement.loading && !engagement.data) return <div className="card"><Skeleton lines={6} /></div>;
  if (engagement.error) return <p className="note small">L’engagement n’est pas encore disponible (script <code>engagement.sql</code> à appliquer).</p>;
  const donnees = engagement.data!;
  const comptes = compterParStatut(donnees.membres);

  return (
    <>
      <DebutDuSuivi debut={donnees.debut} />
      <div className="kpis">
        {STATUTS.map((s) => <Kpi key={s.cle} valeur={comptes[s.cle]} libelle={s.libelle.toLowerCase()} ton={s.ton} />)}
      </div>
      <GraphiqueSemaines semaines={completerSemaines(donnees.semaines, NOMBRE_SEMAINES)} total={donnees.membres.length} />
      <div className="toolbar">
        <div className="chips">
          <button className={filtre === 'tous' ? 'chip on' : 'chip'} onClick={() => setFiltre('tous')}>Tous ({donnees.membres.length})</button>
          {STATUTS.map((s) => (
            <button key={s.cle} className={filtre === s.cle ? 'chip on' : 'chip'} onClick={() => setFiltre(s.cle)} title={s.aide}>{s.libelle} ({comptes[s.cle]})</button>
          ))}
        </div>
      </div>
      <div className="tab-pane" key={filtre}>
        <TableauMembres donnees={donnees} filtre={filtre} />
      </div>
    </>
  );
}

function DebutDuSuivi({ debut }: { debut: string | null }) {
  return (
    <p className="note small">
      {debut
        ? <>Visites et lectures suivies depuis le {formatDay(debut)}. Chiffres des {PERIODE_JOURS} derniers jours, visibles par le bureau uniquement.</>
        : <>Le suivi des visites et des lectures commence avec la mise à jour de l’app : les premiers chiffres arriveront dès les prochaines ouvertures. Likes, commentaires, réponses et propositions sont déjà comptés.</>}
    </p>
  );
}

function GraphiqueSemaines({ semaines, total }: { semaines: { semaine: string; actifs: number }[]; total: number }) {
  const maximum = Math.max(1, total, ...semaines.map((s) => s.actifs));
  return (
    <section className="card">
      <div className="head">
        <div><h2>Adhérents venus chaque semaine</h2><span className="muted small">Au moins une ouverture de l’app dans la semaine</span></div>
      </div>
      <div className="semaines" role="img" aria-label="Nombre d’adhérents venus chaque semaine">
        {semaines.map((s) => (
          <div key={s.semaine} className="semaine" title={`Semaine du ${formatDay(s.semaine)} : ${s.actifs}`}>
            <span className="semaine-nombre">{s.actifs || ''}</span>
            <span className="semaine-barre" style={{ height: `${(s.actifs / maximum) * 100}%` }} />
            <span className="semaine-date">{new Date(s.semaine + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function TableauMembres({ donnees, filtre }: { donnees: Donnees; filtre: Statut | 'tous' }) {
  const [ouvert, setOuvert] = useState<MembreEngagement | null>(null);
  // De la meilleure note à la plus basse : les derniers sont ceux avec qui reprendre contact.
  const lignes = donnees.membres
    .map((membre) => ({ membre, statut: classerEngagement(membre), note: calculerNote(membre, donnees.actus_publiees).note }))
    .filter((ligne) => filtre === 'tous' || ligne.statut === filtre)
    .sort((a, b) => b.note - a.note || fullName(a.membre).localeCompare(fullName(b.membre), 'fr'));
  if (!lignes.length) return <Empty icon="users" title="Personne dans cette catégorie" />;
  return (
    <div className="card flush engagement-tableau">
      <table>
        <thead>
          <tr><th>Adhérent</th><th>Note</th><th>Statut</th><th>Dernière visite</th></tr>
        </thead>
        <tbody>
          {lignes.map(({ membre, statut, note }) => <LigneMembre key={membre.id} membre={membre} statut={statut} note={note} onOuvrir={() => setOuvert(membre)} />)}
        </tbody>
      </table>
      {ouvert && <FicheEngagement membre={ouvert} actusPubliees={donnees.actus_publiees} onClose={() => setOuvert(null)} />}
    </div>
  );
}

function LigneMembre({ membre, statut, note, onOuvrir }: { membre: MembreEngagement; statut: Statut; note: number; onOuvrir: () => void }) {
  const info = infoStatut(statut);
  return (
    <tr className="ligne-cliquable" tabIndex={0} onClick={onOuvrir} onKeyDown={(e) => e.key === 'Enter' && onOuvrir()} title="Voir le détail">
      <td><span className="who"><Avatar name={fullName(membre)} />{fullName(membre)}</span></td>
      <td><BarreDeNote note={note} /></td>
      <td><span className={'badge ' + info.ton} title={info.aide}>{info.libelle}</span></td>
      <td className="muted">{membre.derniere_visite ? formatDay(membre.derniere_visite) : '—'}</td>
    </tr>
  );
}
