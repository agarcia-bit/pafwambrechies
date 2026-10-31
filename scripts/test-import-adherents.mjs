// Cas réels de copier-coller (Excel, Numbers, Google Sheets, CSV) pour le lecteur d'import d'adhérents.
// Lancer : npx -y esbuild@0.25.0 app/src/lib/import-adherents.ts --format=esm --outfile=/tmp/import.mjs && node scripts/test-import-adherents.mjs /tmp/import.mjs
// Cas réalistes de copier-coller d'Excel (tabulations). attendu: [prenom, nom, email, date]
const cases = [
  ['En-tête dans le désordre', 'E-mail\tNom\tPrénom\nmarie@x.fr\tDUPONT\tMarie', ['Marie','Dupont','marie@x.fr','']],
  ['Nom avant prénom, sans en-tête', 'DUPONT\tMarie\tmarie@x.fr', ['Marie','Dupont','marie@x.fr','']],
  ['Date de naissance (en-tête)', 'Nom\tPrénom\tDate de naissance\tEmail\nDupont\tMarie\t12/03/1975\tmarie@x.fr', ['Marie','Dupont','marie@x.fr','']],
  ['Date de naissance sans en-tête', 'Marie\tDupont\t12/03/1975\tmarie@x.fr', ['Marie','Dupont','marie@x.fr','']],
  ['Date d’adhésion + fin de cotisation', 'Nom\tPrénom\tEmail\tDate d’adhésion\tCotisation jusqu’au\nDupont\tMarie\tmarie@x.fr\t01/09/2025\t31/08/2026', ['Marie','Dupont','marie@x.fr','2026-08-31']],
  ['Nom complet dans une colonne', 'Nom et prénom\tAdresse mail\nMarie Dupont\tmarie@x.fr', ['Marie','Dupont','marie@x.fr','']],
  ['Adhérent « DUPONT Marie »', 'Adhérent\tMail\nDUPONT Marie\tmarie@x.fr', ['Marie','Dupont','marie@x.fr','']],
  ['Ligne de titre au-dessus', 'Liste des adhérents 2026\nNom\tPrénom\tEmail\nDupont\tMarie\tmarie@x.fr', ['Marie','Dupont','marie@x.fr','']],
  ['Colonnes en plus (téléphone, ville)', 'Prénom\tNom\tTéléphone\tVille\tEmail\nMarie\tDupont\t06 12 34 56 78\tLille\tmarie@x.fr', ['Marie','Dupont','marie@x.fr','']],
  ['E-mail avec nom « Marie <...> »', 'Prénom\tNom\tEmail\nMarie\tDupont\tMarie Dupont <marie@x.fr>', ['Marie','Dupont','marie@x.fr','']],
  ['Colonne « Statut » validé', 'Nom\tPrénom\tEmail\tValidé\nDupont\tMarie\tmarie@x.fr\toui', ['Marie','Dupont','marie@x.fr','']],
  ['CSV point-virgule avec guillemets', '"Nom";"Prénom";"Courriel"\n"Dupont";"Marie";"marie@x.fr"', ['Marie','Dupont','marie@x.fr','']],
  ['Colonne N° adhérent en premier', 'N°\tNom\tPrénom\tE-mail\n12\tDupont\tMarie\tmarie@x.fr', ['Marie','Dupont','marie@x.fr','']],
];
cases.push(
  ['« Cotisation payée : Oui »', 'Nom\tPrénom\tEmail\tCotisation payée\nDupont\tMarie\tmarie@x.fr\tOui', ['Marie','Dupont','marie@x.fr','']],
  ['Ancien format PAF', 'Prénom;Nom;E-mail;Cotisation jusqu’au\nMarie;Dupont;marie@x.fr;31/12/2026', ['Marie','Dupont','marie@x.fr','2026-12-31']],
  ['Sans en-tête, avec date de cotisation', 'Marie\tDupont\tmarie@x.fr\t31/12/2026', ['Marie','Dupont','marie@x.fr','2026-12-31']],
  ['Anglais First/Last name', 'First name,Last name,Email\nMarie,Dupont,marie@x.fr', ['Marie','Dupont','marie@x.fr','']],
  ['CSV virgule « Dupont, Marie »', 'Adhérent,Email\n"Dupont, Marie",marie@x.fr', ['Marie','Dupont','marie@x.fr','']],
  ['Prénom composé + nom en capitales', 'Nom complet\tEmail\nJean-Pierre DE LA TOUR\tjp@x.fr', ['Jean-Pierre','De La Tour','jp@x.fr','']],
  ['Majuscules dans l’e-mail', 'Prénom\tNom\tMail\nMarie\tDupont\t  Marie.Dupont@X.FR ', ['Marie','Dupont','marie.dupont@x.fr','']],
);
const { parseImport } = await import(process.argv[2]);
let ok = 0;
for (const [name, text, want] of cases) {
  const r = parseImport(text);
  const got = r.rows[0] ? [r.rows[0].prenom, r.rows[0].nom, r.rows[0].email, r.rows[0].valide_jusqu] : ['ERREUR', JSON.stringify(r.errors)];
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (pass) ok++;
  console.log(`${pass ? 'OK  ' : 'FAUX'} ${name}${pass ? '' : `\n      obtenu  ${JSON.stringify(got)}\n      attendu ${JSON.stringify(want)}`}`);
}
console.log(`\n${ok}/${cases.length} cas corrects`);
process.exitCode = ok === cases.length ? 0 : 1;
