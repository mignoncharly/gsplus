const frenchPromotions = Object.freeze([
  { code: 'STUDENT', name: 'Avantage étudiant', advantage: '−15 %', conditions: 'Sur Portrait Découverte, Classic Propre, Ado Swag et Corporate LinkedIn · carte étudiante valide · du lundi au vendredi · paiement intégral · non cumulable.', applicationLabel: 'À confirmer avec l’équipe lors de votre échange.' },
  { code: 'REFERRAL', name: 'Parrainage Golden', advantage: '3 000 / 5 000 FCFA', conditions: '3 000 FCFA pour le filleul · crédit de 5 000 FCFA pour le parrain après paiement et réalisation de la séance du filleul · séance minimale de 18 000 FCFA · validité 30 jours · non cumulable.', applicationLabel: 'À confirmer avec l’équipe lors de votre échange.' },
]);

const englishPromotions = Object.freeze([
  { code: 'STUDENT', name: 'Student benefit', advantage: '−15%', conditions: 'For Discovery Portrait, Classic, Teen Swag and Corporate LinkedIn · valid student card · Monday to Friday · full payment · cannot be combined.', applicationLabel: 'To be confirmed with the team during your conversation.' },
  { code: 'REFERRAL', name: 'Golden referral', advantage: '3,000 / 5,000 FCFA', conditions: '3,000 FCFA for the referred customer · 5,000 FCFA credit for the referrer after payment and completion of the referred customer’s session · minimum session of 18,000 FCFA · valid for 30 days · cannot be combined.', applicationLabel: 'To be confirmed with the team during your conversation.' },
]);

export const cataloguePromotions = frenchPromotions;
export const cataloguePromotionsForLocale = (locale = 'fr') => locale === 'en' ? englishPromotions : frenchPromotions;
