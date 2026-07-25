const serviceImage = (slug, section, category, title, alt) => ({
  slug,
  section,
  category,
  title,
  alt,
  src: `/images/services/${slug}-1024.webp`,
  srcSet: `/images/services/${slug}-480.webp 480w, /images/services/${slug}-1024.webp 1024w`,
  sizes: '(max-width: 640px) 92vw, (max-width: 1024px) 45vw, 31vw',
  width: 1024,
  height: 1024,
});

export const SERVICE_MEDIA = [
  serviceImage('design-retouche-1', 'design', 'Retouche photo', 'Retouche photo — réalisation 1', 'Exemple de retouche photo réalisé par Golden Studio Plus à Douala.'),
  serviceImage('design-retouche-2', 'design', 'Retouche photo', 'Retouche photo — réalisation 2', 'Deuxième exemple de retouche photo réalisé par Golden Studio Plus à Douala.'),
  serviceImage('design-retouche-3', 'design', 'Retouche photo', 'Retouche photo — réalisation 3', 'Troisième exemple de retouche photo réalisé par Golden Studio Plus à Douala.'),
  serviceImage('design-affiche-cadre', 'design', 'Flyers et affiches', 'Affiche et mise en cadre', 'Création d’affiche et présentation encadrée conçues par Golden Studio Plus.'),
  serviceImage('design-flyer-1', 'design', 'Flyers et affiches', 'Flyer de communication', 'Flyer de communication conçu par Golden Studio Plus à Douala.'),
  serviceImage('design-carte-visite', 'design', 'Identité visuelle', 'Carte de visite', 'Exemple de carte de visite et papeterie de marque conçu par Golden Studio Plus.'),
  serviceImage('design-identite-visuelle', 'design', 'Identité visuelle', 'Identité visuelle', 'Présentation d’identité visuelle conçue par Golden Studio Plus à Douala.'),
  serviceImage('design-objet-personnalise-2', 'design', 'Objets personnalisés', 'Objet personnalisé — réalisation 1', 'Premier exemple d’objet personnalisé conçu par Golden Studio Plus.'),
  serviceImage('design-objet-personnalise-3', 'design', 'Objets personnalisés', 'Objet personnalisé — réalisation 2', 'Deuxième exemple d’objet personnalisé conçu par Golden Studio Plus.'),
  serviceImage('impression-album-1', 'print', 'Albums', 'Album photo personnalisé', 'Exemple d’album photo personnalisé imprimé par Golden Studio Plus.'),
  serviceImage('impression-cadre-tirage-2', 'print', 'Cadres et tirages', 'Cadre et tirage photo — réalisation 1', 'Premier exemple de cadre et tirage photo proposé par Golden Studio Plus.'),
  serviceImage('impression-cadre-tirage-3', 'print', 'Cadres et tirages', 'Cadre et tirage photo — réalisation 2', 'Deuxième exemple de cadre et tirage photo proposé par Golden Studio Plus.'),
];

export const serviceMediaFor = (section) => SERVICE_MEDIA.filter((item) => item.section === section);

export const groupServiceMedia = (section) => serviceMediaFor(section).reduce((groups, item) => {
  const group = groups.find((entry) => entry.category === item.category);
  if (group) group.items.push(item);
  else groups.push({ category: item.category, items: [item] });
  return groups;
}, []);
