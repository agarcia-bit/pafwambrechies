# Publier la PWA sur Google Play (Bubblewrap / TWA)

Guide complet, pensé pour être suivi par quelqu'un qui n'est pas dev. Compter
**une demi-journée** de bout en bout (hors délai de validation Google, 24-72h).

Le principe : on emballe la PWA dans une "Trusted Web Activity" (TWA), qui
est officiellement soutenue par Google pour publier une PWA sur le Play Store.
L'app est un container Chrome qui affiche ton site Netlify en plein écran,
sans barre d'URL. Chaque mise à jour de ton site est **automatiquement**
disponible dans l'app — pas besoin de re-soumettre à Google.

## Prérequis à cocher

- [ ] Compte Google Play Console créé (25$ une fois) — https://play.google.com/console/signup
- [ ] Vérification d'identité Google terminée (1-3 jours ouvrés après création)
- [ ] Node.js 18+ installé localement (pour Bubblewrap)
- [ ] Java 17+ installé (pour signer l'APK) — `brew install openjdk@17` sur Mac

## Étape 1 — Générer l'app Android avec Bubblewrap

Bubblewrap est l'outil officiel Google pour générer un TWA à partir d'une PWA.

```bash
npm install -g @bubblewrap/cli
cd ~/paf-android-build      # dossier vide, hors du repo web
bubblewrap init --manifest https://paf-wambrechies.netlify.app/manifest.json
```

L'outil te posera plein de questions. Voici les réponses recommandées :

| Question                        | Réponse                                                 |
|---------------------------------|---------------------------------------------------------|
| Domain being opened in the TWA  | `paf-wambrechies.netlify.app`                           |
| Name of the application         | `PAF Wambrechies`                                       |
| Short name                      | `PAF`                                                   |
| Application ID (package name)   | `fr.paf.wambrechies` (irréversible — ne le changera plus jamais après publication) |
| Starting version                | `1`                                                     |
| Display mode                    | `standalone`                                            |
| Orientation                     | `portrait`                                              |
| Status bar color                | `#2E3192` (le tenant_primary_color de PAF)             |
| Icon URL                        | `https://paf-wambrechies.netlify.app/icons/icon-512.png`|
| Maskable icon URL               | `https://paf-wambrechies.netlify.app/icons/icon-512-maskable.png` |
| Include a Notification splash…  | `Yes`                                                   |
| Splash screen color             | `#FFFFFF`                                               |
| Signing key location            | `./android.keystore` (à sauvegarder précieusement !)   |
| Key alias                       | `android`                                               |
| Password (garde-le en sûreté)   | libre — **écris-le dans ton gestionnaire de mots de passe** |

Puis :

```bash
bubblewrap build
```

Ça génère **deux fichiers** dans le dossier :
- `app-release-bundle.aab` — c'est le fichier à uploader sur Play Console
- `app-release-signed.apk` — pour installer localement et tester

⚠️ **Le fichier `android.keystore` est CRITIQUE**. Sans lui, tu ne pourras
plus jamais publier de mise à jour de l'app. Sauvegarde-le dans ton drive +
ton gestionnaire de mots de passe.

## Étape 2 — Récupérer la SHA-256 et compléter assetlinks.json

Bubblewrap affiche à la fin du build une empreinte SHA-256 du certificat.
Elle ressemble à :
`AB:CD:EF:12:34:...` (~64 caractères hex).

Édite `.well-known/assetlinks.json` dans le repo, remplace
`REPLACE_WITH_SHA256_FROM_BUBBLEWRAP` par cette valeur, commit + push.

Une fois Netlify redéployé, vérifie que https://paf-wambrechies.netlify.app/.well-known/assetlinks.json répond bien (JSON valide, pas 404).

**Vérifie aussi que le fichier est servi avec le bon Content-Type** :
```bash
curl -I https://paf-wambrechies.netlify.app/.well-known/assetlinks.json
```
Le header doit contenir `Content-Type: application/json`. Sinon ajouter
dans `netlify.toml` :
```toml
[[headers]]
  for = "/.well-known/assetlinks.json"
  [headers.values]
    Content-Type = "application/json"
```

Sans ça, Chrome affichera une barre d'URL au-dessus de ton app (pas grave
pour publier, mais moche).

## Étape 3 — Créer la fiche du Play Store

Dans Play Console → **Créer une application** :

| Champ              | Valeur                                                       |
|--------------------|--------------------------------------------------------------|
| Nom                | `PAF Wambrechies`                                            |
| Langue par défaut  | `Français (France)`                                          |
| Type               | `Application`                                                |
| Gratuit / Payant   | `Gratuit`                                                    |

Puis remplis les sections obligatoires :

**Configuration principale de l'application → Fiche du store**
- Description courte (80 caractères max) : `L'app officielle des adhérents PAF Wambrechies`
- Description longue (4000 caractères max) : voir modèle en bas de ce fichier
- Icône (512x512 PNG) : `icons/icon-512.png` du repo
- Image de présentation (1024x500 PNG) : à créer sur Canva ou Figma
- 2 à 8 captures d'écran (téléphone, 16:9 ou 9:16, min 320px) : à faire depuis l'app en prod

**Politique de confidentialité (obligatoire)**
Il faut une URL vers une politique de confidentialité. Option la plus simple :
créer une page `/politique-de-confidentialite.html` sur ton site Netlify avec
un texte standard (RGPD-compliant). Modèle générique disponible sur
https://cnil.fr ou générateurs en ligne.

**Classification du contenu** : PEGI 3 — pas de contenu sensible.

**Application destinée aux enfants ?** Non.

**Publicités ?** Non.

**Autorisations d'accès aux données** : uniquement email (auth) et
informations de profil que l'utilisateur renseigne.

## Étape 4 — Uploader l'AAB

Play Console → **Test et diffusion → Version de production → Créer une version** :

1. Autoriser Google à gérer les clés de signature (recommandé).
2. Uploader `app-release-bundle.aab`.
3. Renseigner les **notes de version** en français, par exemple :
   > Première version de l'application PAF Wambrechies. Actualités, annuaire
   > des commerçants, offres exclusives, boîte à idées et calendrier des
   > événements.
4. **Enregistrer** puis **Envoyer pour examen**.

## Étape 5 — Attendre la validation Google

Compter **1 à 3 jours ouvrés** pour la première soumission. Ensuite les
updates sont plus rapides (quelques heures typiquement).

Google peut te poser des questions supplémentaires par email — surveille ta
boîte associée au compte Play Console.

## Étape 6 — Une fois publié

- Ton app apparaît sur https://play.google.com/store/apps/details?id=fr.paf.wambrechies
- Les utilisateurs peuvent l'installer.
- **Chaque mise à jour de ton site Netlify est instantanément dispo dans
  l'app** — pas besoin de re-soumettre.
- Tu ne re-soumets une nouvelle version à Google que si tu changes des
  choses vraiment natives (icône de l'app, splash screen, package_name…).

## Publier la même app pour un nouveau tenant

Chaque tenant a **son propre AAB** (package name différent, icônes
différentes, signing key différente). La procédure est la même :

1. `bubblewrap init` avec l'URL du site du nouveau tenant
   (`paf-halluin.netlify.app`) et un `package_name` différent
   (`fr.paf.halluin`).
2. Répéter les étapes 2 à 5 pour le nouveau tenant.

Compter ~2h par nouveau tenant une fois que tu maîtrises le flow.

## Modèle de description longue

```
Application officielle réservée aux adhérents de la PAF Wambrechies.

Votre espace pour rester connecté à la vie de l'association :

📰 Actualités — Toutes les nouvelles de la PAF et de ses membres.

🏪 Annuaire — Retrouvez tous les commerçants et prestataires de
Wambrechies, leurs coordonnées, leurs spécialités.

🏷️ Offres exclusives — Des bons plans réservés aux adhérents PAF, entre
commerçants.

💡 Boîte à idées — Proposez vos idées, votez pour celles des autres,
commentez.

📅 Calendrier — Tous les événements de l'association en un coup d'œil.

🔗 Liens utiles — Toutes les ressources dont vous avez besoin.

L'inscription est réservée aux adhérents de la PAF Wambrechies. Contactez
un membre du bureau pour obtenir votre code d'accès.
```
