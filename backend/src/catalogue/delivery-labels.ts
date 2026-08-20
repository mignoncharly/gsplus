export const GENERIC_DELIVERY_CONTACT =
  'Pour connaître les modalités et délais de livraison de cette offre, veuillez nous contacter.';

export type DeliveryLabelOrigin = 'OWNER_EXPLICIT' | 'GENERIC_FALLBACK' | 'MISSING';

export const deliveryLabelOrigin = (value: string | null | undefined): DeliveryLabelOrigin => {
  const label = value?.trim();
  if (!label) return 'MISSING';
  if (label === GENERIC_DELIVERY_CONTACT) return 'GENERIC_FALLBACK';
  return 'OWNER_EXPLICIT';
};

export const hasOwnerExplicitDeliveryLabel = (value: string | null | undefined) =>
  deliveryLabelOrigin(value) === 'OWNER_EXPLICIT';
