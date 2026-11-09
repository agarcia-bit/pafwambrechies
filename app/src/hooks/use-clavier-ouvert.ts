import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/** Vrai tant que le clavier est à l'écran. Sur iOS, on réagit dès qu'il commence à monter. */
export function useClavierOuvert() {
  const [estOuvert, setEstOuvert] = useState(false);
  useEffect(() => {
    const ouverture = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setEstOuvert(true));
    const fermeture = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setEstOuvert(false));
    return () => {
      ouverture.remove();
      fermeture.remove();
    };
  }, []);
  return estOuvert;
}
