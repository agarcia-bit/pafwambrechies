import type { Reponse } from '@/lib/participation';
import { useTheme } from '@/theme';

// Une couleur par réponse à un événement, la même partout : on reconnaît sa réponse d'un coup d'œil.
export function useCouleursDeReponse(): Record<Reponse, string> {
  const { colors } = useTheme();
  return { present: colors.success, absent: colors.danger, indecis: colors.warning };
}
