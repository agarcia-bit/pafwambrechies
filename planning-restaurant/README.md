# Planning Restaurant

Outil de generation automatique de planning pour les restaurants, respectant la convention collective HCR et les contraintes individuelles des salaries.

## Stack

- **Frontend** : React 19 + TypeScript + Vite
- **UI** : Tailwind CSS v4
- **State** : Zustand
- **Backend** : Supabase (PostgreSQL + Auth + RLS)
- **Export** : ExcelJS
- **Tests** : Vitest

## Setup

```bash
# Installation
npm install

# Copier les variables d'environnement
cp .env.example .env
# Remplir VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY

# Developpement
npm run dev

# Tests
npm test

# Build
npm run build
```

## Structure

```
src/
  domain/          # Coeur metier (zero dependance React)
    models/        # Types : Employee, Shift, Planning, etc.
    rules/         # Regles legales HCR + productivite
    engine/        # Algorithme de generation de planning
  infrastructure/  # Supabase client, repositories, export Excel
  ui/              # Composants React, pages, layouts
  store/           # Zustand (auth, employees)
  lib/             # Utilitaires (cn, etc.)
tests/
  domain/          # Tests unitaires du coeur metier
supabase/
  migrations/      # Schema SQL avec RLS multi-tenant
```

## Regles metier implementees

- Convention HCR : repos 11h, 2 jours off/semaine, max 48h, max 6 jours consecutifs
- Modulation contractuelle +/- 5h/semaine
- Creneaux horaires en liste fermee (configurable par restaurant)
- Productivite = CA / heures (cible 95, bornes 80-100)
- Delestage ordonne quand heures insuffisantes
- Managers : horaires fixes, recopies tels quels
- Multi-tenant avec isolation RLS
