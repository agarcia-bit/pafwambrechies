# Planning Restaurant

## Projet
Outil de génération automatique de planning pour restaurants, respectant la convention collective HCR et les contraintes individuelles des salariés.

## Stack technique
- **Frontend** : React 19 + TypeScript + Vite + Tailwind CSS v4
- **State** : Zustand
- **Backend DB** : Supabase (PostgreSQL + Auth + RLS multi-tenant)
- **Solveur** : Google OR-Tools CP-SAT (Python FastAPI) déployé sur Render
- **Export** : ExcelJS
- **Tests** : Vitest

## Architecture

```
src/
  domain/          # Cœur métier (zéro dépendance React)
    models/        # Types : Employee, Shift, Planning, Role, Constraint, Tenant
    rules/         # Règles légales HCR + productivité
    engine/        # Algorithme local TS (fallback si CP-SAT indisponible)
  infrastructure/  # Supabase client, repositories, export Excel, API solver
    supabase/repositories/  # employee-repo, role-repo, shift-template-repo, constraint-repo, forecast-repo, planning-repo
    api/           # solver-api.ts (appel backend CP-SAT)
    export/        # excel-export.ts
  ui/              # Composants React, pages, layouts
    components/    # Button, Input, Card, Select, PlanningGrid, EmployeeForm
    pages/         # dashboard, employees, roles, shift-templates, constraints, forecasts, planning, kitchen-planning, settings, login
    layouts/       # main-layout (sidebar sombre + contenu)
  store/           # Zustand (auth, employees, roles, shift-templates, forecasts)
  lib/             # Utilitaires (cn)
backend/           # Python FastAPI + OR-Tools CP-SAT
  main.py          # Endpoints /health, /solve, /solve-kitchen
  solver.py        # Solveur CP-SAT salle
  kitchen_solver.py # Solveur CP-SAT cuisine
  models.py        # Pydantic models
supabase/
  migrations/      # Schema SQL avec RLS multi-tenant
```

## Base de données (Supabase)
- **Projet** : jynhrlslkpmpyvtyiqve (région eu-west-3)
- **Tenant** : a89a90c3-7bfc-4662-a3de-9e00f5031203 (Restaurant Test)
- **Tables** : tenants, profiles, employees, roles, employee_roles, shift_templates, unavailabilities, conditional_availabilities, manager_fixed_schedules, daily_forecasts, daily_requirements, plannings, planning_entries
- **RLS** : isolation multi-tenant via `public.get_tenant_id()`
- **Trigger** : `handle_new_user` crée automatiquement un profil à l'inscription

## Backend CP-SAT (Render)
- **URL** : https://planning-restaurant-solver.onrender.com
- **Free tier** : cold start ~50s après inactivité
- **Endpoints** :
  - `GET /health` → `{"status":"ok","solver":"CP-SAT"}`
  - `POST /solve` → planning salle (contraintes dures + soft)
  - `POST /solve-kitchen` → planning cuisine (shifts coupés midi/soir)
- **Variable env frontend** : `VITE_SOLVER_URL`

## Départements
- **Salle** : managers (horaires fixes), serveurs, barmans, runners — règles couverture/ouverture/fermeture
- **Cuisine** : cuisiniers — shifts coupés midi (9→15) + soir (18→23), pas de règles de couverture

## Règles métier salle (CP-SAT)

### Contraintes dures
- Repos 11h entre shifts consécutifs
- Bornes contrat : heures planifiées >= contrat de base (jamais en dessous)
- Max 5 jours travaillés (temps plein), modulable pour temps partiel
- Indisponibilités fixes et ponctuelles
- Disponibilités conditionnelles (créneaux autorisés par jour)
- 1 personne à l'ouverture (9h30) chaque jour
- Managers : horaires fixes recopiés (Matthieu repos mardi, Christophe repos mercredi)

### Contraintes soft (optimisées)
- Fermeture : 4 personnes Mar-Mer, 6 personnes Jeu-Dim
- Couverture continue ≥2 de 11h à fermeture
- Variété des shifts (éviter même créneau 2 jours de suite)
- Heures proches du contrat
- **Productivité équilibrée** : pénalise l'écart CA/heures par rapport à la cible (95), pondéré par CA du jour
- Min staff midi/soir/fermeture (configurable par jour dans l'UI)

### Contraintes cuisine
- Shifts coupés autorisés (midi + soir même jour)
- Repos 11h = soft constraint (intégré dans les horaires)
- Chaker/Bauer/Ibra ensemble le mardi matin (préparation)
- Dimanche soir fermé

## Indicateur productivité semaine
- Calcul : CA total semaine / heures contrat de base
- < 85 : Orange "Délester des heures"
- 85-110 : Vert "Effectif suffisant"
- > 110 : Rouge "Envisager un renfort"

## Productivité par jour (grille)
- 85-110 : Vert
- < 85 ou > 110 : Rouge

## Pages principales

### Planning salle
1. Sélecteur de semaine
2. Contraintes de la semaine (par jour, fixes en orange, ponctuelles en rouge)
3. CA prévisionnel + ajustement % (-100 à +100) + mini service midi/soir/fermeture (0-15)
4. Indicateur productivité semaine
5. Boutons : Générer (animation 3s) + Enregistrer + Exporter Excel
6. Grille planning interactive (clic pour modifier shift via dropdown)
7. Tableau productivité par jour
8. Violations + avertissements

### Planning cuisine
- Même structure, shifts côte à côte (midi gauche, soir droite)
- Contraintes ponctuelles ajoutables
- Enregistrement séparé (department='cuisine')

### Dashboard
- Stat cards (salariés actifs, managers, équipe salle)
- Historique plannings avec badge Salle/Cuisine
- Séparateur entre semaines
- Clic pour ouvrir le planning dans le bon onglet

## Design
- Sidebar sombre (slate-900), couleur primaire indigo
- Fond gris clair (slate-50), cartes blanches arrondies 2xl
- Ombres multi-couche subtiles
- OFF en rouge léger (red-100), shifts en bleu (blue-100)
- Cuisine : ambre (amber-100 midi, amber-600 soir)

## Commandes

```bash
# Frontend
cd planning-restaurant
npm install
npm run dev        # http://localhost:5173
npm run build
npm test           # Vitest

# Backend (local)
cd backend
pip install -r requirements.txt
python3 -m uvicorn main:app --reload --port 8000

# Déploiement backend : auto-deploy sur Render via push sur main
```

## Variables d'environnement (.env)
```
VITE_SUPABASE_URL=https://jynhrlslkpmpyvtyiqve.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_SOLVER_URL=https://planning-restaurant-solver.onrender.com
```

## Compte test
- Email : gerant@restaurant-test.fr
- Mot de passe : Planning2026!

## Repos
- **Frontend** : github.com/agarcia-bit/planning-restaurant (branche main)
- **Dev** : github.com/agarcia-bit/pafwambrechies (branche claude/architect-role-setup-v6ogE)
