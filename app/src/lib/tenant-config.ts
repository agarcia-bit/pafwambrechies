import { useMember } from '@/lib/session';
import type { Branding } from '@/lib/types';

// What an association shows and how it names things, so the same app fits a
// shopkeepers' association, a sports club or anything else. The settings come
// with the branding (see supabase/tenant_app_config.sql); an association that
// has set nothing gets every section and neutral wording.

export type ModuleKey = 'annuaire' | 'offres' | 'agenda' | 'idees' | 'liens';

export type TenantConfig = {
  modules: Record<ModuleKey, boolean>;
  labels: { annuaire: string; offres: string; nom: string };
  /** Filters of the directory and of the offers; empty = no categories. */
  categories: { annuaire: string[]; offres: string[] };
  /** Membership dues: off unless the association turns them on. */
  cotisations: { enabled: boolean; url: string; montant: string; libelle: string; ouverture: string; fin: string };
};

/** Stored category when an association uses none (the column cannot be empty). */
export const DEFAULT_CATEGORY = 'Général';

export const MODULE_KEYS: ModuleKey[] = ['annuaire', 'offres', 'agenda', 'idees', 'liens'];

export function parseList(value: string | undefined): string[] {
  const items = (value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
  return [...new Set(items)];
}

export function tenantConfig(branding: Branding | null | undefined): TenantConfig {
  const b: Partial<Branding> = branding ?? {};
  const on = (value: string | undefined) => value?.trim().toLowerCase() !== 'off';
  const text = (value: string | undefined, fallback: string) => value?.trim() || fallback;
  return {
    modules: {
      annuaire: on(b.module_annuaire),
      offres: on(b.module_offres),
      agenda: on(b.module_agenda),
      idees: on(b.module_idees),
      liens: on(b.module_liens),
    },
    labels: {
      annuaire: text(b.label_annuaire, 'Annuaire'),
      offres: text(b.label_offres, 'Offres'),
      nom: text(b.label_nom, 'Nom'),
    },
    categories: { annuaire: parseList(b.annuaire_categories), offres: parseList(b.offres_categories) },
    cotisations: {
      enabled: b.module_cotisations?.trim().toLowerCase() === 'on',
      // Only an https page can be opened for payment.
      url: /^https:\/\//i.test(b.cotisation_url?.trim() ?? '') ? (b.cotisation_url ?? '').trim() : '',
      montant: b.cotisation_montant?.trim() ?? '',
      libelle: b.cotisation_libelle?.trim() ?? '',
      ouverture: b.cotisation_ouverture?.trim() ?? '',
      fin: b.cotisation_fin?.trim() ?? '',
    },
  };
}

/** Configuration of the signed-in member's association. */
export function useTenantConfig(): TenantConfig {
  const { branding } = useMember();
  return tenantConfig(branding);
}
