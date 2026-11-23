---
name: Allianceo
description: L'espace adhérents d'une association — appli mobile pour les membres, espace bureau sur ordinateur.
colors:
  allianceo-teal: "#0F766E"
  brand-soft: "#E6F4F2"
  brand-line: "#9FD3CB"
  app-background: "#E6E6EC"
  card: "#FFFFFF"
  text: "#000000"
  text-secondary: "#6C6C70"
  separator: "#C6C6CC"
  fill: "#DADAE1"
  bureau-background: "#F6F7F9"
  bureau-text: "#0F172A"
  bureau-muted: "#64748B"
  bureau-line: "#E9EDF3"
  ok: "#15803D"
  ok-soft: "#E7F6EC"
  warn: "#B45309"
  warn-soft: "#FDF1DC"
  bad: "#C0262D"
  bad-soft: "#FCE9EA"
  info: "#1D4ED8"
  info-soft: "#E7EDFC"
  neutral-soft: "#EEF1F5"
  event: "#7C3AED"
  event-soft: "#EFE9FD"
typography:
  display:
    fontFamily: "Sora, Inter, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 800
    lineHeight: "42px"
  headline:
    fontFamily: "Sora, Inter, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: "29px"
  title:
    fontFamily: "system-ui, -apple-system, Inter, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: "22px"
  body:
    fontFamily: "system-ui, -apple-system, Inter, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: "24px"
  label:
    fontFamily: "system-ui, -apple-system, Inter, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: "18px"
  bureau-h1:
    fontFamily: "Sora, Inter, system-ui, sans-serif"
    fontSize: "27px"
    fontWeight: 700
    letterSpacing: "-0.025em"
  bureau-body:
    fontFamily: "Inter, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  badge: "6px"
  sm: "10px"
  field: "12px"
  md: "14px"
  card: "16px"
  lg: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.allianceo-teal}"
    textColor: "{colors.card}"
    rounded: "{rounded.pill}"
    height: "50px"
    padding: "0 20px"
  button-compact:
    backgroundColor: "{colors.allianceo-teal}"
    textColor: "{colors.card}"
    rounded: "{rounded.pill}"
    height: "38px"
    padding: "0 14px"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.card}"
    padding: "16px"
  text-field:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.text}"
    rounded: "{rounded.field}"
    height: "48px"
    padding: "12px 14px"
  chip:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    height: "34px"
    padding: "0 14px"
  chip-selected:
    backgroundColor: "{colors.allianceo-teal}"
    textColor: "{colors.card}"
    rounded: "{rounded.pill}"
    height: "34px"
    padding: "0 14px"
  badge:
    backgroundColor: "{colors.brand-soft}"
    textColor: "{colors.allianceo-teal}"
    rounded: "{rounded.badge}"
    padding: "3px 8px"
  bureau-kpi:
    backgroundColor: "{colors.card}"
    textColor: "{colors.bureau-text}"
    rounded: "{rounded.card}"
    padding: "16px 18px 14px"
---

# Design System: Allianceo

## Overview

**Creative North Star: "La salle des fêtes bien rangée"**

Allianceo est l'outil d'une association de quartier : on y vient vite, souvent depuis un téléphone, pour savoir ce qui se passe et y répondre. Le style est clair, aéré et familier. L'appli reprend les codes d'iOS (fonds groupés gris clair, cartes blanches, gros boutons arrondis), et l'espace bureau ceux d'un outil de travail sobre (tableaux lisibles, tuiles d'indicateurs, menu en pastilles). La couleur de l'association teinte l'ensemble : chaque association a la sienne, et Allianceo n'impose son vert d'eau que lorsqu'aucune couleur n'est choisie.

L'identité tient dans quelques détails précis plutôt que dans le décor : des titres en Sora très gras, une bande de couleur en haut des écrans, des pastilles de sélection pleines, des ombres légères. Le reste s'efface devant le contenu : les noms, les dates, les places.

**Key Characteristics:**
- La couleur vient de l'association, ajustée automatiquement pour rester lisible (contraste 4,5:1 sur la carte).
- Fonds gris clair, cartes blanches arrondies à 16 px, sans bordure dans l'appli.
- Titres en Sora (800 dans l'appli, 700 dans le bureau), texte courant en police système ou Inter.
- Chaque couleur d'état a un sens fixe : vert = bon, ambre = à surveiller, rouge = urgent, bleu = information.
- Mode clair et mode sombre, tous les deux maintenus.

## Colors

Une couleur de marque variable, une base neutre empruntée à iOS, et quatre couleurs d'état qui portent toujours le même sens.

### Primary
- **Vert d'eau Allianceo** (allianceo-teal) : la couleur par défaut, remplacée par celle de l'association quand elle existe. Elle sert pour les boutons principaux, la pastille sélectionnée, le lien actif du menu et la bande d'en-tête (assombrie jusqu'à 4,5:1 sous le texte blanc).
- **Vert d'eau pâle** (brand-soft) : les fonds de sélection, les pastilles d'icônes et les badges de la marque. Dans l'appli, il se calcule en mêlant 12 % de la couleur de l'association au blanc de la carte.

### Secondary
- **Violet événement** (event, event-soft) : il ne marque que les événements, dans l'espace bureau.

### Neutral
- **Gris de fond** (app-background) : le fond groupé des écrans de l'appli.
- **Blanc carte** (card) : les cartes, les listes et les feuilles.
- **Gris remplissage** (fill) : les champs de saisie et les pastilles non sélectionnées.
- **Gris secondaire** (text-secondary) : les légendes, les dates et les aides.
- **Fond bureau** (bureau-background) : le fond de l'espace bureau, avec un halo très doux de la couleur de marque en haut à gauche.

### Named Rules
**La règle du sens fixe.** Vert (ok) = c'est bon, ambre (warn) = à surveiller, rouge (bad) = urgent ou impossible, bleu (info) = information, gris (neutral-soft) = inactif ou terminé. Une couleur d'état ne sert jamais de décor.

**La règle de la couleur d'association.** On ne code jamais une couleur de marque en dur dans un écran : on lit `colors.primary` ou `colors.banner` (appli) et `var(--brand)` (bureau), qui sont déjà ajustés pour le contraste.

## Typography

**Display Font:** Sora (avec Inter, puis la police système)
**Body Font:** la police système dans l'appli (San Francisco sur iOS), Inter dans l'espace bureau

**Character:** Sora donne aux titres et aux chiffres clés un ton franc et chaleureux. Le texte courant reste dans la police du système, pour se lire comme le reste du téléphone.

### Hierarchy
- **Display** (Sora 800, 34/42) : le grand titre d'un écran de l'appli.
- **Headline** (Sora 700, 22/29) : le titre d'une section ou d'une carte importante.
- **Title** (600, 17/22) : le titre d'une ligne de liste et le libellé d'un bouton.
- **Body** (400, 17/24) : le texte courant de l'appli. Il passe à 14 px et 1,5 d'interligne dans le bureau.
- **Label** (600, 13/18) : les étiquettes de champ, les badges (12 px) et les en-têtes de tableau du bureau (11 px, en capitales espacées de 0,08 em).

### Named Rules
**La règle des chiffres en Sora.** Dans le bureau, les chiffres clés (tuiles d'indicateurs, statistiques) s'écrivent en Sora, avec des chiffres de largeur égale (`tabular-nums`) pour rester alignés.

## Layout

L'appli tient sur une colonne, avec des marges de 16 px. Sur un grand écran (iPhone Duo ouvert, tablette), le contenu reste centré dans une largeur de lecture de 640 px au plus, à l'intérieur des zones sûres. Les espacements suivent un pas de 4 px (4, 8, 12, 16, 24, 32). Toute zone qu'on touche mesure au moins 44 px de haut.

L'espace bureau a un menu latéral translucide à gauche et le contenu à droite, en cartes. Sous la largeur d'une tablette, le menu passe dans un tiroir (`mobile.css`). La densité est moyenne : aérée pour les tableaux de bord, plus serrée pour les tableaux de données.

## Elevation & Depth

L'appli est plate : la profondeur vient du contraste entre le fond gris et les cartes blanches, sans ombre. Le bureau ajoute des ombres très légères, qui grandissent au survol, et des surfaces translucides floutées pour le menu, la discussion et le fond assombri des tiroirs.

### Shadow Vocabulary
- **Repos** (`0 1px 2px rgba(15,23,42,.04), 0 1px 1px rgba(15,23,42,.03)`) : les cartes, les boutons et les tuiles au repos.
- **Survol** (`0 4px 14px rgba(15,23,42,.06), 0 14px 40px rgba(15,23,42,.07)`) : une carte cliquable ou une tuile survolée, qui monte aussi de 1 à 2 px.
- **Halo de marque** (`0 6px 18px` de la couleur de marque à 32 %) : le bouton principal, le lien actif du menu et la pastille sélectionnée.

### Named Rules
**La règle de l'appli plate.** Dans l'appli, on ne met pas d'ombre sur les cartes : c'est le fond gris qui les détache.

## Shapes

Des angles doux partout, et des pilules pour tout ce qui se touche. Les cartes sont arrondies à 16 px (20 px pour les grandes cartes du bureau), les champs à 12 px, les badges à 6 px. Les boutons et les pastilles sont des pilules complètes. Les bulles de discussion gardent un coin plus serré (5 px) du côté de l'auteur.

## Components

### Buttons
- **Shape :** une pilule complète (rayon égal à la moitié de la hauteur).
- **Primary :** fond de la couleur de l'association, texte blanc en 600, 50 px de haut et 20 px de marge intérieure. La version compacte fait 38 px et 14 px.
- **Secondary / Plain / Destructive :** fond pâle de la marque, texte seul (44 px de haut au moins) ou rouge pour supprimer.
- **Sur fond coloré :** `light` (blanc plein), `glass` (blanc translucide) et `lightPlain` (texte blanc seul), pour l'écran de connexion et la visite guidée.
- **Bureau :** rayon de 11 px. Le bouton principal a un léger dégradé vertical de la couleur de marque et son halo. Au survol, il monte de 1 px.

### Chips
- **Style :** une pilule de 34 px, fond gris de remplissage et texte en 600.
- **State :** une fois sélectionnée, elle prend la couleur de l'association en plein et le texte blanc. Sur la bande d'en-tête, elle devient blanche, avec le texte de la couleur de la bande. Dans le bureau, elle rétrécit d'un cran quand on appuie.

### Cards / Containers
- **Corner Style :** 16 px (appli), 20 px (bureau).
- **Background :** blanc (card / panel).
- **Shadow Strategy :** aucune dans l'appli, « Repos » dans le bureau (voir Elevation & Depth).
- **Border :** aucune dans l'appli, un filet de 1 px (bureau-line) dans le bureau.
- **Internal Padding :** 16 px (appli), 22 × 24 px (bureau).

### Inputs / Fields
- **Style :** fond gris de remplissage, sans bordure, rayon de 12 px et 48 px de haut, texte en 17 px. L'étiquette est en 13 px gris au-dessus du champ.
- **Focus :** dans le bureau, un anneau de 4 px de la couleur de marque à 16 %.
- **Error :** un message rouge (bad) sous le champ, lu par les lecteurs d'écran.

### Navigation
- **Appli :** une barre d'onglets native en bas (sur le côté sur l'iPhone Duo fermé), et une bande d'en-tête de la couleur de l'association avec un titre blanc.
- **Bureau :** un menu latéral en pastilles. Le lien actif est plein, de la couleur de marque, avec son halo ; le survol le teinte à 7 %. Les intitulés de groupe sont en capitales de 10,5 px.

### Tuiles d'indicateurs (bureau)
Chaque chiffre clé a sa propre tuile blanche arrondie à 16 px, avec un filet de couleur de 3 px en haut qui porte son sens (vert, ambre, rouge, bleu, marque). Le chiffre est en Sora de 26 px et la légende en 12 px gris.

### Badges et pastilles d'état
Le badge est un petit rectangle arrondi à 6 px, en 12 px gras, avec un fond pâle et le texte de la même couleur d'état (ok-soft / ok, warn-soft / warn, etc.).

### Créneaux de présence
Un créneau est une pastille arrondie qui donne l'heure et l'état. L'état est toujours écrit, pour qu'on le comprenne sans la couleur :
- **« Vous »** : la couleur de l'association en plein, avec le texte blanc.
- **« N places libres »** : fond vert pâle (ok-soft), texte vert (ok).
- **« Dernière place »** : fond ambre pâle (warn-soft), texte ambre (warn).
- **« Complet »** : fond gris (neutral-soft), texte gris (bureau-muted). On ne peut pas le toucher.
- **Vu du bureau** (la grille de l'espace bureau) : on regarde les trous. Une case remplie est verte, une case où il manque du monde est ambre et affiche « 1/2 », une tranche sans besoin est grise.
- **Le seul effet de l'écran** : quand l'adhérent prend un créneau, la pastille passe en « Vous » avec un léger rebond (moins de 300 ms) et une petite vibration du téléphone. Les deux se coupent quand l'utilisateur a demandé moins d'animations.

## Do's and Don'ts

### Do:
- **Do** lire les couleurs dans le thème (`useTheme().colors` dans l'appli, `var(--brand)` et les autres variables dans le bureau), jamais en dur.
- **Do** donner à chaque couleur d'état son sens fixe : vert = bon, ambre = à surveiller, rouge = urgent.
- **Do** réutiliser les briques de `app/src/components/ui/` (Button, Card, Badge, ChipBar, TextField, états vides et d'erreur) et les classes du bureau (`.card`, `.kpi`, `.chip`, `.pill`, `.badge`, `.tile`).
- **Do** garder 44 px au moins pour toute zone qu'on touche, et un focus visible au clavier dans le bureau.
- **Do** garder des mouvements brefs (moins de 300 ms), et les couper quand l'utilisateur a demandé moins d'animations.

### Don't:
- **Don't** mettre d'ombre sur les cartes de l'appli.
- **Don't** utiliser une couleur d'état pour décorer, ni rouge et vert ensemble sans autre indice (un mot ou une icône) pour les daltoniens.
- **Don't** ajouter de dégradé plaqué sans raison, d'emoji décoratif ou de cartes toutes identiques. Seuls le halo du fond du bureau et le léger dégradé du bouton principal sont prévus.
- **Don't** étirer le contenu de l'appli au-delà de 640 px de large.
