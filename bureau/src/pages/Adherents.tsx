import { useState } from 'react';

import type { PageProps } from '../App';
import { Compose } from '../Compose';
import { Avatar, Empty, Icon, Skeleton } from '../Icon';
import { formatRelative, fullName, hashParam, supabase, toast, useAsync, type Recipient, type Role } from '../lib';
import { Kpi } from '../components/ui/Kpi';
import { FormulaireNouvelAdherent } from './FormulaireNouvelAdherent';
import { ROLE_LABELS, TableauDesRoles, type MembreInscrit } from './TableauDesRoles';

type Member = MembreInscrit;
type Invite = { email: string; prenom: string | null; nom: string | null; created_at: string; user_id: string | null; joined_at: string | null };
const ROLE_ORDER: Record<Role, number> = { admin: 0, bureau: 1, adherent: 2 };

// Les données de la page, nommées pour être préchargées à l'ouverture du bureau (prechargement.ts).
export async function chargerInscrits(): Promise<Member[]> {
  const { data, error } = await supabase.from('profiles').select('id, email, prenom, nom, role');
  if (error) throw error;
  return (data as Member[]).sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || fullName(a).localeCompare(fullName(b), 'fr'));
}

export async function chargerInvitations(): Promise<Invite[]> {
  const { data, error } = await supabase.from('adherents_invites').select('email, prenom, nom, created_at, user_id, joined_at').order('created_at', { ascending: false });
  if (error) throw error;
  return data as Invite[];
}

export async function chargerCodeDAcces(): Promise<string | null> {
  const { data } = await supabase.rpc('get_signup_code');
  return (data as string | null) || null;
}

/** Les adhérents : qui a un compte et avec quel rôle, et comment les autres rejoignent l'app (code d'accès, invitations). */
export function Adherents({ profile, association }: PageProps) {
  const isAdmin = profile.role === 'admin';
  const members = useAsync(chargerInscrits, []);
  const invites = useAsync(chargerInvitations, []);
  const code = useAsync(chargerCodeDAcces, []);
  const [compose, setCompose] = useState<Recipient[] | null>(null);
  // #adherents?onglet=acces ouvre directement l'accès à l'app (lien de la vue d'ensemble).
  const [tab, setTab] = useState<'roles' | 'acces'>(() => (hashParam('onglet') === 'acces' ? 'acces' : 'roles'));
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
        <Kpi valeur={registered.length + waiting.length} libelle="adhérents" />
        <Kpi valeur={registered.length} libelle="inscrits sur l’app" ton="ok" />
        <Kpi valeur={waiting.length} libelle={waiting.length > 1 ? 'pas encore inscrits' : 'pas encore inscrit'} ton={waiting.length ? 'warn' : 'ok'} />
        <Kpi valeur={bureau.length} libelle="membres du bureau" ton="brand" />
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
            <TableauDesRoles membres={members.data!} moi={profile.id} estAdmin={isAdmin} onChangerRole={setRole} />
            <p className="muted small">La fonction (Président, Trésorier…) s’affiche à côté du nom dans l’espace bureau ; tapez-la puis quittez le champ pour l’enregistrer. Adhérent : l’application seulement. Bureau : en plus, cet espace et les contenus. Administrateur : en plus, les rôles et les réglages de l’association. Les cotisations se gèrent dans l’onglet <a href="#cotisations">Cotisations</a>.</p>
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
            <FormulaireNouvelAdherent onAjoute={(email) => { invites.reload(); setCompose([{ email }]); }} />
            {invites.loading && !invites.data ? <Skeleton lines={3} /> : !waiting.length ? <Empty icon="check" title="Tout le monde est inscrit" hint="Importez d’autres adhérents depuis « Importer »." /> : (
              <ListeEnAttente enAttente={waiting} onInviter={(email) => setCompose([{ email }])} onRetire={invites.reload} />
            )}
          </section>
        </>
      )}
      </div>
      {compose && <Compose to={compose} subject={invitation(code.data ?? null).subject} body={invitation(code.data ?? null).body} onClose={() => setCompose(null)} />}
    </>
  );
}


/** Les adhérents sans compte : les inviter un par un, ou retirer ceux qui ne font plus partie de l'association. */
function ListeEnAttente({ enAttente, onInviter, onRetire }: { enAttente: Invite[]; onInviter: (email: string) => void; onRetire: () => void }) {
  async function retirerDeLaListe(invite: Invite) {
    // Sa fiche d'annuaire, s'il en a une, reste en place : on ne retire que l'accès à l'app.
    if (!confirm(`Retirer ${fullName(invite)} de la liste ? Il ne pourra plus créer de compte dans l’app. Sa fiche d’annuaire n’est pas touchée.`)) return;
    const { error } = await supabase.rpc('retirer_invitation', { p_email: invite.email });
    if (error) return toast(error.message, 'error');
    toast(`${fullName(invite)} retiré de la liste`);
    onRetire();
  }
  return (
    <ul className="plain compact names">
      {enAttente.map((invite) => (
        <li key={invite.email} className="invite-row">
          <span>{fullName(invite)}{invite.prenom || invite.nom ? <span className="muted"> · {invite.email}</span> : null}<span className="muted small"> · ajouté {formatRelative(invite.created_at)}</span></span>
          <span className="invite-actions">
            <button className="ghost" onClick={() => onInviter(invite.email)}><Icon name="mail" size={14} /> Inviter</button>
            <button className="icon-btn danger" title="Retirer de la liste" aria-label={`Retirer ${fullName(invite)} de la liste`} onClick={() => retirerDeLaListe(invite)}><Icon name="trash" size={15} /></button>
          </span>
        </li>
      ))}
    </ul>
  );
}
