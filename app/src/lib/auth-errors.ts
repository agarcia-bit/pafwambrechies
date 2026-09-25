import { isAuthApiError, isAuthRetryableFetchError, type AuthError } from '@supabase/supabase-js';

/** French message for a Supabase Auth error shown on the login and signup screens. */
export function authErrorMessage(error: AuthError): string {
  if (isAuthRetryableFetchError(error)) return 'Pas de connexion internet. Réessayez.';
  if (!isAuthApiError(error)) return 'Une erreur est survenue. Réessayez.';
  switch (error.code) {
    case 'invalid_credentials':
      return 'Email ou mot de passe incorrect.';
    case 'email_not_confirmed':
      return "Confirmez d'abord votre adresse email avec le lien reçu par email.";
    case 'user_already_exists':
    case 'email_exists':
      return 'Un compte existe déjà avec cet email. Connectez-vous, ou utilisez « Mot de passe oublié ».';
    case 'weak_password':
      return 'Mot de passe trop faible : 8 caractères minimum.';
    case 'same_password':
      return "Choisissez un mot de passe différent de l'ancien.";
    case 'email_address_invalid':
    case 'validation_failed':
      return 'Adresse email invalide.';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Trop de tentatives. Réessayez dans quelques minutes.';
    case 'unexpected_failure':
      // handle_new_user rejects the signup when the access code is not valid.
      return "Code d'accès invalide. Vérifiez-le auprès de votre association.";
    default:
      return error.message || 'Une erreur est survenue. Réessayez.';
  }
}
