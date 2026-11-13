import { useId } from 'react';

/** Une catégorie libre : les catégories déjà utilisées sont proposées dans un menu déroulant. */
export function ChampCategorie({ valeur, categories, onChange, placeholder }: {
  valeur: string;
  categories: string[];
  onChange: (valeur: string) => void;
  placeholder?: string;
}) {
  const idListe = useId();
  return (
    <>
      <input type="text" list={idListe} value={valeur} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" />
      <datalist id={idListe}>{categories.map((c) => <option key={c} value={c} />)}</datalist>
    </>
  );
}
