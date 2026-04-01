# Cahier de Recette – PAF Wambrechies
**Application** : PWA Espace Adhérents PAF Wambrechies  
**URL de recette** : https://paf-wambrechies.netlify.app  
**Méthode** : Gherkin (Given / When / Then)

---

## FEATURE 1 – Authentification

### Scénario 1.1 – Connexion réussie
```gherkin
Given je suis sur la page de connexion
  And je possède un compte adhérent actif (email + mot de passe)
When je saisis mon email et mon mot de passe corrects
  And je clique sur "Se connecter"
Then je suis redirigé vers l'application
  And l'onglet "Actus" est affiché par défaut
  And le logo PAF et le bandeau orange sont visibles en haut
```

### Scénario 1.2 – Identifiants incorrects
```gherkin
Given je suis sur la page de connexion
When je saisis un email ou un mot de passe incorrect
  And je clique sur "Se connecter"
Then un message d'erreur rouge s'affiche sous le formulaire
  And je reste sur la page de connexion
```

### Scénario 1.3 – Champs vides
```gherkin
Given je suis sur la page de connexion
When je laisse l'email ou le mot de passe vide
  And je clique sur "Se connecter"
Then le formulaire ne se soumet pas
  And le champ manquant est mis en évidence
```

### Scénario 1.4 – Déconnexion
```gherkin
Given je suis connecté à l'application
When je clique sur l'icône de déconnexion (haut droite)
Then je suis redirigé vers la page de connexion
  And l'accès à l'application est bloqué sans reconnexion
```

### Scénario 1.5 – Session persistante
```gherkin
Given je me suis connecté précédemment
When je ferme et rouvre le navigateur
Then je suis automatiquement reconnecté
  And l'application s'affiche sans redemander mes identifiants
```

---

## FEATURE 2 – Navigation

### Scénario 2.1 – Changement d'onglet
```gherkin
Given je suis sur n'importe quel onglet
When je clique sur un autre onglet dans la barre de navigation basse
Then la section correspondante s'affiche
  And la page remonte automatiquement en haut
  And l'onglet actif est mis en surbrillance orange
```

### Scénario 2.2 – Remise en haut après scroll
```gherkin
Given je suis sur l'onglet "Annuaire" et j'ai scrollé vers le bas
When je clique sur l'onglet "Idées"
Then la page s'affiche depuis le haut
  And je ne suis pas au milieu du contenu précédent
```

---

## FEATURE 3 – Actualités

### Scénario 3.1 – Affichage de la liste
```gherkin
Given je suis connecté
When je clique sur l'onglet "Actus"
Then la liste des actualités s'affiche par ordre chronologique décroissant
  And chaque actu affiche : catégorie, date, titre, extrait
```

### Scénario 3.2 – Développer une actualité
```gherkin
Given la liste des actualités est affichée
When je clique sur une actualité
Then le contenu complet se déplie sous l'extrait
  And le bouton affiche "Réduire"
When je clique à nouveau
Then le contenu se referme
```

---

## FEATURE 4 – Annuaire PAF

### Scénario 4.1 – Affichage de la liste
```gherkin
Given je clique sur l'onglet "Annuaire"
Then la liste des commerçants s'affiche par ordre alphabétique
  And chaque fiche affiche : catégorie, nom, description, adresse, téléphone
```

### Scénario 4.2 – Filtrage par catégorie
```gherkin
Given l'annuaire est affiché avec les chips de catégories
When je clique sur une catégorie (ex : "Restauration")
Then seuls les commerçants de cette catégorie s'affichent
  And le chip sélectionné passe en bleu navy
```

### Scénario 4.3 – Recherche par nom
```gherkin
Given l'annuaire est affiché
When je saisis un texte dans la barre de recherche
Then la liste se filtre en temps réel
  And seuls les commerçants dont le nom ou la description contient ce texte s'affichent
```

### Scénario 4.4 – Aucun résultat
```gherkin
Given j'ai appliqué un filtre ou une recherche
When aucun commerçant ne correspond
Then un message "Aucun résultat trouvé" s'affiche
```

---

## FEATURE 5 – Offres exclusives

### Scénario 5.1 – Affichage des offres
```gherkin
Given je clique sur l'onglet "Offres"
Then la liste des offres s'affiche
  And chaque offre affiche : commerçant, titre, description, date d'expiration, tag
```

### Scénario 5.2 – Filtre Particulier / Professionnel
```gherkin
Given les offres sont affichées avec les chips "Tous / Particulier / Professionnel"
When je clique sur "Particulier"
Then seules les offres avec categorie = "Particulier" s'affichent
When je clique sur "Professionnel"
Then seules les offres avec categorie = "Professionnel" s'affichent
When je clique sur "Tous"
Then toutes les offres s'affichent à nouveau
```

---

## FEATURE 6 – Boîte à idées

### Scénario 6.1 – Affichage par défaut
```gherkin
Given je clique sur l'onglet "Idées"
Then la liste des idées soumises s'affiche directement
  And le formulaire de soumission est masqué
  And un bouton "Proposer" est visible en haut à droite
```

### Scénario 6.2 – Ouvrir / fermer le formulaire
```gherkin
Given je suis sur l'onglet "Idées"
When je clique sur "Proposer"
Then le formulaire de soumission s'affiche
  And le curseur se positionne dans le champ "Nom de l'idée"
When je clique à nouveau sur "Proposer"
Then le formulaire se referme
```

### Scénario 6.3 – Soumettre une idée
```gherkin
Given le formulaire est ouvert
  And je suis connecté avec un profil renseigné (prénom + nom entreprise)
When je remplis le "Nom de l'idée" et le "Descriptif"
  And je sélectionne une thématique
  And je clique sur "Soumettre mon idée"
Then l'idée apparaît dans la liste
  And l'auteur affiché est "Prénom - NOM ENTREPRISE"
  And le titre est affiché en gras
  And le descriptif est affiché en dessous
  And le formulaire se referme automatiquement
```

### Scénario 6.4 – Champs obligatoires
```gherkin
Given le formulaire est ouvert
When je clique sur "Soumettre" sans remplir le titre ou le descriptif
Then le formulaire ne se soumet pas
  And le focus se positionne sur le premier champ manquant
```

### Scénario 6.5 – Liker une idée
```gherkin
Given une idée est affichée dans la liste
When je clique sur le bouton cœur
Then le compteur de likes augmente de 1
  And le cœur passe en orange (liked)
When je clique à nouveau
Then le like est retiré et le compteur diminue de 1
```

### Scénario 6.6 – Commenter une idée
```gherkin
Given une idée est affichée
When je clique sur le bouton commentaire
Then la zone de commentaires se déplie
When je saisis un commentaire et je l'envoie
Then le commentaire apparaît dans la liste avec mon nom "Prénom - NOM ENTREPRISE"
  And le compteur de commentaires augmente de 1
  And le champ de saisie se vide
```

### Scénario 6.7 – Mise à jour en temps réel
```gherkin
Given deux adhérents sont connectés simultanément sur l'onglet "Idées"
When l'adhérent A like ou commente une idée
Then l'adhérent B voit le compteur mis à jour sans recharger la page
  And la section commentaires de B ne se referme pas
```

---

## FEATURE 7 – Calendrier

### Scénario 7.1 – Affichage du calendrier
```gherkin
Given je clique sur l'onglet "Agenda"
Then le calendrier du mois en cours s'affiche
  And les jours ayant un événement ont un point orange
  And la liste des prochains événements s'affiche en dessous
```

### Scénario 7.2 – Navigation entre les mois
```gherkin
Given le calendrier est affiché
When je clique sur la flèche "suivant" ou "précédent"
Then le mois change et la grille se met à jour
```

### Scénario 7.3 – Clic sur un jour avec événement
```gherkin
Given le calendrier est affiché
When je clique sur un jour qui a un point orange
Then un panneau s'affiche sous le calendrier
  And il liste les événements de ce jour avec heure et lieu
```

### Scénario 7.4 – Ajouter un événement à l'agenda
```gherkin
Given un événement est affiché dans "Prochains événements"
When je clique sur "Ajouter à mon agenda"
Then un fichier .ics est téléchargé
  And un toast de confirmation s'affiche
When j'ouvre le fichier .ics
Then l'événement s'ajoute à l'agenda natif du téléphone (iOS / Android)
```

---

## FEATURE 8 – PWA & Interface

### Scénario 8.1 – Pas de zoom possible
```gherkin
Given l'application est ouverte sur mobile
When je tente un pinch-to-zoom avec deux doigts
Then la page ne zoome pas
```

### Scénario 8.2 – Navigation fluide sur iOS
```gherkin
Given l'application est installée en PWA sur iPhone
When je navigue entre les onglets
Then la barre de navigation reste toujours visible en bas
  And elle ne disparaît pas lors du scroll
```

### Scénario 8.3 – Notifications push
```gherkin
Given je suis connecté et je clique sur l'icône cloche
When j'accepte la demande de permission du navigateur
Then un toast "Notifications activées !" s'affiche
  And mon abonnement est enregistré dans Supabase
```

---

## Matrice de priorité

| # | Feature | Priorité | Bloquant |
|---|---------|----------|---------|
| 1.1 | Connexion réussie | Critique | Oui |
| 1.2 | Identifiants incorrects | Haute | Non |
| 1.4 | Déconnexion | Haute | Non |
| 2.1 | Navigation onglets | Critique | Oui |
| 2.2 | Scroll remise en haut | Moyenne | Non |
| 6.3 | Soumettre une idée | Haute | Non |
| 6.7 | Temps réel likes/commentaires | Moyenne | Non |
| 7.4 | Export agenda .ics | Basse | Non |
| 8.1 | Pas de zoom | Basse | Non |
