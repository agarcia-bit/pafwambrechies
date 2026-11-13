import { Drawer } from '../Drawer';
import { fullName, loadMembers, useAsync, type MemberRow } from '../lib';
import { etatDOuverture, resumeDesOuvertures, type DestinataireSuivi } from '../ouvertures';

// Un e-mail de l'historique : son texte tel qu'il est parti, et chacun de ses destinataires.

type Destinataire = DestinataireSuivi & { email: string };
/** L'e-mail tel que l'historique l'a déjà chargé : l'aperçu s'ouvre sans nouvelle demande. */
export type EnvoiDetaille = { sujet: string; corps: string; created_at: string; envoi_destinataires: Destinataire[] };

/** « 13 novembre à 17:34 » */
const dateEtHeure = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

/** Le nom de l'adhérent derrière une adresse, sinon l'adresse seule. */
function nomDuDestinataire(email: string, membres: MemberRow[]) {
  const membre = membres.find((m) => m.email?.trim().toLowerCase() === email.trim().toLowerCase());
  return membre ? fullName(membre) : email;
}

export function ApercuEnvoi({ envoi, auteur, onClose }: { envoi: EnvoiDetaille; auteur: string; onClose: () => void }) {
  const membres = useAsync(loadMembers, []);
  const destinataires = [...envoi.envoi_destinataires]
    .map((d) => ({ ...d, nom: nomDuDestinataire(d.email, membres.data ?? []) }))
    .sort((a, b) => Number(a.statut !== 'echec') - Number(b.statut !== 'echec') || a.nom.localeCompare(b.nom, 'fr'));

  return (
    <Drawer title={envoi.sujet} subtitle={`${auteur} · ${dateEtHeure(envoi.created_at)}`} onClose={onClose} wide>
      <h3 className="sect">Le message</h3>
      <div className="apercu-message">{envoi.corps}</div>
      <h3 className="sect">Destinataires ({destinataires.length})</h3>
      <ResumeOuvertures destinataires={destinataires} />
      <ul className="plain compact">
        {destinataires.map((d) => (
          <li key={d.email}>
            <span className="grow">{d.nom}{d.nom !== d.email && <span className="muted small"> · {d.email}</span>}
              {etatDOuverture(d) && <small className={'etat-ouverture' + (d.ouvert_le ? ' ouvert' : '')}>{etatDOuverture(d)}</small>}
            </span>
            <span className={'pill ' + (d.statut === 'echec' ? 'bad' : 'ok')}>{d.statut === 'echec' ? 'Échec' : 'Envoyé'}</span>
          </li>
        ))}
      </ul>
    </Drawer>
  );
}

/** « 18 ouverts sur 42 », ou l'explication quand l'e-mail date d'avant le suivi. */
function ResumeOuvertures({ destinataires }: { destinataires: DestinataireSuivi[] }) {
  const { ouverts, suivis } = resumeDesOuvertures(destinataires);
  if (!suivis) return <p className="muted small">Ouvertures non suivies pour cet e-mail (envoyé avant leur mise en place).</p>;
  return <p className="small"><strong>{ouverts} ouvert{ouverts > 1 ? 's' : ''}</strong> sur {suivis} <span className="muted">· indication approximative (certaines messageries ouvrent les e-mails toutes seules)</span></p>;
}
