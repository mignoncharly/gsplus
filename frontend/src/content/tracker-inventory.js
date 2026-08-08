export const TRACKER_INVENTORY_VERSION = '2026-08-08';

export const OPTIONAL_TRACKERS_ENABLED = false;

export const TRACKER_INVENTORY = [
  {
    id: 'admin-session',
    name: '__Host-gsp_admin_session',
    classification: 'STRICTLY_NECESSARY',
    classificationLabel: 'Strictement nécessaire',
    mechanism: 'Cookie de session administrateur',
    provider: 'Golden Studio Plus',
    scope: 'Espace d’administration uniquement, après authentification',
    purpose: 'Authentifier la session privée, appliquer les permissions et permettre la révocation côté serveur.',
    storage: 'Cookie HttpOnly, Secure, SameSite=Strict, Path=/, sans attribut Domain',
    lifetime: '8 heures au maximum; suppression à la déconnexion',
    publicSite: false,
    consentRequired: false,
    defaultEnabled: true,
    externalOrigins: [],
  },
  {
    id: 'google-fonts',
    name: 'Google Fonts',
    classification: 'NON_TRACKING_EXTERNAL_RESOURCE',
    classificationLabel: 'Ressource externe sans finalité de traçage',
    mechanism: 'Feuille de style et fichiers de police',
    provider: 'Google',
    scope: 'Pages publiques et privées',
    purpose: 'Charger les typographies Great Vibes, Montserrat et Playfair Display.',
    storage: 'Aucun cookie ou stockage navigateur créé par l’application; requêtes HTTPS de ressources observées.',
    lifetime: 'Cache HTTP géré par le navigateur et le fournisseur',
    publicSite: true,
    consentRequired: false,
    defaultEnabled: true,
    externalOrigins: ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
  },
];

export const OPTIONAL_TRACKERS = TRACKER_INVENTORY.filter(
  (entry) => entry.classification === 'OPTIONAL',
);
