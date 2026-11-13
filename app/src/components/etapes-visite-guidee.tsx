import type { ReactNode } from 'react';

import { associationName } from '@/components/association';
import {
  ActusArt,
  AgendaArt,
  AnnuaireArt,
  OffresArt,
  PlusArt,
  type PlusRow,
  SondageArt,
  WelcomeArt,
} from '@/components/tour-illustrations';
import { useMember } from '@/lib/session';
import { useTenantConfig } from '@/lib/tenant-config';

// Le contenu de la visite guidée (components/guided-tour.tsx) : un écran par partie de l'app,
// selon les sections que l'association a activées. Seulement ce que tout adhérent peut faire.

export type EtapeDeLaVisite = { key: string; art: (active: boolean) => ReactNode; title: string; text: string; tip?: string };

export function useEtapesDeLaVisite(): EtapeDeLaVisite[] {
  const { branding } = useMember();
  const { modules, labels, cotisations } = useTenantConfig();
  const name = associationName(branding) || 'votre association';
  const { mySpace, resources, spaceText, resourcesText } = contenuDuPlus(modules, cotisations.enabled);
  const sentence = (parts: string[]) =>
    parts.length ? `${parts.slice(0, -1).join(', ')}${parts.length > 1 ? ' et ' : ''}${parts[parts.length - 1]}`.replace(/^./, (c) => c.toUpperCase()) + '.' : '';

  return [
    {
      key: 'welcome',
      art: (active) => <WelcomeArt active={active} name={name} logo={branding?.tenant_logo_url} />,
      title: `Bienvenue dans ${name}`,
      text: 'Toute la vie de votre association, dans votre poche. Faisons le tour en une minute.',
    },
    {
      key: 'actus',
      art: (active) => <ActusArt active={active} />,
      title: 'Les actus',
      text: 'Les nouvelles de l’association arrivent dans le fil, avec une notification. Aimez, commentez, partagez.',
      tip: 'Une nouvelle à partager ? Proposez-la dans « Plus » > « Mes actus » : le bureau la publie.'
    },
    ...(modules.agenda
      ? [
          {
            key: 'agenda',
            art: (active: boolean) => <AgendaArt active={active} />,
            title: 'L’agenda',
            text: 'Tous les événements à venir, avec la date, l’heure et le lieu. Une notification vous prévient de chaque nouvel événement.',
            tip: 'Répondez Présent, Absent ou Je ne sais pas ; sur plusieurs jours, choisissez vos jours.',
          },
        ]
      : []),
    ...(modules.offres
      ? [
          {
            key: 'offres',
            art: (active: boolean) => <OffresArt active={active} />,
            title: labels.offres,
            text: 'Les bons plans réservés aux adhérents, entre membres de l’association.',
            tip: 'Proposez les vôtres dans « Plus » > « Mes offres » : le bureau les valide.',
          },
        ]
      : []),
    ...(modules.annuaire
      ? [
          {
            key: 'annuaire',
            art: (active: boolean) => <AnnuaireArt active={active} />,
            title: labels.annuaire,
            text: 'Retrouvez les membres de l’association, appelez-les ou écrivez-leur en un geste.',
            tip: 'Complétez votre fiche dans « Plus » > « Ma fiche annuaire ».',
          },
        ]
      : []),
    {
      key: 'sondage',
      art: (active) => <SondageArt active={active} />,
      title: 'Votre avis compte',
      text: 'Quand le bureau lance un sondage, il s’affiche à l’ouverture de l’application. Une réponse suffit.',
      tip: modules.idees ? 'Une idée pour l’association ? Proposez-la dans la boîte à idées.' : undefined,
    },
    {
      key: 'mon-espace',
      art: (active) => <PlusArt active={active} rows={mySpace} />,
      title: 'Votre espace, dans « Plus »',
      text: `${sentence(spaceText)} Dans « Mon compte » : vos notifications, les membres que vous avez bloqués, et la suppression de votre compte si besoin.`.trim(),
    },
    {
      key: 'ressources',
      art: (active) => <PlusArt active={active} rows={resources} />,
      title: 'Les ressources de l’association',
      text: resourcesText.length ? `Toujours dans « Plus » : ${resourcesText.join(', ')}.` : 'Toujours dans « Plus », tout ce que l’association met à votre disposition.',
      tip: 'Vous pourrez revoir cette visite à tout moment : « Plus » > « Visite guidée ».',
    },
  ];
}

/** Les deux derniers écrans montrent les vraies lignes de « Plus », avec à quoi sert chacune. */
function contenuDuPlus(modules: ReturnType<typeof useTenantConfig>['modules'], avecCotisations: boolean) {
  const mySpace: PlusRow[] = [
    ...(modules.annuaire ? [{ icon: 'people' as const, label: 'Ma fiche annuaire', detail: 'Photo, coordonnées, description', highlight: true }] : []),
    { icon: 'newspaper', label: 'Mes actus', detail: 'Proposer une nouvelle au bureau' },
    ...(modules.offres ? [{ icon: 'tag' as const, label: 'Mes offres', detail: 'Proposer un bon plan aux adhérents' }] : []),
    ...(avecCotisations ? [{ icon: 'card' as const, label: 'Ma cotisation', detail: 'Où en est votre adhésion, comment renouveler' }] : []),
    { icon: 'person', label: 'Mon compte', detail: 'Notifications, membres bloqués, suppression' },
  ];
  const resources: PlusRow[] = [
    ...(modules.idees ? [{ icon: 'lightbulb' as const, label: 'Boîte à idées', detail: 'Proposer, soutenir, commenter', highlight: true }] : []),
    ...(modules.documents ? [{ icon: 'document' as const, label: 'Documents', detail: 'Statuts, comptes rendus, règlements…' }] : []),
    ...(modules.liens ? [{ icon: 'link' as const, label: 'Liens utiles', detail: 'Les sites de l’association' }] : []),
    { icon: 'info', label: 'Visite guidée', detail: 'Revoir cette présentation' },
  ];
  const spaceText = [
    modules.annuaire && 'tenez votre fiche à jour',
    'proposez vos actus',
    modules.offres && 'proposez vos offres',
    avecCotisations && 'suivez votre cotisation',
  ].filter(Boolean) as string[];
  const resourcesText = [
    modules.idees && 'proposez vos idées et soutenez celles des autres',
    modules.documents && 'consultez les documents de l’association',
    modules.liens && 'retrouvez ses liens utiles',
  ].filter(Boolean) as string[];
  return { mySpace, resources, spaceText, resourcesText };
}
