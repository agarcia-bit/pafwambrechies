import { useState } from 'react';

import { Icon } from '../Icon';
import { fullName, type MemberRow } from '../lib';

/** Le nombre de destinataires en tête du message ; un clic montre à qui il partira. */
export function ApercuDesDestinataires({ membres, groupe }: { membres: MemberRow[]; groupe: string }) {
  const [estOuvert, setEstOuvert] = useState(false);
  const libelle = `${membres.length} destinataire${membres.length > 1 ? 's' : ''}`;
  if (!membres.length) return <span className="pill neutral">{libelle}</span>;
  const tries = [...membres].sort((a, b) => fullName(a).localeCompare(fullName(b), 'fr'));
  return (
    <div className="apercu-destinataires">
      <button className="pill brand apercu-bouton" aria-expanded={estOuvert} onClick={() => setEstOuvert((v) => !v)}>
        {libelle} <Icon name={estOuvert ? 'x' : 'users'} size={12} />
      </button>
      {estOuvert && (
        <div className="apercu-liste pop-in" role="region" aria-label={`Destinataires : ${groupe}`}>
          <strong className="small">{groupe}</strong>
          <ul>{tries.map((m) => <li key={m.key}>{fullName(m)}<span className="muted"> · {m.email}</span></li>)}</ul>
        </div>
      )}
    </div>
  );
}
