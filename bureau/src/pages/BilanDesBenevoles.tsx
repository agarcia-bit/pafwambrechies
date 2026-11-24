import { useState } from 'react';

import type { PageProps } from '../App';
import { chargerLeBilan, periodesDuBilan, resumeDuBilan, telechargerLeBilan, type LigneDuBilan } from '../bilan';
import { Kpi } from '../components/ui/Kpi';
import { Avatar, Empty, Icon, Skeleton } from '../Icon';
import { formatDay, today, useAsync } from '../lib';

/** Qui a aidé combien de fois : pour l'assemblée générale, ou pour remercier les plus présents. */
export function BilanDesBenevoles(_props: PageProps) {
  const periodes = periodesDuBilan(today());
  const [cle, setCle] = useState(periodes[0].cle);
  const periode = periodes.find((p) => p.cle === cle)!;
  const bilan = useAsync(() => chargerLeBilan(periode), [periode.debut, periode.fin]);
  const lignes = bilan.data ?? [];
  const resume = resumeDuBilan(lignes);

  return (
    <>
      <p className="note small">
        Les créneaux des actions passées. Sans pointage le jour J, une inscription compte comme tenue ; un absent pointé ne compte pas.
      </p>
      <div className="toolbar">
        <div className="chips">
          {periodes.map((p) => (
            <button key={p.cle} className={p.cle === cle ? 'chip on' : 'chip'} onClick={() => setCle(p.cle)}>{p.libelle}</button>
          ))}
        </div>
        <button className="push ghost" disabled={!lignes.length} onClick={() => telechargerLeBilan(periode, lignes)}>
          <Icon name="download" size={15} /> Exporter en CSV
        </button>
      </div>
      {bilan.error ? <p className="note small">Le bilan n’est pas encore disponible (script <code>presences_benevoles.sql</code> à appliquer).</p>
        : bilan.loading && !bilan.data ? <div className="card"><Skeleton lines={6} /></div>
        : (
          <>
            <div className="kpis">
              <Kpi valeur={resume.benevoles} libelle="bénévoles" ton="brand" />
              <Kpi valeur={resume.creneaux} libelle="créneaux tenus" ton="ok" />
              <Kpi valeur={resume.absences} libelle="absences pointées" ton={resume.absences ? 'warn' : undefined} />
            </div>
            <TableauDuBilan lignes={lignes} />
          </>
        )}
    </>
  );
}

function TableauDuBilan({ lignes }: { lignes: LigneDuBilan[] }) {
  if (!lignes.length) return <Empty icon="users" title="Aucun bénévole sur cette période" />;
  return (
    <div className="card flush">
      <table>
        <thead>
          <tr><th>Bénévole</th><th>Créneaux tenus</th><th>Actions</th><th>Absences</th><th>Dernière fois</th></tr>
        </thead>
        <tbody>
          {lignes.map((l) => (
            <tr key={l.cle}>
              <td><span className="who"><Avatar name={l.nom} />{l.nom}{!l.a_compte && <span className="muted small"> · sans l’app</span>}</span></td>
              <td><strong>{l.creneaux}</strong></td>
              <td>{l.actions}</td>
              <td>{l.absences ? <span className="badge warn">{l.absences}</span> : <span className="muted">—</span>}</td>
              <td className="muted">{l.derniere ? formatDay(l.derniere) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
