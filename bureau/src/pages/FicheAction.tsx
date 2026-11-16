import { useState } from 'react';

import type { PageProps } from '../App';
import { ChoixEmoji } from '../components/ui/ChoixEmoji';
import { Thread } from '../Discussion';
import { Drawer } from '../Drawer';
import { Icon } from '../Icon';
import { ACTION_STATUTS, dueLabel, isOverdue, nameOf, PRIORITES, type Action, type BureauMember, type Tache } from '../lib';
import { MODELES, type BrouillonAction, type Priorite } from '../modeles-actions';
import { TONE } from './PilotageViews';
import { useFicheAction, type FicheActionEtat, type NouvelleTache } from './useFicheAction';

type Props = {
  action: Action | null;
  /** Ce qui préremplit une nouvelle action (modèle, événement de l'agenda). */
  depart: BrouillonAction | null;
  taches: Tache[];
  members: BureauMember[];
  profile: PageProps['profile'];
  onClose: () => void;
  onChanged: () => void;
  onCreee: (id: number) => void;
};

/** La fiche d'une action du bureau : ses champs, ses tâches et sa discussion. */
export function FicheAction({ action, depart, taches, members, profile, onClose, onChanged, onCreee }: Props) {
  const fiche = useFicheAction({ action, depart, moi: profile.id, tenant: profile.tenant_id, onChanged, onClose, onCreee });
  const { id, champs } = fiche;
  return (
    <Drawer
      wide
      onClose={fiche.fermer}
      title={<span className="drawer-title"><span className="emoji-box">{champs.emoji || '📌'}</span>{id ? champs.titre || 'Action' : 'Nouvelle action'}</span>}
      subtitle={id ? <span className={'pill ' + TONE[champs.statut]}>{champs.statut}</span> : 'Un projet du bureau, avec sa liste de tâches : qui fait quoi, et pour quand.'}
      footer={<PiedDeFiche fiche={fiche} />}>
      {!id && <ModelesRapides fiche={fiche} />}
      <ChampsDeLAction fiche={fiche} members={members} />
      {id
        ? <TachesDeLAction fiche={fiche} taches={taches} members={members} moi={profile.id} />
        : <TachesPrevues fiche={fiche} />}
      {id && (
        <section className="drawer-section">
          <div className="section-head"><h3>Discussion</h3><span className="muted small">Bureau uniquement</span></div>
          <Thread profile={profile} actionId={id} placeholder={`Écrire à propos de « ${champs.titre || 'cette action'} »…`} />
        </section>
      )}
    </Drawer>
  );
}

function PiedDeFiche({ fiche }: { fiche: FicheActionEtat }) {
  if (!fiche.id) {
    return (
      <>
        <span className="grow" />
        <button className="ghost" onClick={fiche.fermer}>Annuler</button>
        <button className="primary" disabled={fiche.enCours || !fiche.champs.titre.trim()} onClick={fiche.creer}>{fiche.enCours ? 'Création…' : 'Créer l’action'}</button>
      </>
    );
  }
  return (
    <>
      <button className="ghost danger" onClick={fiche.supprimer}><Icon name="trash" size={15} /> Supprimer</button>
      <span className="grow" />
      <span className="muted small" aria-live="polite">{fiche.etat === 'a_enregistrer' ? 'Enregistrement…' : fiche.etat === 'enregistre' ? 'Enregistré ✓' : 'Les modifications s’enregistrent toutes seules'}</span>
      <button className="primary" onClick={fiche.fermer}>Fermer</button>
    </>
  );
}

/** Pour une nouvelle action : partir d'une liste de tâches toute faite plutôt que d'une page blanche. */
function ModelesRapides({ fiche }: { fiche: FicheActionEtat }) {
  return (
    <div className="modeles-rapides">
      <span className="muted small">Partir d’un modèle :</span>
      {MODELES.map((m) => (
        <button key={m.cle} type="button" className="chip" onClick={() => fiche.appliquerModele(m)} title={m.resume}>{m.emoji} {m.titre}</button>
      ))}
    </div>
  );
}

function ChampsDeLAction({ fiche, members }: { fiche: FicheActionEtat; members: BureauMember[] }) {
  const { champs, modifier, id } = fiche;
  const personnes = members.filter((m) => m.is_bureau || m.id === champs.referent);
  const statutEtBudget = (
    <div className="form-row">
      <label>Statut<select value={champs.statut} onChange={(e) => modifier('statut', e.target.value as Action['statut'])}>{ACTION_STATUTS.map((s) => <option key={s}>{s}</option>)}</select></label>
      <label>Budget (€)<input type="number" min="0" value={champs.budget} onChange={(e) => modifier('budget', e.target.value)} placeholder="—" /></label>
    </div>
  );
  return (
    <div className="form">
      <div className="form-row">
        <label className="w-emoji">Icône<ChoixEmoji valeur={champs.emoji} onChange={(emoji) => modifier('emoji', emoji)} /></label>
        <label className="grow">Titre<input type="text" value={champs.titre} onChange={(e) => modifier('titre', e.target.value)} placeholder="Ex. Organiser le Beaujolais nouveau" autoFocus={!id} /></label>
      </div>
      <div className="form-row">
        <label>Date de l’action<input type="date" value={champs.date_action} onChange={(e) => modifier('date_action', e.target.value)} /></label>
        <label>Référent<select value={champs.referent} onChange={(e) => modifier('referent', e.target.value)}><option value="">Non assigné</option>{personnes.map((m) => <option key={m.id} value={m.id}>{nameOf(members, m.id)}</option>)}</select></label>
      </div>
      {/* À la création, l'essentiel d'abord : le statut et le budget attendent dans « Plus d'options ». */}
      {id ? statutEtBudget : <details className="plus-options"><summary>Plus d’options (statut, budget)</summary>{statutEtBudget}</details>}
    </div>
  );
}

/** Les tâches d'une action pas encore créée : elles seront enregistrées avec elle, confiées au référent. */
function TachesPrevues({ fiche }: { fiche: FicheActionEtat }) {
  const { tachesPrevues, setTachesPrevues } = fiche;
  const [libelle, setLibelle] = useState('');
  const changer = (rang: number, changement: Partial<(typeof tachesPrevues)[number]>) =>
    setTachesPrevues(tachesPrevues.map((t, i) => (i === rang ? { ...t, ...changement } : t)));
  function ajouter() {
    if (!libelle.trim()) return;
    setTachesPrevues([...tachesPrevues, { libelle: libelle.trim(), echeance: '', priorite: 'Moyenne' }]);
    setLibelle('');
  }
  return (
    <section className="drawer-section">
      <div className="section-head"><h3>Tâches</h3><span className="muted small">{tachesPrevues.length ? 'Créées avec l’action, à ajuster ensuite' : 'Facultatif : vous pourrez en ajouter plus tard'}</span></div>
      <ul className="task-list editable">
        {tachesPrevues.map((t, rang) => (
          <li key={rang} className="task">
            <input className="grow tache-prevue" type="text" value={t.libelle} onChange={(e) => changer(rang, { libelle: e.target.value })} aria-label="Tâche" />
            <input className="inline" type="date" value={t.echeance} onChange={(e) => changer(rang, { echeance: e.target.value })} aria-label="Échéance" />
            <button className="icon-btn" aria-label="Retirer la tâche" onClick={() => setTachesPrevues(tachesPrevues.filter((_, i) => i !== rang))}><Icon name="x" size={15} /></button>
          </li>
        ))}
      </ul>
      <div className="quick-add">
        <Icon name="plus" size={15} />
        <input value={libelle} onChange={(e) => setLibelle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ajouter()} placeholder="Ajouter une tâche… (Entrée)" aria-label="Ajouter une tâche" />
        {libelle.trim() && <button className="ghost small" onClick={ajouter}>Ajouter</button>}
      </div>
    </section>
  );
}

function TachesDeLAction({ fiche, taches, members, moi }: { fiche: FicheActionEtat; taches: Tache[]; members: BureauMember[]; moi: string }) {
  const liste = [...taches].sort((a, b) => (a.statut === 'Terminé') === (b.statut === 'Terminé') ? (a.echeance ?? '9999').localeCompare(b.echeance ?? '9999') : a.statut === 'Terminé' ? 1 : -1);
  const terminees = liste.filter((t) => t.statut === 'Terminé').length;
  return (
    <section className="drawer-section">
      <div className="section-head">
        <h3>Tâches</h3>
        <span className="muted small">{terminees}/{liste.length} terminée{terminees > 1 ? 's' : ''}</span>
      </div>
      <ul className="task-list editable">
        {liste.map((t) => <LigneDeTache key={t.id} tache={t} fiche={fiche} members={members} />)}
        {!liste.length && <li className="muted small empty-line">Aucune tâche pour l’instant.</li>}
      </ul>
      <AjoutDeTache fiche={fiche} members={members} responsableParDefaut={fiche.champs.referent || moi} />
    </section>
  );
}

function LigneDeTache({ tache: t, fiche, members }: { tache: Tache; fiche: FicheActionEtat; members: BureauMember[] }) {
  const estTerminee = t.statut === 'Terminé';
  return (
    <li className={'task' + (estTerminee ? ' done' : '')}>
      <button className={'check' + (estTerminee ? ' on' : '')} aria-label={estTerminee ? 'Rouvrir' : 'Terminer'} onClick={() => fiche.modifierTache(t, { statut: estTerminee ? 'À faire' : 'Terminé' })}>{estTerminee && <Icon name="check" size={12} />}</button>
      <div className="grow">
        <div className="task-title">{t.libelle}</div>
        <div className="task-meta">
          <select className="inline" value={t.responsable ?? ''} onChange={(e) => fiche.modifierTache(t, { responsable: e.target.value || null })} aria-label="Responsable">
            <option value="">Non assigné</option>{members.filter((m) => m.is_bureau || m.id === t.responsable).map((m) => <option key={m.id} value={m.id}>{nameOf(members, m.id)}</option>)}
          </select>
          <input className="inline" type="date" value={t.echeance ?? ''} onChange={(e) => fiche.modifierTache(t, { echeance: e.target.value || null })} aria-label="Échéance" />
          <select className="inline" value={t.priorite} onChange={(e) => fiche.modifierTache(t, { priorite: e.target.value as Tache['priorite'] })} aria-label="Priorité">
            {PRIORITES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>
      {t.echeance && <span className={'due' + (isOverdue(t.echeance, t.statut) ? ' late' : '')}>{dueLabel(t.echeance)}</span>}
      <button className="icon-btn" aria-label="Supprimer la tâche" onClick={() => fiche.supprimerTache(t)}><Icon name="trash" size={15} /></button>
    </li>
  );
}

function AjoutDeTache({ fiche, members, responsableParDefaut }: { fiche: FicheActionEtat; members: BureauMember[]; responsableParDefaut: string }) {
  const [nouvelle, setNouvelle] = useState<NouvelleTache>({ libelle: '', responsable: responsableParDefaut, echeance: '', priorite: 'Moyenne' });
  async function ajouter() {
    if (!nouvelle.libelle.trim()) return;
    await fiche.ajouterTache(nouvelle);
    setNouvelle({ ...nouvelle, libelle: '', echeance: '' });
  }
  return (
    <div className="add-task">
      <input type="text" placeholder="Nouvelle tâche… (Entrée pour ajouter)" value={nouvelle.libelle} onChange={(e) => setNouvelle({ ...nouvelle, libelle: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && ajouter()} />
      <div className="form-row">
        <select value={nouvelle.responsable} onChange={(e) => setNouvelle({ ...nouvelle, responsable: e.target.value })} aria-label="Responsable"><option value="">Non assigné</option>{members.filter((m) => m.is_bureau).map((m) => <option key={m.id} value={m.id}>{nameOf(members, m.id)}</option>)}</select>
        <input type="date" value={nouvelle.echeance} onChange={(e) => setNouvelle({ ...nouvelle, echeance: e.target.value })} aria-label="Échéance" />
        <select value={nouvelle.priorite} onChange={(e) => setNouvelle({ ...nouvelle, priorite: e.target.value as Priorite })} aria-label="Priorité">{PRIORITES.map((p) => <option key={p}>{p}</option>)}</select>
        <button className="primary" disabled={!nouvelle.libelle.trim()} onClick={ajouter}><Icon name="plus" size={15} /> Ajouter</button>
      </div>
    </div>
  );
}
