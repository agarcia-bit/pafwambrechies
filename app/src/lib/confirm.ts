import { Alert, Platform } from 'react-native';

// Alert.alert is a no-op on react-native-web: fall back to the browser dialogs.

export function showMessage(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

export function confirmAction(options: {
  title: string;
  message?: string;
  confirmLabel: string;
  destructive?: boolean;
}): Promise<boolean> {
  const { title, message, confirmLabel, destructive } = options;
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(message ? `${title}\n\n${message}` : title));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

/**
 * Une question à plusieurs réponses (ex. « Chercher un remplaçant » ou « Libérer ma place ») ;
 * rend la valeur choisie, ou null si la personne annule. Sur le web, une suite de confirmations.
 */
export function choisirParmi<T extends string>(options: {
  title: string;
  message?: string;
  choix: { label: string; valeur: T; destructive?: boolean }[];
}): Promise<T | null> {
  const { title, message, choix } = options;
  if (Platform.OS === 'web') {
    const retenu = choix.find((c) => window.confirm(`${title}\n\n${c.label} ?`));
    return Promise.resolve(retenu?.valeur ?? null);
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        ...choix.map((c) => ({ text: c.label, style: c.destructive ? ('destructive' as const) : ('default' as const), onPress: () => resolve(c.valeur) })),
        { text: 'Annuler', style: 'cancel' as const, onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) }
    );
  });
}
