/** Une case de chiffre clé (rangée `.kpis`) : le nombre en grand, ce qu'il compte en dessous.
 *  `ton` colore la case : ok, warn, bad, brand… */
export function Kpi({ valeur, libelle, ton }: { valeur: number | string; libelle: string; ton?: string }) {
  return (
    <div className={'kpi ' + (ton ?? '')}>
      <strong>{typeof valeur === 'number' ? valeur.toLocaleString('fr-FR') : valeur}</strong>
      <span>{libelle}</span>
    </div>
  );
}
