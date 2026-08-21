export const EMAIL_TEMPLATE_VERSION = '2026-08-20-phase4';

export const EMAIL_TEMPLATE_CODES = [
  'E-01', 'E-02', 'E-03', 'E-04', 'E-04A', 'E-04B', 'E-05', 'E-06', 'E-07',
  'E-08', 'E-09', 'E-10', 'E-11', 'E-12', 'E-13', 'E-14', 'E-15', 'E-16',
  'E-17', 'E-18', 'E-19', 'E-20', 'E-21', 'E-22', 'E-23',
  'I-01', 'I-02', 'I-03', 'I-04', 'I-05', 'I-06', 'I-07', 'I-08', 'I-09',
  'I-10', 'I-11', 'I-12',
] as const;

export type EmailTemplateCode = (typeof EMAIL_TEMPLATE_CODES)[number];
export type EmailTemplateAudience = 'customer' | 'admin';
export type EmailTemplateVariables = Record<string, string | number>;

export type EmailTemplateDefinition = {
  code: EmailTemplateCode;
  version: typeof EMAIL_TEMPLATE_VERSION;
  audience: EmailTemplateAudience;
  subject: string;
  preheader: string;
  body: readonly string[];
  requiredVariables: readonly string[];
};

export type RenderedEmailTemplate = {
  code: EmailTemplateCode;
  version: typeof EMAIL_TEMPLATE_VERSION;
  audience: EmailTemplateAudience;
  subject: string;
  locale: EmailLocale;
  preheader: string;
  text: string;
  html: string;
  variables: Record<string, string>;
};

type TemplateInput = Omit<EmailTemplateDefinition, 'code' | 'version' | 'requiredVariables'>;

const placeholders = (parts: readonly string[]) => {
  const result: string[] = [];
  for (const part of parts) {
    for (const match of part.matchAll(/\[([a-z0-9_]+)]/g)) {
      if (!result.includes(match[1])) result.push(match[1]);
    }
  }
  return result;
};

const define = (code: EmailTemplateCode, input: TemplateInput): EmailTemplateDefinition => ({
  code,
  version: EMAIL_TEMPLATE_VERSION,
  ...input,
  requiredVariables: placeholders([input.subject, input.preheader, ...input.body]),
});

const external = (
  code: EmailTemplateCode,
  subject: string,
  preheader: string,
  body: readonly string[],
) => define(code, { audience: 'customer', subject, preheader, body });

const internal = (
  code: EmailTemplateCode,
  subject: string,
  preheader: string,
  body: readonly string[],
) => define(code, { audience: 'admin', subject, preheader, body });

export const emailTemplateRegistry: Record<EmailTemplateCode, EmailTemplateDefinition> = {
  'E-01': external(
    'E-01',
    'Votre demande de réservation a bien été reçue — [reference_courte]',
    'Votre créneau est demandé, mais il n’est pas encore définitivement confirmé.',
    [
      'Bonjour [prenom_client],',
      'Nous avons bien reçu votre demande de réservation pour [nom_prestation].',
      'Votre demande porte sur le [date_seance] de [heure_debut] à [heure_fin], heure de Douala. Elle est actuellement en attente de vérification du paiement et de validation de la réservation.',
      'À ce stade, la réservation n’est pas encore définitivement confirmée. Vous recevrez un nouveau message dès qu’une décision aura été prise.',
      'Référence : [reference_courte]',
      'Montant : [montant_fcfa] FCFA',
      'Paiement : [statut_paiement_libelle]',
      'Réservation : En attente de confirmation',
      'Conservez cette référence pour toute communication concernant votre demande.',
      'Merci pour votre confiance,',
      'Golden Studio Plus',
    ],
  ),
  'E-02': external(
    'E-02',
    'Votre paiement est en cours de vérification — [reference_courte]',
    'La référence transmise a été enregistrée et sera contrôlée manuellement.',
    [
      'Bonjour [prenom_client],',
      'Nous avons bien enregistré la référence de paiement communiquée pour votre demande [reference_courte].',
      'Le paiement doit maintenant être vérifié manuellement. Cet accusé ne constitue ni une validation du paiement ni une confirmation définitive de la réservation.',
      'Montant déclaré : [montant_fcfa] FCFA',
      'Opérateur : [operateur_paiement]',
      'Référence communiquée : [reference_paiement_masquee]',
      'Vous recevrez un nouveau message après vérification.',
      'Golden Studio Plus',
    ],
  ),
  'E-03': external(
    'E-03',
    'Paiement vérifié — réservation en cours de validation — [reference_courte]',
    'Votre paiement est validé ; la décision sur la réservation reste en cours.',
    [
      'Bonjour [prenom_client],',
      'Le paiement associé à votre demande [reference_courte] a été vérifié manuellement.',
      'La réservation reste toutefois en attente de validation. La vérification du paiement ne confirme pas automatiquement le créneau.',
      'Prestation : [nom_prestation]',
      'Créneau demandé : [date_seance], [heure_debut]–[heure_fin]',
      'Montant vérifié : [montant_fcfa] FCFA',
      'Vous recevrez une confirmation ou une autre décision dans un message distinct.',
      'Golden Studio Plus',
    ],
  ),
  'E-04': external(
    'E-04',
    'Votre paiement n’a pas pu être validé — [reference_courte]',
    'Le paiement transmis a été rejeté après vérification manuelle.',
    [
      'Bonjour [prenom_client],',
      'Après vérification manuelle, nous n’avons pas pu valider le paiement associé à votre demande [reference_courte].',
      'Motif : [motif_rejet_paiement]',
      'La réservation n’est pas confirmée. Pour poursuivre, veuillez [instruction_regularisation] avant le [date_limite_regularisation], heure de Douala.',
      'Montant attendu : [montant_fcfa] FCFA',
      'Opérateur déclaré : [operateur_paiement]',
      'Référence contrôlée : [reference_paiement_masquee]',
      'Golden Studio Plus',
    ],
  ),
  'E-04A': external(
    'E-04A',
    'Informations nécessaires pour vérifier votre paiement — [reference_courte]',
    'Un élément manque pour poursuivre la vérification manuelle de votre paiement.',
    [
      'Bonjour [prenom_client],',
      'Nous avons besoin d’une information complémentaire pour vérifier le paiement associé à votre demande [reference_courte].',
      'Élément à compléter : [information_paiement_requise]',
      'Merci de transmettre cet élément avant le [date_limite_regularisation], heure de Douala. La réservation n’est pas encore confirmée.',
      'Montant attendu : [montant_fcfa] FCFA',
      'Opérateur déclaré : [operateur_paiement]',
      'Référence communiquée : [reference_paiement_masquee]',
      'Golden Studio Plus',
    ],
  ),
  'E-04B': external(
    'E-04B',
    'Vérification de votre paiement en cours — [reference_courte]',
    'Un incident temporaire retarde la vérification, sans constituer un rejet du paiement.',
    [
      'Bonjour [prenom_client],',
      'La vérification du paiement associé à votre demande [reference_courte] est temporairement retardée.',
      'Cette situation ne constitue pas un rejet du paiement. Aucune action n’est nécessaire de votre part pour le moment.',
      'La réservation reste en attente de confirmation. Nous vous informerons dès que la vérification aura pu être finalisée.',
      'Golden Studio Plus',
    ],
  ),
  'E-05': external(
    'E-05',
    'Votre réservation est confirmée — [reference_courte]',
    'Votre séance est confirmée : retrouvez ici le créneau et les informations utiles.',
    [
      'Bonjour [prenom_client],',
      'Votre réservation [reference_courte] est confirmée.',
      'Prestation : [nom_prestation]',
      'Date : [date_seance]',
      'Horaire : [heure_debut]–[heure_fin], heure de Douala',
      'Montant payé et vérifié : [montant_fcfa] FCFA',
      'Lieu : [adresse_ou_instruction_acces]',
      'Merci de vous présenter à l’heure convenue. Tout retard imputable au client au-delà de cinq minutes réduit le temps restant de la séance, sans prolongation ni compensation.',
      'Un seul changement de date peut être demandé sans frais, au moins 48 heures avant le créneau initial et sous réserve des disponibilités.',
      'Golden Studio Plus',
    ],
  ),
  'E-06': external(
    'E-06',
    'Votre demande de réservation n’a pas pu être acceptée — [reference_courte]',
    'Le créneau demandé ne peut pas être confirmé.',
    [
      'Bonjour [prenom_client],',
      'Nous sommes désolés, votre demande [reference_courte] n’a pas pu être acceptée.',
      'Motif : [motif_refus_reservation]',
      'Aucun paiement vérifié n’est associé à cette décision. Vous pouvez soumettre une nouvelle demande pour un autre créneau disponible.',
      'Golden Studio Plus',
    ],
  ),
  'E-07': external(
    'E-07',
    'Votre réservation n’a pas pu être confirmée — [reference_courte]',
    'Votre paiement est vérifié ; le traitement financier est pris en charge séparément.',
    [
      'Bonjour [prenom_client],',
      'Votre demande [reference_courte] n’a pas pu être confirmée.',
      'Motif : [motif_refus_reservation]',
      'Un paiement avait déjà été vérifié. La situation financière est en cours d’examen séparé ; ce message n’annonce ni montant à rembourser ni opération engagée.',
      'Vous recevrez une notification distincte uniquement si une opération financière est effectivement engagée ou finalisée.',
      'Golden Studio Plus',
    ],
  ),
  'E-08': external('E-08', 'Votre demande de changement d’horaire a été reçue — [reference_courte]', 'Le nouveau créneau demandé doit encore être vérifié.', [
    'Bonjour [prenom_client],', 'Nous avons reçu votre demande de changement concernant la réservation [reference_courte].',
    'Créneau actuel : [ancien_creneau]', 'Créneau souhaité : [nouveau_creneau_demande]',
    'Le changement n’est pas encore confirmé. Vous recevrez une décision dans un message distinct.', 'Golden Studio Plus',
  ]),
  'E-09': external('E-09', 'Nouvel horaire confirmé — [reference_courte]', 'Votre réservation a été déplacée vers le nouveau créneau.', [
    'Bonjour [prenom_client],', 'Le changement demandé pour votre réservation [reference_courte] est confirmé.',
    'Ancien créneau : [ancien_creneau]', 'Nouveau créneau : [nouveau_creneau_confirme], heure de Douala',
    'Les autres éléments restent inchangés, sauf indication contraire : [modifications_complementaires].',
    'Veuillez utiliser uniquement le nouveau créneau. Une invitation calendrier actualisée remplace la précédente.', 'Golden Studio Plus',
  ]),
  'E-10': external('E-10', 'Le changement demandé n’est pas disponible — [reference_courte]', 'Votre créneau initial reste inchangé.', [
    'Bonjour [prenom_client],', 'Nous n’avons pas pu accepter le changement demandé pour la réservation [reference_courte].',
    'Motif : [motif_refus_report]', 'Votre créneau initial reste confirmé : [ancien_creneau].', 'Golden Studio Plus',
  ]),
  'E-11': external('E-11', 'Annulation enregistrée — [reference_courte]', 'Votre réservation est annulée et un remboursement partiel est à traiter.', [
    'Bonjour [prenom_client],', 'L’annulation de votre réservation [reference_courte] a été enregistrée.',
    'Créneau annulé : [date_seance], [heure_debut]–[heure_fin], heure de Douala.',
    'La demande ayant été communiquée plus de 48 heures avant la séance, 50 % du montant versé, soit [montant_remboursable_fcfa] FCFA, est remboursable.',
    'Vous recevrez un message distinct lorsque le remboursement aura effectivement été engagé puis finalisé.', 'Golden Studio Plus',
  ]),
  'E-12': external('E-12', 'Annulation enregistrée — [reference_courte]', 'Votre réservation est annulée ; aucun remboursement n’est applicable.', [
    'Bonjour [prenom_client],', 'L’annulation de votre réservation [reference_courte] a été enregistrée.',
    'Créneau annulé : [date_seance], [heure_debut]–[heure_fin], heure de Douala.',
    'La demande ayant été communiquée 48 heures ou moins avant la séance, aucun remboursement n’est applicable.', 'Golden Studio Plus',
  ]),
  'E-13': external('E-13', 'Annulation de votre réservation — [reference_courte]', 'Le Studio doit annuler votre créneau ; voici les prochaines étapes.', [
    'Bonjour [prenom_client],', 'Nous sommes désolés de vous informer que votre réservation [reference_courte], prévue le [date_seance] de [heure_debut] à [heure_fin], doit être annulée.',
    'Motif : [motif_annulation_studio]', 'La situation financière est en cours d’examen séparé ; ce message n’annonce aucune opération.',
    'Vous recevrez une notification distincte uniquement si une opération est effectivement engagée ou finalisée.', 'Golden Studio Plus',
  ]),
  'E-14': external('E-14', 'Votre demande de réservation a expiré — [reference_courte]', 'Le créneau n’est plus maintenu pour cette demande.', [
    'Bonjour [prenom_client],', 'Votre demande [reference_courte] a expiré, car [motif_expiration].',
    'Le créneau demandé n’est plus maintenu. Aucun paiement vérifié ne doit rester sans traitement.',
    'Vous pouvez effectuer une nouvelle demande selon les disponibilités affichées.', 'Golden Studio Plus',
  ]),
  'E-15': external('E-15', 'Votre séance approche — [reference_courte]', 'Vérifiez votre créneau avant l’échéance applicable aux changements.', [
    'Bonjour [prenom_client],', 'Votre séance [reference_courte] est prévue le [date_seance] de [heure_debut] à [heure_fin], heure de Douala.',
    'Un changement peut être demandé au moins 48 heures avant le créneau, sous réserve des disponibilités.',
    'Une annulation à plus de 48 heures donne lieu au remboursement de 50 % ; à 48 heures ou moins, aucun remboursement n’est effectué.', 'Golden Studio Plus',
  ]),
  'E-16': external('E-16', 'Rappel : votre séance est prévue demain — [reference_courte]', 'Retrouvez l’horaire et les informations utiles pour votre séance.', [
    'Bonjour [prenom_client],', 'Nous vous rappelons votre séance [reference_courte] prévue le [date_seance] de [heure_debut] à [heure_fin], heure de Douala.',
    'Prestation : [nom_prestation]', 'Lieu : [adresse_ou_instruction_acces]', 'Contact utile : [contact_studio]',
    'Merci de vous présenter à l’heure.', 'Golden Studio Plus',
  ]),
  'E-17': external('E-17', 'Absence constatée pour votre séance — [reference_courte]', 'Votre réservation a été clôturée comme absence non signalée.', [
    'Bonjour [prenom_client],', 'Votre réservation [reference_courte], prévue le [date_seance] de [heure_debut] à [heure_fin], a été clôturée comme absence non signalée.',
    'Conformément aux conditions acceptées, aucun remboursement n’est effectué en cas d’absence non signalée.',
    'Si cette information est incorrecte, contactez le Studio.', 'Golden Studio Plus',
  ]),
  'E-18': external('E-18', 'Merci pour votre séance — [reference_courte]', 'Voici les prochaines étapes liées à votre prestation.', [
    'Bonjour [prenom_client],', 'Merci pour votre séance [reference_courte] réalisée le [date_seance].',
    'Prochaine étape : [prochaine_etape]', 'Délai indicatif communiqué : [delai_suivi]', 'Canal de livraison ou de suivi : [canal_suivi]',
    'Vous serez informé séparément lorsque les éléments seront effectivement disponibles.', 'Golden Studio Plus',
  ]),
  'E-19': external('E-19', 'Vos livrables sont disponibles — [reference_courte]', 'Accédez aux éléments associés à votre prestation.', [
    'Bonjour [prenom_client],', 'Les éléments associés à votre prestation [reference_courte] sont disponibles.',
    'Accès : [lien_livraison]', 'Code ou instruction d’accès : [instruction_acces]', 'Date limite d’accès : [date_limite_acces]',
    'Ne transmettez pas vos informations d’accès à des tiers.', 'Golden Studio Plus',
  ]),
  'E-20': external('E-20', 'Votre remboursement est en cours — [reference_courte]', 'L’opération a été engagée ; conservez la référence de suivi.', [
    'Bonjour [prenom_client],', 'Le remboursement lié à la réservation [reference_courte] a été engagé.',
    'Montant : [montant_remboursement_fcfa] FCFA', 'Canal : [canal_remboursement]',
    'Référence de suivi : [reference_remboursement_masquee]', 'Date d’engagement : [date_engagement]',
    'Un nouveau message sera envoyé lorsque l’opération sera finalisée.', 'Golden Studio Plus',
  ]),
  'E-21': external('E-21', 'Votre remboursement a été effectué — [reference_courte]', 'L’opération de remboursement est finalisée.', [
    'Bonjour [prenom_client],', 'Le remboursement lié à la réservation [reference_courte] a été finalisé.',
    'Montant : [montant_remboursement_fcfa] FCFA', 'Canal : [canal_remboursement]',
    'Référence : [reference_remboursement_masquee]', 'Date de finalisation : [date_finalisation]', 'Golden Studio Plus',
  ]),
  'E-22': external('E-22', 'Votre message a bien été reçu — [reference_contact]', 'Votre demande a été enregistrée et sera examinée.', [
    'Bonjour [prenom_contact],', 'Nous avons bien reçu votre message.', 'Objet : [objet_demande]',
    'Référence : [reference_contact]', 'Date de réception : [date_reception], heure de Douala',
    'Pour transmettre une précision, répondez à cet e-mail en conservant la référence dans l’objet.', 'Golden Studio Plus',
  ]),
  'E-23': external('E-23', 'Votre demande professionnelle a bien été reçue — [reference_b2b]', 'Les informations transmises ont été enregistrées pour étude.', [
    'Bonjour [nom_contact],', 'Nous avons bien reçu votre demande professionnelle[organisation_phrase].',
    'Objet : [objet_demande]', 'Référence : [reference_b2b]', 'Date de réception : [date_reception], heure de Douala',
    'Cet accusé ne constitue pas encore une acceptation commerciale ni une confirmation de disponibilité.', 'Golden Studio Plus',
  ]),
  'I-01': internal('I-01', '[ACTION] Nouvelle réservation à traiter — [date_seance] [heure_debut] — [reference_courte]', 'Vérifier le paiement, puis décider de la réservation séparément ou dans une action combinée.', [
    'Une nouvelle demande nécessite une intervention.', 'Référence : [reference_courte]', 'Client : [nom_client]',
    'Téléphone : [telephone_e164]', 'E-mail : [email_client]', 'Prestation : [nom_prestation]',
    'Créneau : [date_seance], [heure_debut]–[heure_fin], heure de Douala', 'Montant : [montant_fcfa] FCFA',
    'Paiement : [statut_paiement]', 'Opérateur : [operateur_paiement]', 'Référence transmise : [reference_paiement_masquee]',
    'Réservation : en attente de confirmation', 'Lien d’administration : [lien_admin_reservation]',
  ]),
  'I-02': internal('I-02', '[ACTION] Paiement à vérifier — [reference_courte]', 'Une nouvelle référence de paiement a été ajoutée à une réservation existante.', [
    'Une nouvelle référence de paiement doit être vérifiée manuellement.', 'Réservation : [reference_courte]', 'Client : [nom_client]',
    'Montant attendu : [montant_fcfa] FCFA', 'Opérateur : [operateur_paiement]', 'Référence : [reference_paiement_masquee]',
    'Transmise le : [date_transmission]', 'Lien d’administration : [lien_admin_reservation]',
  ]),
  'I-03': internal('I-03', '[À TRAITER] Dossier sans décision — [reference_courte]', 'Le paiement ou la réservation nécessite une décision, sans multiplier les relances.', [
    'La réservation [reference_courte] reste sans décision depuis [duree_attente].', 'Client : [nom_client]',
    'Créneau : [date_seance], [heure_debut]–[heure_fin]', 'Paiement : [statut_paiement]',
    'Réservation : [statut_reservation]', 'Échéance : [date_expiration]', 'Lien d’administration : [lien_admin_reservation]',
  ]),
  'I-04': internal('I-04', '[ACTION] Demande de report — [reference_courte]', 'Contrôler la règle des 48 heures et la disponibilité du nouveau créneau.', [
    'Une demande de report doit être examinée.', 'Réservation : [reference_courte]', 'Client : [nom_client]',
    'Ancien créneau : [ancien_creneau]', 'Nouveau créneau demandé : [nouveau_creneau]',
    'Délai avant la séance : [delai_avant_seance]', 'Nombre de reports déjà accordés : [nombre_reports]',
    'Lien d’administration : [lien_admin_reservation]',
  ]),
  'I-05': internal('I-05', '[ACTION FINANCIÈRE] Annulation — [reference_courte]', 'L’annulation est enregistrée ; un traitement financier reste à effectuer.', [
    'Une annulation nécessite un traitement financier.', 'Réservation : [reference_courte]', 'Client : [nom_client]',
    'Créneau annulé : [creneau]', 'Date de la demande : [date_annulation]', 'Délai calculé : [delai_avant_seance]',
    'Montant payé : [montant_paye_fcfa] FCFA', 'Montant remboursable calculé : [montant_remboursable_fcfa] FCFA',
    'Lien d’administration : [lien_admin_reservation]',
  ]),
  'I-06': internal('I-06', '[ACTION FINANCIÈRE] Remboursement à traiter — [reference_courte]', 'Une opération de remboursement doit être engagée ou reprise.', [
    'Un remboursement nécessite une intervention.', 'Réservation : [reference_courte]', 'Client : [nom_client]',
    'Montant : [montant_remboursement_fcfa] FCFA', 'Canal : [canal_remboursement]', 'Statut : [statut_remboursement]',
    'Motif ou dernière erreur : [motif_ou_erreur]', 'Échéance interne : [echeance_interne]', 'Lien d’administration : [lien_admin_reservation]',
  ]),
  'I-07': internal('I-07', '[ALERTE] Échec Cal.com — [reference_courte]', 'La réservation est enregistrée, mais l’événement calendrier n’a pas été synchronisé.', [
    'La synchronisation Cal.com a échoué après trois tentatives automatiques espacées.', 'Réservation : [reference_courte]',
    'État : [statut_reservation]', 'Créneau : [date_seance], [heure_debut]–[heure_fin], heure de Douala',
    'Dernière erreur : [code_erreur] — [message_erreur]', 'Identifiant distant : [identifiant_calcom_ou_absent]',
    'Lien d’administration : [lien_admin_reservation]',
  ]),
  'I-08': internal('I-08', '[ALERTE] WhatsApp non livré — [reference_courte]', 'Le message attendu n’a pas été livré après les reprises prévues.', [
    'Une notification WhatsApp n’a pas pu être livrée.', 'Réservation : [reference_courte]', 'Destinataire : [destinataire_masque]',
    'Type : [type_message]', 'Consentement client : [statut_consentement]', 'Tentatives : 3',
    'Dernière erreur : [code_erreur] — [message_erreur]', 'Lien d’administration : [lien_admin_reservation]',
  ]),
  'I-09': internal('I-09', '[ALERTE] E-mail client non distribué — [reference_courte]', 'Une décision importante n’a pas atteint l’adresse du client.', [
    'Un e-mail transactionnel important n’a pas été distribué.', 'Réservation : [reference_courte]', 'Client : [nom_client]',
    'Adresse : [email_client_masque]', 'Modèle : [id_modele]', 'Objet : [objet_email]',
    'Erreur : [code_smtp] — [message_retour]', 'Lien d’administration : [lien_admin_reservation]',
  ]),
  'I-10': internal('I-10', '[CRITIQUE] Incohérence de données client — [reference_courte]', 'Une réservation risque d’utiliser l’identité ou les coordonnées d’un autre dossier.', [
    'Une incohérence critique a été détectée.', 'Réservation concernée : [reference_courte]', 'Autres références liées : [references_liees]',
    'Téléphone commun : [telephone_masque]', 'Identités détectées : [identites]', 'E-mails détectés : [emails_masques]',
    'Champ réécrit ou partagé : [champ_concerne]', 'Lien d’administration : [lien_admin_reservation]',
  ]),
  'I-11': internal('I-11', 'Récapitulatif opérationnel — [date_douala]', 'Demandes en attente, séances à venir et anomalies à traiter.', [
    'Voici le récapitulatif opérationnel du [date_douala].', 'Demandes en attente : [nombre_pending]',
    'Paiements à vérifier : [nombre_paiements]', 'Paiements vérifiés sans décision : [nombre_decisions]',
    'Remboursements à traiter : [nombre_remboursements]', 'Séances du lendemain : [nombre_seances_demain]',
    'Échecs Cal.com : [nombre_calcom]', 'Échecs WhatsApp : [nombre_whatsapp]', 'E-mails non distribués : [nombre_bounces]',
    'Priorités : [resume_actions_prioritaires]', 'Tableau de bord : [lien_admin_tableau_bord]',
  ]),
  'I-12': internal('I-12', '[LEAD] [type_demande] — [organisation_ou_nom] — [reference_demande]', 'Une nouvelle demande nécessite une qualification ou une réponse.', [
    'Une nouvelle demande a été enregistrée.', 'Type : [type_demande]', 'Référence : [reference_demande]',
    'Contact : [nom_contact]', 'Organisation : [organisation]', 'Téléphone : [telephone_e164]', 'E-mail : [email_contact]',
    'Objet : [objet_demande]', 'Priorité : [priorite]', 'Résumé : [resume_message]', 'Lien : [lien_admin_demande]',
  ]),
};

export type EmailLocale = 'fr' | 'en';

const englishTemplateRegistry: Partial<Record<EmailTemplateCode, EmailTemplateDefinition>> = {
  'E-01': external('E-01', 'We received your booking request — [reference_courte]', 'Your requested time slot is not yet confirmed.', [
    'Hello [prenom_client],', 'We received your booking request for [nom_prestation].',
    'Your request is for [date_seance], from [heure_debut] to [heure_fin], Douala time. It is awaiting payment verification and booking approval.',
    'Your booking is not yet finally confirmed. We will send you another message when a decision has been made.', 'Reference: [reference_courte]', 'Amount: [montant_fcfa] FCFA', 'Payment: [statut_paiement_libelle]', 'Booking: awaiting confirmation', 'Please keep this reference for all correspondence about your request.', 'Thank you for choosing us,', 'Golden Studio Plus',
  ]),
  'E-02': external('E-02', 'Your payment is being verified — [reference_courte]', 'Your payment reference has been recorded and will be checked manually.', [
    'Hello [prenom_client],', 'We recorded the payment reference provided for your request [reference_courte].', 'The payment must now be manually verified. This acknowledgement is neither payment approval nor final booking confirmation.', 'Declared amount: [montant_fcfa] FCFA', 'Operator: [operateur_paiement]', 'Reference provided: [reference_paiement_masquee]', 'We will send you another message after verification.', 'Golden Studio Plus',
  ]),
  'E-03': external('E-03', 'Payment verified — booking awaiting approval — [reference_courte]', 'Your payment is approved; the booking decision is still pending.', [
    'Hello [prenom_client],', 'The payment associated with your request [reference_courte] has been manually verified.', 'The booking is still awaiting approval. Payment verification does not automatically confirm the time slot.', 'Service: [nom_prestation]', 'Requested slot: [date_seance], [heure_debut]–[heure_fin]', 'Verified amount: [montant_fcfa] FCFA', 'You will receive a confirmation or another decision in a separate message.', 'Golden Studio Plus',
  ]),
  'E-04': external('E-04', 'Your payment could not be approved — [reference_courte]', 'The payment provided was declined after manual verification.', [
    'Hello [prenom_client],', 'After manual verification, we could not approve the payment associated with your request [reference_courte].', 'Reason: [motif_rejet_paiement]', 'The booking is not confirmed. To continue, please [instruction_regularisation] before [date_limite_regularisation], Douala time.', 'Expected amount: [montant_fcfa] FCFA', 'Declared operator: [operateur_paiement]', 'Checked reference: [reference_paiement_masquee]', 'Golden Studio Plus',
  ]),
  'E-04A': external('E-04A', 'Information needed to verify your payment — [reference_courte]', 'An item is missing before we can complete manual payment verification.', [
    'Hello [prenom_client],', 'We need additional information to verify the payment associated with your request [reference_courte].', 'Information needed: [information_paiement_requise]', 'Please provide it before [date_limite_regularisation], Douala time. The booking is not yet confirmed.', 'Expected amount: [montant_fcfa] FCFA', 'Declared operator: [operateur_paiement]', 'Reference provided: [reference_paiement_masquee]', 'Golden Studio Plus',
  ]),
  'E-04B': external('E-04B', 'Your payment verification is in progress — [reference_courte]', 'A temporary incident is delaying verification; it is not a payment rejection.', [
    'Hello [prenom_client],', 'Verification of the payment associated with your request [reference_courte] is temporarily delayed.', 'This is not a payment rejection. No action is required from you at this time.', 'The booking remains awaiting confirmation. We will inform you once verification has been completed.', 'Golden Studio Plus',
  ]),
  'E-05': external('E-05', 'Your booking is confirmed — [reference_courte]', 'Your session is confirmed. Find the time slot and useful details here.', [
    'Hello [prenom_client],', 'Your booking [reference_courte] is confirmed.', 'Service: [nom_prestation]', 'Date: [date_seance]', 'Time: [heure_debut]–[heure_fin], Douala time', 'Paid and verified amount: [montant_fcfa] FCFA', 'Location: [adresse_ou_instruction_acces]', 'Please arrive at the agreed time. Any client-caused delay beyond five minutes reduces the remaining session time, without extension or compensation.', 'One date change may be requested free of charge at least 48 hours before the original slot, subject to availability.', 'Golden Studio Plus',
  ]),
  'E-06': external('E-06', 'Your booking request could not be accepted — [reference_courte]', 'The requested time slot cannot be confirmed.', [
    'Hello [prenom_client],', 'We are sorry, but your request [reference_courte] could not be accepted.', 'Reason: [motif_refus_reservation]', 'No verified payment is associated with this decision. You may submit a new request for another available time slot.', 'Golden Studio Plus',
  ]),
  'E-07': external('E-07', 'Your booking could not be confirmed — [reference_courte]', 'Your payment is verified; the financial handling is managed separately.', [
    'Hello [prenom_client],', 'Your request [reference_courte] could not be confirmed.', 'Reason: [motif_refus_reservation]', 'A payment had already been verified. The financial situation is being reviewed separately; this message announces neither a refund amount nor an initiated operation.', 'You will receive a separate notification only if a financial operation is actually initiated or completed.', 'Golden Studio Plus',
  ]),
  'E-08': external('E-08', 'Your rescheduling request was received — [reference_courte]', 'The requested new time slot still needs to be checked.', [
    'Hello [prenom_client],', 'We received your change request for booking [reference_courte].', 'Current slot: [ancien_creneau]', 'Requested slot: [nouveau_creneau_demande]', 'The change is not yet confirmed. You will receive a decision in a separate message.', 'Golden Studio Plus',
  ]),
  'E-09': external('E-09', 'New time slot confirmed — [reference_courte]', 'Your booking has been moved to the new time slot.', [
    'Hello [prenom_client],', 'The requested change for booking [reference_courte] is confirmed.', 'Previous slot: [ancien_creneau]', 'New confirmed slot: [nouveau_creneau_confirme], Douala time', 'All other terms remain unchanged unless otherwise stated: [modifications_complementaires].', 'Please use only the new time slot. An updated calendar invitation replaces the previous one.', 'Golden Studio Plus',
  ]),
  'E-10': external('E-10', 'The requested change is not available — [reference_courte]', 'Your original time slot remains unchanged.', [
    'Hello [prenom_client],', 'We could not accept the requested change for booking [reference_courte].', 'Reason: [motif_refus_report]', 'Your original confirmed slot remains: [ancien_creneau].', 'Golden Studio Plus',
  ]),
  'E-11': external('E-11', 'Cancellation recorded — [reference_courte]', 'Your booking is cancelled and a partial refund must be processed.', [
    'Hello [prenom_client],', 'The cancellation of your booking [reference_courte] has been recorded.', 'Cancelled slot: [date_seance], [heure_debut]–[heure_fin], Douala time.', 'As the request was received more than 48 hours before the session, 50% of the amount paid, [montant_remboursable_fcfa] FCFA, is refundable.', 'You will receive a separate message when the refund has actually been initiated and completed.', 'Golden Studio Plus',
  ]),
  'E-12': external('E-12', 'Cancellation recorded — [reference_courte]', 'Your booking is cancelled; no refund applies.', [
    'Hello [prenom_client],', 'The cancellation of your booking [reference_courte] has been recorded.', 'Cancelled slot: [date_seance], [heure_debut]–[heure_fin], Douala time.', 'As the request was received 48 hours or less before the session, no refund applies.', 'Golden Studio Plus',
  ]),
  'E-13': external('E-13', 'Your booking is cancelled — [reference_courte]', 'The Studio must cancel your time slot; here are the next steps.', [
    'Hello [prenom_client],', 'We are sorry to inform you that your booking [reference_courte], scheduled for [date_seance] from [heure_debut] to [heure_fin], must be cancelled.', 'Reason: [motif_annulation_studio]', 'The financial situation is being reviewed separately; this message does not announce an operation.', 'You will receive a separate notification only if an operation is actually initiated or completed.', 'Golden Studio Plus',
  ]),
  'E-14': external('E-14', 'Your booking request has expired — [reference_courte]', 'The time slot is no longer held for this request.', [
    'Hello [prenom_client],', 'Your request [reference_courte] has expired because [motif_expiration].', 'The requested time slot is no longer held. No verified payment should remain without handling.', 'You may make a new request according to the displayed availability.', 'Golden Studio Plus',
  ]),
  'E-15': external('E-15', 'Your session is approaching — [reference_courte]', 'Check your time slot before the applicable change deadline.', [
    'Hello [prenom_client],', 'Your session [reference_courte] is scheduled for [date_seance] from [heure_debut] to [heure_fin], Douala time.', 'A change may be requested at least 48 hours before the slot, subject to availability.', 'A cancellation more than 48 hours before is eligible for a 50% refund; at 48 hours or less, no refund is made.', 'Golden Studio Plus',
  ]),
  'E-16': external('E-16', 'Reminder: your session is tomorrow — [reference_courte]', 'Find the time and useful details for your session.', [
    'Hello [prenom_client],', 'This is a reminder that your session [reference_courte] is scheduled for [date_seance] from [heure_debut] to [heure_fin], Douala time.', 'Service: [nom_prestation]', 'Location: [adresse_ou_instruction_acces]', 'Useful contact: [contact_studio]', 'Please arrive on time.', 'Golden Studio Plus',
  ]),
  'E-17': external('E-17', 'Absence recorded for your session — [reference_courte]', 'Your booking was closed as an unreported absence.', [
    'Hello [prenom_client],', 'Your booking [reference_courte], scheduled for [date_seance] from [heure_debut] to [heure_fin], was closed as an unreported absence.', 'Under the accepted terms, no refund is made in case of an unreported absence.', 'If this information is incorrect, please contact the Studio.', 'Golden Studio Plus',
  ]),
  'E-18': external('E-18', 'Thank you for your session — [reference_courte]', 'Here are the next steps related to your service.', [
    'Hello [prenom_client],', 'Thank you for your session [reference_courte] completed on [date_seance].', 'Next step: [prochaine_etape]', 'Indicative timeframe: [delai_suivi]', 'Delivery or follow-up channel: [canal_suivi]', 'You will be informed separately when the items are actually available.', 'Golden Studio Plus',
  ]),
  'E-19': external('E-19', 'Your deliverables are available — [reference_courte]', 'Access the items related to your service.', [
    'Hello [prenom_client],', 'The items related to your service [reference_courte] are available.', 'Access: [lien_livraison]', 'Access code or instructions: [instruction_acces]', 'Access deadline: [date_limite_acces]', 'Do not share your access information with third parties.', 'Golden Studio Plus',
  ]),
  'E-20': external('E-20', 'Your refund is in progress — [reference_courte]', 'The operation has been initiated; please keep the tracking reference.', [
    'Hello [prenom_client],', 'The refund for booking [reference_courte] has been initiated.', 'Amount: [montant_remboursement_fcfa] FCFA', 'Channel: [canal_remboursement]', 'Tracking reference: [reference_remboursement_masquee]', 'Initiated on: [date_engagement]', 'A new message will be sent when the operation is complete.', 'Golden Studio Plus',
  ]),
  'E-21': external('E-21', 'Your refund has been completed — [reference_courte]', 'The refund operation is complete.', [
    'Hello [prenom_client],', 'The refund for booking [reference_courte] has been completed.', 'Amount: [montant_remboursement_fcfa] FCFA', 'Channel: [canal_remboursement]', 'Reference: [reference_remboursement_masquee]', 'Completed on: [date_finalisation]', 'Golden Studio Plus',
  ]),
  'E-22': external('E-22', 'We received your message — [reference_contact]', 'Your request has been recorded and will be reviewed.', [
    'Hello [prenom_contact],', 'We received your message.', 'Subject: [objet_demande]', 'Reference: [reference_contact]', 'Received on: [date_reception], Douala time', 'To provide further details, reply to this email and keep the reference in the subject line.', 'Golden Studio Plus',
  ]),
  'E-23': external('E-23', 'We received your business enquiry — [reference_b2b]', 'The information you submitted has been recorded for review.', [
    'Hello [nom_contact],', 'We received your business enquiry[organisation_phrase].', 'Subject: [objet_demande]', 'Reference: [reference_b2b]', 'Received on: [date_reception], Douala time', 'This acknowledgement is not yet a commercial acceptance or availability confirmation.', 'Golden Studio Plus',
  ]),
};

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const replaceVariables = (value: string, variables: Record<string, string>) =>
  value.replace(/\[([a-z0-9_]+)]/g, (_placeholder, name: string) => variables[name]);
const OPTIONAL_TEMPLATE_VARIABLES = new Set(['organisation_phrase']);

export const renderEmailTemplate = (
  code: EmailTemplateCode,
  input: EmailTemplateVariables,
  locale: EmailLocale = 'fr',
): RenderedEmailTemplate => {
  const template = locale === 'en' ? englishTemplateRegistry[code] ?? emailTemplateRegistry[code] : emailTemplateRegistry[code];
  const variables = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, String(value)]));
  for (const required of template.requiredVariables) {
    if (!variables[required]?.trim() && !OPTIONAL_TEMPLATE_VARIABLES.has(required)) throw new Error(`EMAIL_TEMPLATE_VARIABLE_MISSING:${code}:${required}`);
  }

  const subject = replaceVariables(template.subject, variables);
  const preheader = replaceVariables(template.preheader, variables);
  const body = template.body.map((line) => replaceVariables(line, variables));
  const text = body.join('\n');
  const html = [
    `<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</div>`,
    ...body.map((line) => `<p>${escapeHtml(line)}</p>`),
  ].join('');

  return { code, version: template.version, audience: template.audience, locale, subject, preheader, text, html, variables };
};
