import { useState } from 'react';

import type { PageProps } from '../App';
import { Compose } from '../Compose';
import { Avatar, Empty, Icon, Skeleton } from '../Icon';
import { formatRelative, fullName, hashParam, supabase, toast, useAsync, type Recipient, type Role } from '../lib';

type Member = { id: string; email: string | null; prenom: string | null; nom: string | null; role: Role };
type Invite = { email: string; prenom: string | null; nom: string | null; created_at: string; user_id: string | null; joined_at: string | null };
const ROLE_LABELS: Record<Role, string> = { adherent: 'Adhérent', bureau: 'Bureau', admin: 'Administrateur' };
const ROLE_ORDER: Record<Role, number> = { admin: 0, bureau: 1, adherent: 2 };

/** Les adhérents : qui a un compte et avec quel rôle, et comment les autres rejoignent l'app (code d'accès, invitations). */
export function Adherents({ profile, association }: PageProps) {
  const isAdmin = profile.role === 'admin';
  const members = useAsync(async () => {
    const { data, error } = await supabase.from('profiles').select('id, email, prenom, nom, role');
    if (error) throw error;
    return (data as Member[]).sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || fullName(a).localeCompare(fullName(b), 'fr'));
  }, []);
  const invites = useAsync(async () => {
    const { data, error } = await supabase.from('adherents_invites').select('email, prenom, nom, created_at, user_id, joined_at').order('created_at', { ascending: false });
    if (error) throw error;
    return data as Invite[];
  }, []);
  const code = useAsync(async () => { const { data } = await supabase.rpc('get_signup_code'); return (data as string | null) || null; }, []);
  const [compose, setCompose] = useState<Recipient[] | null>(null);
  // #adherents?onglet=acces ouvre directement l'accès à l'app (lien de la vue d'ensemble).
  const [tab, setTab] = useState<'roles' | 'acces'>(() => (hashParam('onglet') === 'acces' ? 'acces' : 'roles'));
  // Un nouvel adhérent entre deux imports : ajouté à la liste comme un import, puis invité aussitôt.
  const [newOne, setNewOne] = useState({ prenom: '', nom: '', email: '' });
  const [adding, setAdding] = useState(false);
  async function addOne(e: React.FormEvent) {
    e.preventDefault();
    const email = newOne.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast('Adresse e-mail invalide', 'error');
    setAdding(true);
    const { data, error } = await supabase.rpc('importer_adherents', { p_rows: [{ prenom: newOne.prenom.trim(), nom: newOne.nom.trim(), email, valide_jusqu: '' }] });
    setAdding(false);
    if (error) return toast(error.message, 'error');
    const r = data as { invites: number; deja_inscrits: number };
    setNewOne({ prenom: '', nom: '', email: '' });
    invites.reload();
    if (r.deja_inscrits && !r.invites) return toast('Cette personne a déjà un compte dans l’app');
    toast('Adhérent ajouté');
    setCompose([{ email }]);
  }

  async function setRole(m: Member, role: Role) {
    if (m.role === role) return;
    if (role !== 'admin' && m.role === 'admin' && !confirm(`Retirer les droits d’administration de ${fullName(m)} ?`)) return;
    const { error } = await supabase.rpc('set_member_role', { p_member: m.id, p_role: role });
    if (error) return toast(error.message.includes('forbidden') || error.code === '42501' ? 'Réservé aux administrateurs.' : error.message, 'error');
    toast(`${fullName(m)} : ${ROLE_LABELS[role]}`);
    members.reload();
  }

  const waiting = (invites.data ?? []).filter((i) => !i.user_id);
  const invitation = (c: string | null) => ({
    subject: `Rejoignez ${association} sur Allianceo`,
    body: ['Bonjour,', '', `${association} utilise l’application Allianceo pour partager ses actus, son agenda et ses offres.`, '',
      '1. Installez l’application Allianceo sur votre téléphone.',
      c ? `2. Touchez « Créer un compte » et saisissez le code d’accès : ${c}` : '2. Touchez « Créer un compte » et saisissez le code d’accès que le bureau vous a communiqué.',
      '3. Utilisez l’adresse e-mail où vous recevez ce message : votre adhésion sera retrouvée automatiquement.', '', 'À bientôt !'].join('\n'),
  });

  const registered = members.data ?? [];
  const bureau = registered.filter((m) => m.role !== 'adherent');

  return (
    <>
      <div className="kpis">
        <Kpi value={registered.length + waiting.length} label="adhérents" />
        <Kpi value={registered.length} label="inscrits sur l’app" tone="ok" />
        <Kpi value={waiting.length} label={waiting.length > 1 ? 'pas encore inscrits' : 'pas encore inscrit'} tone={waiting.length ? 'warn' : 'ok'} />
        <Kpi value={bureau.length} label="membres du bureau" tone="brand" />
      </div>

      <div className="toolbar">
        <div className="chips">
          <button className={tab === 'roles' ? 'chip on' : 'chip'} onClick={() => setTab('roles')}>Inscrits et rôles ({registered.length})</button>
          <button className={tab === 'acces' ? 'chip on' : 'chip'} onClick={() => setTab('acces')}>Accès à l’app{waiting.length ? ` (${waiting.length} en attente)` : ''}</button>
        </div>
        <a className="push button" href="#message"><Icon name="mail" size={15} /> Envoyer un message</a>
      </div>

      <div className="tab-pane" key={tab}>
      {tab === 'roles' && (
        members.loading && !members.data ? <div className="card"><Skeleton lines={6} /></div>
        : members.error ? <p className="error">{members.error}</p>
        : (
          <>
            {!isAdmin && <p className="note small">Seuls les administrateurs peuvent changer les rôles. Vous voyez la liste en lecture.</p>}
            <div className="card flush">
              <table>
                <thead><tr><th>Adhérent</th><th>E-mail</th><th>Rôle</th></tr></thead>
                <tbody>
                  {members.data!.map((m) => (
                    <tr key={m.id}>
                      <td><span className="who"><Avatar name={fullName(m)} />{fullName(m)}{m.id === profile.id && <span className="pill brand">moi</span>}</span></td>
                      <td className="muted">{m.email}</td>
                      <td>
                        {isAdmin && m.id !== profile.id
                          ? <select className={'status ' + (m.role === 'admin' ? 'bad' : m.role === 'bureau' ? 'info' : 'neutral')} value={m.role} onChange={(e) => setRole(m, e.target.value as Role)} aria-label={`Rôle de ${fullName(m)}`}>
                              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                            </select>
                          : <span className={'badge ' + (m.role === 'admin' ? 'bad' : m.role === 'bureau' ? 'info' : 'neutral')}>{ROLE_LABELS[m.role]}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted small">Adhérent : l’application seulement. Bureau : en plus, cet espace et les contenus. Administrateur : en plus, les rôles et les réglages de l’association. Les cotisations se gèrent dans l’onglet <a href="#cotisations">Cotisations</a>.</p>
          </>
        )
      )}

      {tab === 'acces' && (
        <>
          <section className="card">
            <div className="head">
              <div>
                <h2>Code d’accès</h2>
                <span className="muted small">Les adhérents le saisissent en créant leur compte dans l’app.</span>
              </div>
              {code.data ? <code className="code">{code.data}</code> : <span className="badge warn">Aucun code</span>}
            </div>
            <p className="muted small">{code.data ? 'Un administrateur peut le changer dans les réglages.' : 'Sans code, personne ne peut s’inscrire : un administrateur en définit un dans les réglages.'}</p>
          </section>
          <section className="card">
            <div className="head">
              <div>
                <h2>Pas encore inscrits</h2>
                <span className="muted small">{waiting.length} adhérent{waiting.length > 1 ? 's' : ''} sans compte dans l’app. Ajoutez un nouvel adhérent ci-dessous, ou une liste depuis « Importer ».</span>
              </div>
              {waiting.length > 0 && <button onClick={() => setCompose(waiting.map((i) => ({ email: i.email })))}><Icon name="mail" size={15} /> Inviter tout le monde</button>}
            </div>
            <form className="add-one" onSubmit={addOne}>
              <input type="text" placeholder="Prénom" value={newOne.prenom} onChange={(e) => setNewOne({ ...newOne, prenom: e.target.value })} />
              <input type="text" placeholder="Nom" value={newOne.nom} onChange={(e) => setNewOne({ ...newOne, nom: e.target.value })} />
              <input type="email" placeholder="E-mail" required value={newOne.email} onChange={(e) => setNewOne({ ...newOne, email: e.target.value })} />
              <button className="primary" type="submit" disabled={adding}><Icon name="plus" size={15} /> {adding ? 'Ajout…' : 'Ajouter et inviter'}</button>
            </form>
            {invites.loading && !invites.data ? <Skeleton lines={3} /> : !waiting.length ? <Empty icon="check" title="Tout le monde est inscrit" hint="Importez d’autres adhérents depuis « Importer »." /> : (
              <ul className="plain compact names">
                {waiting.map((i) => <li key={i.email} className="invite-row"><span>{fullName(i)}{i.prenom || i.nom ? <span className="muted"> · {i.email}</span> : null}<span className="muted small"> · ajouté {formatRelative(i.created_at)}</span></span><button className="ghost" onClick={() => setCompose([{ email: i.email }])}><Icon name="mail" size={14} /> Inviter</button></li>)}
              </ul>
            )}
          </section>
        </>
      )}
      </div>
      {compose && <Compose to={compose} subject={invitation(code.data ?? null).subject} body={invitation(code.data ?? null).body} onClose={() => setCompose(null)} />}
    </>
  );
}

function Kpi({ value, label, tone }: { value: number; label: string; tone?: string }) {
  return <div className={'kpi ' + (tone ?? '')}><strong>{value}</strong><span>{label}</span></div>;
}
