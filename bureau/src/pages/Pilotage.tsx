import { useMemo, useState } from 'react';

import type { PageProps } from '../App';
import { useUnread } from '../Discussion';
import { Icon, Skeleton } from '../Icon';
import { isOverdue, loadBureau, supabase, today, toast, useAsync, type Action, type Tache } from '../lib';
import { filtreNonTermines } from '../periode';
import { Chronologie, Equipe, SidePanel, type CalEvent } from './PilotageViews';
import { Kpi } from '../components/ui/Kpi';
import { DemarrerLePilotage } from './DemarrerLePilotage';
import { FicheAction } from './FicheAction';
import { useOuvertureDeFiche } from './useOuvertureDeFiche';

// Deux vues suffisent : par date (que reste-t-il à faire ?) et par personne (qui fait quoi ?).
// À droite, dans les deux cas : mes tâches et les prochaines dates.
const VIEWS = [
  { key: 'chrono', label: 'Chronologie', icon: 'list', hint: 'Ce qui arrive, dans l’ordre' },
  { key: 'equipe', label: 'Équipe', icon: 'users', hint: 'Qui fait quoi' },
] as const;

export async function chargerAgendaPilotage(): Promise<CalEvent[]> {
  const { data } = await supabase.from('evenements').select('id, titre, date').or(filtreNonTermines());
  return (data ?? []) as CalEvent[];
}

export function Pilotage({ profile }: PageProps) {
  const data = useAsync(loadBureau, []);
  const agenda = useAsync(chargerAgendaPilotage, []);
  const unread = useUnread(profile.tenant_id);
  const [onlyMe, setOnlyMe] = useState(false);
  // Les tâches qu'on vient de cocher, le temps de leur animation de sortie. Déclarée avant les
  // retours anticipés ci-dessous : React exige le même nombre de mémoires à chaque affichage.
  const [leaving, setLeaving] = useState<Set<number>>(new Set());
  const fiche = useOuvertureDeFiche(agenda.data);
  const { ouverte: open, depart, ouvrir: setOpen, fermer: fermerLaFiche } = fiche;
  const [view, setViewState] = useState<string>(() => { try { const v = localStorage.getItem('pilotage-vue'); return v === 'equipe' ? v : 'chrono'; } catch { return 'chrono'; } });
  const setView = (v: string) => { setViewState(v); try { localStorage.setItem('pilotage-vue', v); } catch { /* sans stockage */ } };

  const kpi = useMemo(() => {
    const d = data.data;
    if (!d) return null;
    const openTasks = d.taches.filter((t) => t.statut !== 'Terminé');
    return {
      aVenir: d.actions.filter((a) => a.statut !== 'Terminé' && a.date_action >= today()).length,
      enCours: d.actions.filter((a) => a.statut === 'En cours').length,
      bloque: d.actions.filter((a) => a.statut === 'Bloqué').length,
      retard: openTasks.filter((t) => isOverdue(t.echeance, t.statut)).length,
      mine: openTasks.filter((t) => t.responsable === profile.id).length,
      budget: d.actions.filter((a) => a.statut !== 'Terminé').reduce((s, a) => s + (a.budget ?? 0), 0),
    };
  }, [data.data, profile.id]);

  if (data.loading && !data.data) return <div className="card"><Skeleton lines={6} /></div>;
  if (data.error) return <p className="error">{data.error}</p>;
  const all = data.data!;
  const actionOf = (id: number) => all.actions.find((a) => a.id === id);

  // « Moi uniquement » : mes tâches, et les actions dont je suis référent ou où j'ai une tâche.
  const taches = onlyMe ? all.taches.filter((t) => t.responsable === profile.id) : all.taches;
  const actions = onlyMe ? all.actions.filter((a) => a.referent === profile.id || taches.some((t) => t.action_id === a.id)) : all.actions;

  async function toggle(t: Tache) {
    const finishing = t.statut !== 'Terminé';
    if (finishing) setLeaving((s) => new Set(s).add(t.id));
    const { error } = await supabase.from('taches').update({ statut: finishing ? 'Terminé' : 'À faire' }).eq('id', t.id);
    if (error) { setLeaving((s) => { const n = new Set(s); n.delete(t.id); return n; }); return toast(error.message, 'error'); }
    if (finishing) toast('Tâche terminée ✓');
    // Le temps que la ligne se coche et s'efface (animation row-out).
    setTimeout(() => { data.reload(); setLeaving((s) => { const n = new Set(s); n.delete(t.id); return n; }); }, finishing ? 650 : 0);
  }
  async function addTask(a: Action, libelle: string) {
    const { error } = await supabase.from('taches').insert({ action_id: a.id, tenant_id: profile.tenant_id, libelle, responsable: a.referent });
    if (error) return toast(error.message, 'error');
    toast('Tâche ajoutée');
    data.reload();
  }
  async function moveAction(a: Action, statut: string) {
    if (a.statut === statut) return;
    const { error } = await supabase.from('actions').update({ statut }).eq('id', a.id);
    if (error) return toast(error.message, 'error');
    toast(`« ${a.titre} » → ${statut}`);
    data.reload();
  }

  const props = { actions, taches, members: all.members, me: profile.id, onOpen: setOpen, onToggle: toggle, onAddTask: addTask, onMove: moveAction, unread, leaving };
  const current = VIEWS.find((v) => v.key === view) ?? VIEWS[0];

  return (
    <>
      {all.actions.length > 0 && <div className="kpis">
        <Kpi valeur={kpi!.aVenir} libelle="actions à venir" />
        <Kpi valeur={kpi!.enCours} libelle="en cours" ton="info" />
        {kpi!.bloque > 0 && <Kpi valeur={kpi!.bloque} libelle={kpi!.bloque > 1 ? 'bloquées' : 'bloquée'} ton="bad" />}
        <Kpi valeur={kpi!.retard} libelle={kpi!.retard > 1 ? 'tâches en retard' : 'tâche en retard'} ton={kpi!.retard ? 'bad' : 'ok'} />
        <Kpi valeur={kpi!.mine} libelle={kpi!.mine > 1 ? 'tâches pour moi' : 'tâche pour moi'} ton="brand" />
        {kpi!.budget > 0 && <Kpi valeur={`${kpi!.budget.toLocaleString('fr-FR')} €`} libelle="budget engagé" />}
      </div>}

      <div className="view-bar">
        <div className="seg" role="tablist" aria-label="Vue">
          {VIEWS.map((v) => (
            <button key={v.key} role="tab" aria-selected={view === v.key} className={view === v.key ? 'on' : ''} onClick={() => setView(v.key)} title={v.hint}>
              <Icon name={v.icon} size={15} /><span>{v.label}</span>
            </button>
          ))}
        </div>
        <span className="muted small view-hint">{current.hint}</span>
        <span className="grow" />
        <label className="switch">
          <input type="checkbox" checked={onlyMe} onChange={(e) => setOnlyMe(e.target.checked)} />
          <span className="track" /><span>Moi uniquement</span>
        </label>
        <button className="primary" onClick={() => fiche.ouvrirNouvelle()}><Icon name="plus" size={16} /> Nouvelle action</button>
      </div>

      <div className="with-side">
        {!all.actions.length ? <DemarrerLePilotage evenements={agenda.data ?? []} onCommencer={fiche.ouvrirNouvelle} />
          : view === 'equipe' ? <Equipe {...props} /> : <Chronologie {...props} />}
        <SidePanel {...props} actions={all.actions} taches={all.taches} events={agenda.data ?? []} />
      </div>

      {open !== null && (
        <FicheAction
          action={open === 'new' ? null : actionOf(open) ?? null}
          depart={depart}
          taches={open === 'new' ? [] : all.taches.filter((t) => t.action_id === open)}
          members={all.members}
          profile={profile}
          onClose={fermerLaFiche}
          onChanged={data.reload}
          onCreee={setOpen}
        />
      )}
    </>
  );
}
