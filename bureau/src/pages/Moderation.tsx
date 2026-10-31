import { useState } from 'react';

import { Empty, Icon, Skeleton } from '../Icon';
import { formatRelative, supabase, toast, useAsync } from '../lib';

type Kind = 'actus_commentaire' | 'idee' | 'idee_commentaire' | 'offre' | 'annuaire';
const KIND_LABELS: Record<Kind, string> = { actus_commentaire: 'Commentaire sur une actu', idee_commentaire: 'Commentaire sur une idée', idee: 'Idée', offre: 'Offre', annuaire: 'Fiche annuaire' };
const KIND_TABLES: Record<Kind, string> = { actus_commentaire: 'actus_commentaires', idee_commentaire: 'idees_commentaires', idee: 'idees', offre: 'offres', annuaire: 'annuaire' };
type Report = { id: number; kind: Kind; target_id: number; reason: string; created_at: string; reporter_nom: string | null; contenu: string | null; auteur_id: string | null; auteur_nom: string | null };
type Idee = { id: number; titre: string | null; texte: string; categorie: string; prenom: string | null; created_at: string; visible: boolean };

/** Signalements des adhérents (obligatoire pour l'App Store) et boîte à idées. */
export function Moderation() {
  const reports = useAsync(async () => { const { data, error } = await supabase.rpc('signalements_a_traiter'); if (error) throw error; return data as Report[]; }, []);
  const idees = useAsync(async () => {
    const { data, error } = await supabase.from('idees').select('id, titre, texte, categorie, prenom, created_at, visible').order('created_at', { ascending: false });
    if (error) throw error;
    return data as Idee[];
  }, []);
  const [tab, setTab] = useState<'signalements' | 'idees'>('signalements');

  async function handle(r: Report, remove: boolean) {
    if (remove && !confirm('Supprimer ce contenu définitivement ?')) return;
    if (remove) {
      const { error } = await supabase.from(KIND_TABLES[r.kind]).delete().eq('id', r.target_id);
      if (error) return toast(error.message, 'error');
    }
    const { error } = await supabase.from('signalements').update({ traite: true }).eq('id', r.id);
    if (error) return toast(error.message, 'error');
    toast(remove ? 'Contenu supprimé' : 'Signalement classé');
    reports.reload();
    idees.reload();
  }
  async function removeIdee(i: Idee) {
    if (!confirm('Supprimer cette idée ?')) return;
    const { error } = await supabase.from('idees').delete().eq('id', i.id);
    if (error) return toast(error.message, 'error');
    toast('Idée supprimée');
    idees.reload();
  }

  const pending = reports.data?.length ?? 0;
  return (
    <>
      <div className="toolbar">
        <div className="chips">
          <button className={tab === 'signalements' ? 'chip on' : 'chip'} onClick={() => setTab('signalements')}>Signalements{pending ? ` (${pending})` : ''}</button>
          <button className={tab === 'idees' ? 'chip on' : 'chip'} onClick={() => setTab('idees')}>Boîte à idées ({idees.data?.length ?? 0})</button>
        </div>
      </div>

      {tab === 'signalements' && (
        reports.loading && !reports.data ? <div className="card"><Skeleton lines={4} /></div>
        : reports.error ? <p className="error">{reports.error}</p>
        : !pending ? <Empty icon="check" title="Rien à traiter" hint="Les contenus signalés par les adhérents apparaîtront ici." />
        : reports.data!.map((r) => (
          <section key={r.id} className="card">
            <div className="head">
              <div>
                <span className="pill warn">{KIND_LABELS[r.kind]}</span>
                <span className="muted small"> signalé {formatRelative(r.created_at)}{r.reporter_nom ? ` par ${r.reporter_nom}` : ''} · {r.reason}</span>
              </div>
              <div className="btn-group">
                <button onClick={() => handle(r, false)}>Garder</button>
                <button className="danger" onClick={() => handle(r, true)}><Icon name="trash" size={15} /> Supprimer le contenu</button>
              </div>
            </div>
            <blockquote className="quote">{r.contenu ?? <i className="muted">Contenu déjà supprimé</i>}{r.auteur_nom && <footer className="muted small">— {r.auteur_nom}</footer>}</blockquote>
          </section>
        ))
      )}

      {tab === 'idees' && (
        idees.loading && !idees.data ? <div className="card"><Skeleton lines={4} /></div>
        : idees.error ? <p className="error">{idees.error}</p>
        : !idees.data!.length ? <Empty icon="sparkle" title="Aucune idée pour l’instant" hint="Les adhérents proposent leurs idées depuis l’application." />
        : (
          <div className="card flush">
            <ul className="items">
              {idees.data!.map((i) => (
                <li key={i.id} className="item static">
                  <div className="grow">
                    <strong>{i.titre || i.texte.slice(0, 80)}</strong>
                    <div className="muted small">{i.categorie} · {i.prenom || 'Anonyme'} · {formatRelative(i.created_at)}</div>
                    {i.titre && <p className="small pre" style={{ margin: '6px 0 0' }}>{i.texte}</p>}
                  </div>
                  <button className="icon-btn danger" onClick={() => removeIdee(i)} aria-label="Supprimer" title="Supprimer"><Icon name="trash" /></button>
                </li>
              ))}
            </ul>
          </div>
        )
      )}
    </>
  );
}
