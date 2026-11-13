import { Drawer } from '../Drawer';
import { Skeleton } from '../Icon';
import { fullName, loadMembers, supabase, useAsync, type MemberRow } from '../lib';

// Un e-mail de l'historique : son texte tel qu'il est parti, et chacun de ses destinataires.

type Destinataire = { email: string; statut: string };
type EnvoiDetaille = { sujet: string; corps: string; created_at: string; envoi_destinataires: Destinataire[] };

async function chargerEnvoi(id: number): Promise<EnvoiDetaille> {
  const { data, error } = await supabase.from('envois').select('sujet, corps, created_at, envoi_destinataires(email, statut)').eq('id', id).single();
  if (error) throw error;
  return data as EnvoiDetaille;
}

/** « 13 novembre à 17:34 » */
const dateEtHeure = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

/** Le nom de l'adhérent derrière une adresse, sinon l'adresse seule. */
function nomDuDestinataire(email: string, membres: MemberRow[]) {
  const membre = membres.find((m) => m.email?.trim().toLowerCase() === email.trim().toLowerCase());
  return membre ? fullName(membre) : email;
}

export function ApercuEnvoi({ id, auteur, onClose }: { id: number; auteur: string; onClose: () => void }) {
  const envoi = useAsync(() => chargerEnvoi(id), [id]);
  const membres = useAsync(loadMembers, []);
  const destinataires = [...(envoi.data?.envoi_destinataires ?? [])]
    .map((d) => ({ ...d, nom: nomDuDestinataire(d.email, membres.data ?? []) }))
    .sort((a, b) => Number(a.statut !== 'echec') - Number(b.statut !== 'echec') || a.nom.localeCompare(b.nom, 'fr'));

  return (
    <Drawer title={envoi.data?.sujet ?? 'E-mail envoyé'} subtitle={envoi.data ? `${auteur} · ${dateEtHeure(envoi.data.created_at)}` : undefined} onClose={onClose} wide>
      {envoi.loading && !envoi.data ? <Skeleton lines={6} />
        : envoi.error ? <p className="error">{envoi.error}</p>
        : (
          <>
            <h3 className="sect">Le message</h3>
            <div className="apercu-message">{envoi.data!.corps}</div>
            <h3 className="sect">Destinataires ({destinataires.length})</h3>
            <ul className="plain compact">
              {destinataires.map((d) => (
                <li key={d.email}>
                  <span className="grow">{d.nom}{d.nom !== d.email && <span className="muted small"> · {d.email}</span>}</span>
                  <span className={'pill ' + (d.statut === 'echec' ? 'bad' : 'ok')}>{d.statut === 'echec' ? 'Échec' : 'Envoyé'}</span>
                </li>
              ))}
            </ul>
          </>
        )}
    </Drawer>
  );
}
