# Questionnaires des stores et notes pour les vérificateurs

Réponses établies d'après l'app telle qu'elle est le 31 octobre 2026 : aucun outil de statistiques, de
publicité ou de suivi des plantages n'y est intégré. À mettre à jour si l'on en ajoute un (Sentry par exemple).

---

## 1. Apple : « Confidentialité de l'app » (App Store Connect > App Privacy)

**Collectez-vous des données ?** Oui.

**Suivi (« Tracking ») :** Non, pour toutes les données. Aucune donnée n'est utilisée pour de la publicité ni
partagée avec des courtiers en données.

Pour chaque type ci-dessous, cocher : **lié à l'identité de l'utilisateur : oui**, **utilisé pour le suivi :
non**, **finalité : fonctionnalité de l'app** (et rien d'autre).

| Catégorie Apple | Type | Pourquoi |
|---|---|---|
| Coordonnées | Nom | Compte, annuaire, réponses aux événements |
| Coordonnées | Adresse e-mail | Connexion, invitations, e-mails du bureau |
| Coordonnées | Numéro de téléphone | Fiche d'annuaire, facultatif |
| Coordonnées | Adresse physique | Fiche d'annuaire, facultatif |
| Contenu de l'utilisateur | Photos ou vidéos | Photo de fiche d'annuaire, d'actu ou d'offre |
| Contenu de l'utilisateur | Autre contenu de l'utilisateur | Commentaires, idées, offres, réponses aux sondages et aux événements |
| Identifiants | Identifiant de l'utilisateur | Compte |
| Identifiants | Identifiant de l'appareil | Jeton de notification |
| Autres données | Autres types de données | Date de fin de cotisation, saisie par le bureau |

**Non collectés :** santé, finances (aucun paiement dans l'app), localisation, contacts, historique de
navigation ou de recherche, données d'utilisation, diagnostics, données sensibles.

L'accès au calendrier sert seulement à y **ajouter** un événement : rien n'est lu ni envoyé.

**URL de la politique de confidentialité :** https://monallianceo.fr/confidentialite

---

## 2. Google Play : « Sécurité des données » (Play Console > Contenu de l'appli)

| Question | Réponse |
|---|---|
| Votre appli collecte-t-elle ou partage-t-elle des données ? | Oui |
| Toutes les données sont-elles chiffrées en transit ? | Oui |
| Les utilisateurs peuvent-ils demander la suppression de leurs données ? | Oui, dans l'app et sur https://monallianceo.fr/suppression-compte |
| Données partagées avec des tiers | Aucune (les prestataires techniques ne comptent pas comme « partage ») |

**Données collectées.** Pour chacune : collectée **oui**, partagée **non**, traitée de façon éphémère **non**,
**obligatoire ou facultative** selon la colonne, finalité **Fonctionnement de l'appli** et **Gestion du compte**.

| Catégorie Google | Type | Obligatoire ? |
|---|---|---|
| Informations personnelles | Nom | Obligatoire |
| Informations personnelles | Adresse e-mail | Obligatoire |
| Informations personnelles | ID utilisateur | Obligatoire |
| Informations personnelles | Adresse | Facultative (annuaire) |
| Informations personnelles | Numéro de téléphone | Facultatif (annuaire) |
| Photos et vidéos | Photos | Facultatives |
| Activité dans l'appli | Autres contenus générés par l'utilisateur | Facultatifs (commentaires, idées, offres) |
| Activité dans l'appli | Autres actions (« j'aime », réponses aux sondages et aux événements) | Facultatives |
| Appareil ou autres ID | ID de l'appareil (jeton de notification) | Facultatif |

Ne pas cocher : localisation, informations financières, santé, messages, contacts, calendrier, historique de
navigation, informations sur l'appli et performances.

Le fichier `data_safety_export_filled.csv` à la racine du projet est l'ancienne version (application PAF) :
ne pas l'importer.

---

## 3. Classification par âge

**Apple** (questionnaire « Age Rating ») : répondre **Aucun** à toutes les rubriques de contenu (violence,
contenu sexuel, langage grossier, drogues, jeux d'argent, horreur…), **Non** à l'accès web illimité et aux
concours. À la question sur le **contenu généré par les utilisateurs** ou la **communication entre
utilisateurs**, répondre **Oui** : les membres publient des commentaires, des idées et des offres. L'app dispose
du signalement, du blocage et de la modération par le bureau. Garder la classification qu'Apple calcule.

**Google** (questionnaire IARC) : catégorie **Réseau social / communication** ou **Autre**.
- Les utilisateurs peuvent-ils interagir ou échanger du contenu ? **Oui**.
- Partage de la localisation ? **Non**.
- Achats numériques ? **Non**.
- Violence, sexualité, drogues, jeux d'argent, langage : **Non**.

**Public cible (Google)** : 18 ans et plus. L'app n'est pas destinée aux enfants.

**Publicités (Google)** : l'appli ne contient pas de publicités.

---

## 4. Notes pour les vérificateurs (Apple « Informations pour la vérification », Google « Accès à l'appli »)

**Compte de démonstration**
- Identifiant : `agarcia+apple@agalumy.fr`
- Mot de passe : *celui que tu as choisi, à saisir dans le formulaire (jamais dans ce fichier)*
- Ce compte est **administrateur** de l'espace fictif « Association Démo » : le vérificateur voit toutes
  les fonctions, celles des membres et celles du bureau.

**Texte à coller (anglais, lu par les vérificateurs des deux stores)**

> Allianceo is the members' app of associations (clubs, local business associations, non-profits). Each
> association has its own private space; joining requires the access code given by the association.
>
> Demo account: agarcia+apple@agalumy.fr (password in the fields above). It is an administrator of the
> fictitious "Association Démo" space, so every feature is visible: news feed, events with RSVP, offers,
> member directory, polls, idea box, documents, and the board's tools (Plus > Espace bureau).
>
> To test sign-up instead, tap "Créer mon compte" on the login screen and use the access code [CODE].
>
> User-generated content (comments, ideas, offers, directory entries): each one can be reported (the "…"
> button next to a comment, or "Signaler" on an offer, idea or directory entry), which also lets the member
> block its author. Reports notify the board, who review them and remove content (Plus > Espace bureau >
> Administration > Signalements). Community rules are accepted at sign-up and shown in Plus > Mon compte >
> Règles de la communauté.
>
> Account deletion: Plus > Mon compte > Supprimer mon compte (also at https://monallianceo.fr/suppression-compte).
>
> Membership dues: some associations let members pay their yearly membership on the association's own
> HelloAsso page. This is a payment for real-world membership of a non-profit organization, made outside the
> app; no digital content or feature is unlocked by it. The demo space does not use it.

**Code d'accès de l'espace de démonstration** : remplacer `[CODE]` par le code affiché dans les réglages de
« Association Démo » (Plus > Espace bureau > Administration > Réglages). Ne pas l'écrire dans ce fichier, qui
est sur GitHub. Le changer oblige à mettre à jour les notes dans les deux consoles.

---

## 5. Le reste à cocher dans les consoles

- **Apple, Chiffrement** : déjà réglé dans l'app (pas de chiffrement propriétaire), rien à déclarer.
- **Apple, Catégorie** : Style de vie, secondaire Réseaux sociaux.
- **Google, Appli d'actualités ?** Non.
- **Google, Appli gouvernementale ?** Non.
- **Google, Fonctionnalités financières ?** Aucune.
- **Google, Santé ?** Non.
- **Les deux, Coordonnées** : contact@agalumy.fr, site https://monallianceo.fr.
