const serviceImage = (slug, section, category, title, alt) => ({ slug, section, category, title, alt, src: `/images/services/${slug}-1024.webp`, srcSet: `/images/services/${slug}-480.webp 480w, /images/services/${slug}-1024.webp 1024w`, sizes: '(max-width: 640px) 92vw, (max-width: 1024px) 45vw, 31vw', width: 1024, height: 1024 });

export const SERVICE_MEDIA = [
  serviceImage('design-retouche-1', 'design', 'Retouche photo', 'Retouche photo — réalisation 1', 'Exemple de retouche photo réalisé par Golden Studio Plus à Douala.'), serviceImage('design-retouche-2', 'design', 'Retouche photo', 'Retouche photo — réalisation 2', 'Deuxième exemple de retouche photo réalisé par Golden Studio Plus à Douala.'), serviceImage('design-retouche-3', 'design', 'Retouche photo', 'Retouche photo — réalisation 3', 'Troisième exemple de retouche photo réalisé par Golden Studio Plus à Douala.'),
  serviceImage('design-affiche-cadre', 'design', 'Flyers et affiches', 'Affiche et mise en cadre', 'Création d’affiche et présentation encadrée conçues par Golden Studio Plus.'), serviceImage('design-flyer-1', 'design', 'Flyers et affiches', 'Flyer de communication', 'Flyer de communication conçu par Golden Studio Plus à Douala.'),
  serviceImage('design-carte-visite', 'design', 'Identité visuelle', 'Carte de visite', 'Exemple de carte de visite et papeterie de marque conçu par Golden Studio Plus.'), serviceImage('design-identite-visuelle', 'design', 'Identité visuelle', 'Identité visuelle', 'Présentation d’identité visuelle conçue par Golden Studio Plus à Douala.'),
  serviceImage('design-objet-personnalise-2', 'design', 'Objets personnalisés', 'Objet personnalisé — réalisation 1', 'Premier exemple d’objet personnalisé conçu par Golden Studio Plus.'), serviceImage('design-objet-personnalise-3', 'design', 'Objets personnalisés', 'Objet personnalisé — réalisation 2', 'Deuxième exemple d’objet personnalisé conçu par Golden Studio Plus.'),
  serviceImage('impression-album-1', 'print', 'Albums', 'Album photo personnalisé', 'Exemple d’album photo personnalisé imprimé par Golden Studio Plus.'), serviceImage('impression-cadre-tirage-2', 'print', 'Cadres et tirages', 'Cadre et tirage photo — réalisation 1', 'Premier exemple de cadre et tirage photo proposé par Golden Studio Plus.'), serviceImage('impression-cadre-tirage-3', 'print', 'Cadres et tirages', 'Cadre et tirage photo — réalisation 2', 'Deuxième exemple de cadre et tirage photo proposé par Golden Studio Plus.'),
];

const ENGLISH_MEDIA = Object.freeze({
  'design-retouche-1': ['Photo retouching', 'Photo retouching — project 1', 'Photo-retouching example created by Golden Studio Plus in Douala.'], 'design-retouche-2': ['Photo retouching', 'Photo retouching — project 2', 'Second photo-retouching example created by Golden Studio Plus in Douala.'], 'design-retouche-3': ['Photo retouching', 'Photo retouching — project 3', 'Third photo-retouching example created by Golden Studio Plus in Douala.'],
  'design-affiche-cadre': ['Flyers & posters', 'Poster and framing', 'Poster design and framed presentation created by Golden Studio Plus.'], 'design-flyer-1': ['Flyers & posters', 'Communication flyer', 'Communication flyer designed by Golden Studio Plus in Douala.'], 'design-carte-visite': ['Visual identity', 'Business card', 'Business card and brand stationery example created by Golden Studio Plus.'], 'design-identite-visuelle': ['Visual identity', 'Visual identity', 'Visual-identity presentation created by Golden Studio Plus in Douala.'],
  'design-objet-personnalise-2': ['Personalised products', 'Personalised product — project 1', 'First personalised-product example created by Golden Studio Plus.'], 'design-objet-personnalise-3': ['Personalised products', 'Personalised product — project 2', 'Second personalised-product example created by Golden Studio Plus.'],
  'impression-album-1': ['Albums', 'Personalised photo album', 'Personalised photo-album example printed by Golden Studio Plus.'], 'impression-cadre-tirage-2': ['Frames & prints', 'Frame and photo print — project 1', 'First frame and photo-print example offered by Golden Studio Plus.'], 'impression-cadre-tirage-3': ['Frames & prints', 'Frame and photo print — project 2', 'Second frame and photo-print example offered by Golden Studio Plus.'],
});

export const serviceMediaFor = (section, locale = 'fr') => SERVICE_MEDIA.filter((item) => item.section === section).map((item) => {
  const translation = locale === 'en' ? ENGLISH_MEDIA[item.slug] : null;
  return translation ? { ...item, category: translation[0], title: translation[1], alt: translation[2] } : item;
});

export const groupServiceMedia = (section, locale = 'fr') => serviceMediaFor(section, locale).reduce((groups, item) => {
  const group = groups.find((entry) => entry.category === item.category);
  if (group) group.items.push(item); else groups.push({ category: item.category, items: [item] });
  return groups;
}, []);
