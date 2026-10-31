import type { PageProps } from '../App';
import { Empty, Skeleton } from '../Icon';
import { formatRelative, fullName, supabase, useAsync, type BureauMember } from '../lib';

// Plan Resend en cours (Pro) : limites partagées par toutes les associations, null = pas de limite.
// À mettre à jour en changeant de plan.
const QUOTA: { jour: number | null; mois: number } = { jour: null, mois: 50000 };

type Stat = { tenant_id: string; association: string; aujourd_hui: number; ce_mois: number; mois_precedent: number; total: number };
type Envoi = { id: number; sujet: string; nb: number; created_at: string; envoye_par: string | null; envoi_destinataires: { statut: string }[] };

/** Les e-mails envoyés depuis l'espace bureau : historique de l'association et compteurs.
 *  Le propriétaire de la plateforme voit en plus la consommation de chaque association. */
export function Envois({ profile }: PageProps) {
  const stats = useAsync(async () => {
    const { data, error } = await supabase.rpc('envois_stats');
    if (error) throw error;
    return (data as Stat[]).map((s) => ({ ...s, aujourd_hui: Number(s.aujourd_hui), ce_mois: Number(s.ce_mois), mois_precedent: Number(s.mois_precedent), total: Number(s.total) }));
  }, []);
  const history = useAsync(async () => {
    const [e, m] = await Promise.all([
      supabase.from('envois').select('id, sujet, nb, created_at, envoye_par, envoi_destinataires(statut)').order('created_at', { ascending: false }).limit(100),
      supabase.rpc('bureau_members'),
    ]);
    if (e.error) throw e.error;
    return { envois: e.data as unknown as Envoi[], members: (m.data ?? []) as BureauMember[] };
  }, []);

  const all = stats.data ?? [];
  const mine = all.find((s) => s.tenant_id === profile.tenant_id);
  const platform = all.length > 1 || (all.length === 1 && !mine);
  const sum = (k: keyof Omit<Stat, 'tenant_id' | 'association'>) => all.reduce((s, x) => s + x[k], 0);
  const authorOf = (id: string | null) => { const m = history.data?.members.find((x) => x.id === id); return m ? fullName(m) : 'Ancien membre'; };

  return (
    <>
      {stats.error && <p className="note small">Les compteurs ne sont pas encore disponibles (script <code>envois_stats.sql</code> à appliquer).</p>}
      {mine && (
        <div className="kpis">
          <Kpi value={mine.aujourd_hui} label="aujourd’hui" />
          <Kpi value={mine.ce_mois} label="ce mois-ci" tone="brand" />
          <Kpi value={mine.mois_precedent} label="le mois dernier" />
          <Kpi value={mine.total} label="depuis le début" />
        </div>
      )}

      {platform && (
        <section className="card">
          <div className="head">
            <div>
              <h2>Toutes les associations</h2>
              <span className="muted small">Visible par le propriétaire de la plateforme uniquement. Limites du plan Resend actuel, partagées par toutes : {QUOTA.jour ? `${QUOTA.jour} par jour, ` : ''}{QUOTA.mois.toLocaleString('fr-FR')} par mois.</span>
            </div>
          </div>
          {QUOTA.jour && <Gauge label="Aujourd’hui" value={sum('aujourd_hui')} max={QUOTA.jour} />}
          <Gauge label="Ce mois-ci" value={sum('ce_mois')} max={QUOTA.mois} />
          <table style={{ marginTop: 14 }}>
            <thead><tr><th>Association</th><th className="num">Aujourd’hui</th><th className="num">Ce mois</th><th className="num">Mois dernier</th><th className="num">Total</th></tr></thead>
            <tbody>
              {all.map((s) => (
                <tr key={s.tenant_id}>
                  <td><span className="who">{s.association}{s.tenant_id === profile.tenant_id && <span className="pill brand">la mienne</span>}</span></td>
                  <td className="num">{s.aujourd_hui}</td><td className="num"><strong>{s.ce_mois}</strong></td><td className="num">{s.mois_precedent}</td><td className="num muted">{s.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="card flush">
        <div className="head" style={{ padding: '14px 18px 0' }}><h2>Historique</h2></div>
        {history.loading && !history.data ? <div style={{ padding: 18 }}><Skeleton lines={4} /></div>
          : history.error ? <p className="error" style={{ padding: 18 }}>{history.error}</p>
          : !history.data!.envois.length ? <Empty icon="mail" title="Aucun e-mail envoyé" hint="Les messages envoyés depuis « Écrire » ou « Relancer » apparaîtront ici." />
          : (
            <ul className="items">
              {history.data!.envois.map((e) => {
                const echecs = e.envoi_destinataires.filter((d) => d.statut === 'echec').length;
                return (
                  <li key={e.id} className="item static">
                    <div className="grow">
                      <strong>{e.sujet}</strong>
                      <div className="muted small">{authorOf(e.envoye_par)} · {formatRelative(e.created_at)}</div>
                    </div>
                    <span className="pill ok">{e.nb} envoyé{e.nb > 1 ? 's' : ''}</span>
                    {echecs > 0 && <span className="pill bad">{echecs} en échec</span>}
                  </li>
                );
              })}
            </ul>
          )}
      </section>
    </>
  );
}

function Kpi({ value, label, tone }: { value: number; label: string; tone?: string }) {
  return <div className={'kpi ' + (tone ?? '')}><strong>{value.toLocaleString('fr-FR')}</strong><span>{label}</span></div>;
}

function Gauge({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="gauge">
      <span className="small">{label}</span>
      <div className="poll-bar"><span style={{ width: `${pct}%`, background: pct >= 90 ? 'var(--bad)' : pct >= 70 ? 'var(--warn)' : undefined }} /></div>
      <span className="small muted num">{value.toLocaleString('fr-FR')} / {max.toLocaleString('fr-FR')}</span>
    </div>
  );
}
