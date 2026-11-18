import { useState } from 'react';

import type { Collection } from '@/lib/admin';
import { showMessage } from '@/lib/confirm';
import { choisirPhoto, preparerPhoto, type PhotoChoisie, type PickedPhoto } from '@/lib/photos';
import type { Zone } from '@/lib/recadrage';

/**
 * La photo d'un formulaire du bureau ou de sa fiche. Une fiche de l'annuaire (photo coupée en
 * 4:3) passe d'abord par l'écran de cadrage ; les autres photos sont prêtes aussitôt.
 */
export function usePhotoDuFormulaire(c: Collection) {
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [picking, setPicking] = useState(false);
  const [aCadrer, setACadrer] = useState<PhotoChoisie | null>(null);

  async function preparer(choisie: PhotoChoisie, zone?: Zone) {
    setPicking(true);
    try {
      setPhoto(await preparerPhoto(choisie, { outputWidth: c.photo?.width, crop: c.photo?.crop, zone }));
    } catch {
      showMessage('Photo illisible', 'Choisissez une autre photo.');
    }
    setPicking(false);
  }

  async function choosePhoto() {
    let choisie: PhotoChoisie | null = null;
    try {
      choisie = await choisirPhoto();
    } catch {
      showMessage('Photo illisible', 'Choisissez une autre photo.');
    }
    if (!choisie) return;
    if (c.photo?.crop === true) setACadrer(choisie);
    else await preparer(choisie);
  }

  function validerLeCadrage(zone: Zone) {
    const choisie = aCadrer;
    setACadrer(null);
    if (choisie) void preparer(choisie, zone);
  }

  return { photo, setPhoto, picking, choosePhoto, aCadrer, validerLeCadrage, annulerLeCadrage: () => setACadrer(null) };
}
