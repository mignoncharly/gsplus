export const LEGAL_LAST_UPDATED = '31 juillet 2026';
export const LEGAL_MENTIONS_LAST_UPDATED = '31 juillet 2026';
export const PRIVACY_LAST_UPDATED = '31 juillet 2026';
export const TERMS_LAST_UPDATED = '31 juillet 2026';

export const PRIVACY_CONTACT = {
  email: 'info@gsplus.vip',
  phone: '+237 673 026 654',
  whatsapp: 'https://wa.me/237673026654',
};

export const HOSTING_PROVIDER = {
  name: 'Hetzner Online GmbH',
  address: 'Industriestr. 25, 91710 Gunzenhausen, Allemagne',
  phone: '+49 9831 505-0',
  email: 'info@hetzner.com',
  website: 'https://www.hetzner.com',
  registry: 'Registre d’Ansbach, HRB 6089',
};

export const DATA_RETENTION = [
  {
    category: 'Demandes de contact et de devis',
    duration: '3 ans après le dernier échange',
    details: 'Sauf si une relation contractuelle commence ou si une obligation légale impose une durée différente.',
  },
  {
    category: 'Réservations et suivi de prestation',
    duration: '3 ans après la fin de la prestation',
    details: 'Les éléments comptables ou nécessaires à la preuve d’un paiement sont conservés séparément plus longtemps.',
  },
  {
    category: 'Paiements, remboursements et pièces comptables',
    duration: '10 ans',
    details: 'Seules les données utiles à la vérification manuelle et aux obligations comptables sont conservées.',
  },
  {
    category: 'Consentements et preuve des choix',
    duration: '5 ans après le retrait ou la fin de l’utilisation concernée',
    details: 'Le retrait du droit à l’image produit effet pour l’avenir et reste distinct d’une demande d’effacement.',
  },
  {
    category: 'Journaux de sécurité du serveur',
    duration: '14 rotations quotidiennes',
    details: 'Ils peuvent inclure l’adresse IP, la date, la ressource demandée et des informations techniques du navigateur.',
  },
  {
    category: 'Historique administratif, notifications et calendrier',
    duration: '3 ans après la clôture du dossier',
    details: 'Une conservation plus longue reste possible uniquement pour établir, exercer ou défendre un droit.',
  },
];

export const ACTIVE_PROCESSORS = [
  {
    name: 'Hébergement et base de données',
    status: 'Actif',
    purpose: 'Servir le site, conserver les demandes, réservations, journaux et médias administrés par le Studio.',
    data: 'Données de formulaire, données de réservation, journaux techniques et fichiers gérés par le Studio.',
  },
  {
    name: 'Cal.com',
    status: 'Actif pour les réservations confirmées',
    purpose: 'Créer, déplacer ou annuler l’événement de calendrier lié à une réservation.',
    data: 'Nom, adresse e-mail si fournie, téléphone, horaire, durée, formule et référence de réservation.',
  },
  {
    name: 'Zoho Mail (SMTP)',
    status: 'Actif pour les notifications transactionnelles par e-mail',
    purpose: 'Acheminer les notifications par e-mail lorsque ce canal est activé.',
    data: 'Adresse e-mail, identité, référence, horaire et informations utiles au message.',
  },
  {
    name: 'WhatsApp Business / Meta',
    status: 'Canal automatique actuellement désactivé',
    purpose: 'Envoyer des notifications transactionnelles uniquement après consentement explicite, si le canal est activé.',
    data: 'Numéro de téléphone, prénom, référence et horaire de réservation.',
  },
  {
    name: 'Cloudflare Turnstile',
    status: 'Protection actuellement désactivée',
    purpose: 'Vérifier les soumissions de formulaires contre les abus, si cette protection est activée.',
    data: 'Jeton de vérification, adresse IP et données techniques nécessaires à la vérification.',
  },
];

export const PRIVACY_RIGHTS = [
  'demander l’accès aux données qui vous concernent ;',
  'demander leur rectification, leur mise à jour ou, lorsque les conditions sont réunies, leur effacement ;',
  'demander la limitation du traitement ou vous opposer à un traitement dans les conditions prévues par la loi ;',
  'demander la portabilité des données lorsque ce droit est applicable ;',
  'retirer un consentement pour l’avenir, sans remettre en cause les traitements déjà réalisés licitement ;',
  'saisir l’autorité compétente en matière de protection des données.',
];

export const PENDING_LEGAL_PARTICULARS = [
  'forme juridique et capital social',
  'numéro RCCM et identifiant fiscal (NIU)',
  'identité du directeur ou de la directrice de publication',
];
