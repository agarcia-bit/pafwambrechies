import { useEffect, useState } from 'react';

import { ChampCategorie } from '../components/ui/ChampCategorie';
import { categoriesUtilisees } from '../categories-libres';
import { FONCTIONS_COURANTES } from '../fonction-bureau';
import { Avatar } from '../Icon';
import { chargerFonctions, fullName, supabase, toast, useAsync, type Role } from '../lib';

export type MembreInscrit = { id: string; email: string | null; prenom: string | null; nom: string | null; role: Role };

export const ROLE_LABELS: Record<Role, string> = { adherent: 'Adhérent', bureau: 'Bureau', admin: 'Administrateur' };
const tonDuRole = (role: Role) => (role === 'admin' ? 'bad' : role === 'bureau' ? 'info' : 'neutral');

/** Les inscrits : leur rôle (réglé par un admin) et leur fonction au bureau (Président, Trésorier…). */
export function TableauDesRoles({ membres, moi, estAdmin, onChangerRole }: {
  membres: MembreInscrit[];
  moi: string;
  estAdmin: boolean;
  onChangerRole: (membre: MembreInscrit, role: Role) => void;
}) {
  const fonctions = useAsync(chargerFonctions, []);
  const suggestions = categoriesUtilisees([...FONCTIONS_COURANTES, ...(fonctions.data?.values() ?? [])]);
  return (
    <div className="card flush">
      <table>
        <thead><tr><th>Adhérent</th><th>E-mail</th><th>Rôle</th><th>Fonction au bureau</th></tr></thead>
        <tbody>
          {membres.map((m) => (
            <tr key={m.id}>
              <td><span className="who"><Avatar name={fullName(m)} />{fullName(m)}{m.id === moi && <span className="pill brand">moi</span>}</span></td>
              <td className="muted cellule-email" title={m.email ?? undefined}>{m.email}</td>
              <td>
                {estAdmin && m.id !== moi
                  ? <select className={'status ' + tonDuRole(m.role)} value={m.role} onChange={(e) => onChangerRole(m, e.target.value as Role)} aria-label={`Rôle de ${fullName(m)}`}>
                      {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  : <span className={'badge ' + tonDuRole(m.role)}>{ROLE_LABELS[m.role]}</span>}
              </td>
              <td><CelluleFonction membre={m} actuelle={fonctions.data?.get(m.id) ?? ''} suggestions={suggestions} onEnregistree={fonctions.reload} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** La fonction s'enregistre en quittant le champ, si elle a changé. */
function CelluleFonction({ membre, actuelle, suggestions, onEnregistree }: {
  membre: MembreInscrit;
  actuelle: string;
  suggestions: string[];
  onEnregistree: () => void;
}) {
  const [valeur, setValeur] = useState(actuelle);
  useEffect(() => setValeur(actuelle), [actuelle]);

  async function enregistrer() {
    if (valeur.trim() === actuelle) return;
    const { error } = await supabase.rpc('definir_fonction', { p_member: membre.id, p_fonction: valeur.trim() });
    if (error) {
      setValeur(actuelle);
      return toast(error.message, 'error');
    }
    toast(valeur.trim() ? `${fullName(membre)} : ${valeur.trim()}` : `Fonction de ${fullName(membre)} retirée`);
    onEnregistree();
  }

  return (
    <div className="cellule-fonction" onBlur={enregistrer} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLElement).blur()}>
      <ChampCategorie valeur={valeur} categories={suggestions} onChange={setValeur} placeholder="—" />
    </div>
  );
}
