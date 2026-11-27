import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

import { doitReessayer, estJetonExpire } from '@/lib/jeton-expire';
import { supabase } from '@/lib/supabase';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // Un jeton expiré se répare en renouvelant la connexion : on le fait avant de relancer.
      retry: (tentativesRatees, erreur) => {
        if (estJetonExpire(erreur)) supabase.auth.refreshSession().then(() => undefined);
        return doitReessayer(tentativesRatees, erreur);
      },
    },
  },
});

// Dès que la connexion est renouvelée, on recharge les écrans restés vides à cause d'une erreur,
// sans attendre que le membre ferme et rouvre l'app.
supabase.auth.onAuthStateChange((evenement) => {
  if (evenement !== 'TOKEN_REFRESHED') return;
  queryClient.refetchQueries({ predicate: (requete) => requete.state.status === 'error' });
});

// Refetch stale data when the app comes back to the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (status) => {
    focusManager.setFocused(status === 'active');
  });
}
