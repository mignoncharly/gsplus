export const SITE_ORIGIN = 'https://gsplus.vip';
export const SOCIAL_IMAGE_PATH = '/images/og-golden-studio-plus.jpg';

export const INDEXABLE_ROUTES = [
  {
    path: '/',
    title: 'Golden Studio Plus | Studio photo premium à Douala',
    description: 'Studio photo premium à Douala : portraits, familles, maternité, événements et images corporate, avec une expérience guidée.',
    heading: 'Studio photo premium à Douala',
    summary: 'Golden Studio Plus réalise des portraits, souvenirs de famille, séances maternité, reportages événementiels et visuels corporate à Douala.',
  },
  {
    path: '/services',
    title: 'Séances photo et packs à Douala | Golden Studio Plus',
    description: 'Découvrez les packs photo Golden Studio Plus à Douala : portrait, couple, famille, maternité, anniversaire et pré-mariage.',
    heading: 'Séances photo et packs',
    summary: 'Comparez les formules, durées et tarifs des séances photo proposées par Golden Studio Plus, puis choisissez le pack adapté à votre projet.',
  },
  {
    path: '/portfolio',
    title: 'Portfolio photo à Douala | Golden Studio Plus',
    description: 'Explorez le portfolio Golden Studio Plus : portraits studio, couples, maternité, corporate et créations photographiques à Douala.',
    heading: 'Portfolio photographique',
    summary: 'Découvrez une sélection de portraits et de projets réalisés par Golden Studio Plus, présentée avec des images optimisées pour tous les écrans.',
  },
  {
    path: '/reservation',
    title: 'Réserver une séance photo à Douala | Golden Studio Plus',
    description: 'Choisissez votre pack, votre date et votre créneau pour demander une séance photo Golden Studio Plus à Douala.',
    heading: 'Réserver une séance photo',
    summary: 'Préparez votre demande de réservation en sélectionnant une formule et un créneau disponible. La confirmation intervient après contrôle manuel.',
  },
  {
    path: '/services-creatifs',
    title: 'Design, retouche et impression à Douala | Golden Studio Plus',
    description: 'Retouche photo, design graphique, albums et impressions personnalisées à Douala par Golden Studio Plus.',
    heading: 'Services créatifs',
    summary: 'Golden Studio Plus accompagne vos images après la prise de vue avec des services de retouche, de création graphique et d’impression.',
  },
  {
    path: '/a-propos',
    title: 'À propos du studio | Golden Studio Plus Douala',
    description: 'Découvrez Golden Studio Plus, son approche Afro-Luxe et son accompagnement photographique au cœur de Douala.',
    heading: 'À propos de Golden Studio Plus',
    summary: 'Installé à Douala, Golden Studio Plus associe direction artistique, maîtrise de la lumière et accompagnement personnalisé.',
  },
  {
    path: '/contact',
    title: 'Contact et horaires | Golden Studio Plus Douala',
    description: 'Contactez Golden Studio Plus à Cité des Palmiers, Douala. Studio ouvert du lundi au samedi de 9 h à 18 h.',
    heading: 'Contacter Golden Studio Plus',
    summary: 'Retrouvez l’adresse, le téléphone, l’e-mail et les horaires publiés du studio Golden Studio Plus à Douala.',
  },
  {
    path: '/corporate',
    title: 'Photographie corporate à Douala | Golden Studio Plus',
    description: 'Portraits professionnels, équipes et contenus de marque à Douala pour entreprises, institutions et entrepreneurs.',
    heading: 'Photographie corporate',
    summary: 'Golden Studio Plus crée des portraits professionnels et des bibliothèques d’images cohérentes pour les entreprises et leurs équipes.',
  },
  {
    path: '/mentions-legales',
    title: 'Mentions légales | Golden Studio Plus',
    description: 'Consultez les mentions légales, les coordonnées publiées et les informations éditoriales de Golden Studio Plus.',
    heading: 'Mentions légales',
    summary: 'Cette page présente les coordonnées publiées, les responsabilités éditoriales et les informations légales actuellement vérifiées.',
  },
  {
    path: '/confidentialite',
    title: 'Politique de confidentialité | Golden Studio Plus',
    description: 'Découvrez comment Golden Studio Plus collecte, utilise, conserve et protège les données liées aux demandes et réservations.',
    heading: 'Politique de confidentialité',
    summary: 'La politique décrit les données collectées, leurs finalités, les prestataires actifs, les durées de conservation et vos droits.',
  },
  {
    path: '/cgv',
    title: 'Conditions générales de vente | Golden Studio Plus',
    description: 'Consultez les conditions de réservation, paiement, report, annulation et livraison de Golden Studio Plus.',
    heading: 'Conditions générales de vente',
    summary: 'Les conditions générales encadrent les demandes de réservation, le contrôle manuel des paiements, les reports et les livraisons.',
  },
];

export const PRIVATE_ROUTE_PATHS = ['/admin', '/admin/login', '/admin/dashboard'];

const indexableRouteMap = new Map(INDEXABLE_ROUTES.map((route) => [route.path, route]));

export const normalizeRoutePath = (pathname = '/') => {
  const withoutQuery = pathname.split(/[?#]/, 1)[0] || '/';
  if (withoutQuery === '/') return '/';
  return withoutQuery.replace(/\/+$/, '') || '/';
};

export const getRouteMetadata = (pathname) => {
  const path = normalizeRoutePath(pathname);
  const route = indexableRouteMap.get(path);

  if (route) {
    return {
      ...route,
      canonical: `${SITE_ORIGIN}${path === '/' ? '' : path}`,
      image: `${SITE_ORIGIN}${SOCIAL_IMAGE_PATH}`,
      robots: 'index, follow, max-image-preview:large',
      indexable: true,
    };
  }

  const isPrivate = path === '/admin' || path.startsWith('/admin/');
  return {
    path,
    title: isPrivate ? 'Administration | Golden Studio Plus' : 'Page introuvable | Golden Studio Plus',
    description: isPrivate
      ? 'Espace privé d’administration Golden Studio Plus.'
      : 'La page demandée est introuvable.',
    heading: isPrivate ? 'Espace privé' : 'Page introuvable',
    summary: isPrivate
      ? 'Cette interface est réservée à l’administration du studio.'
      : 'Revenez à l’accueil pour poursuivre votre visite.',
    robots: 'noindex, nofollow',
    indexable: false,
  };
};

export const LOCAL_BUSINESS_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': `${SITE_ORIGIN}/#studio`,
  name: 'Golden Studio Plus',
  url: SITE_ORIGIN,
  image: `${SITE_ORIGIN}${SOCIAL_IMAGE_PATH}`,
  logo: `${SITE_ORIGIN}/images/optimized/brand-logo-320.webp`,
  telephone: '+237673026654',
  email: 'info@gsplus.vip',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Cité des Palmiers',
    addressLocality: 'Douala',
    addressRegion: 'Littoral',
    addressCountry: 'CM',
  },
  areaServed: {
    '@type': 'City',
    name: 'Douala',
  },
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: [
        'https://schema.org/Monday',
        'https://schema.org/Tuesday',
        'https://schema.org/Wednesday',
        'https://schema.org/Thursday',
        'https://schema.org/Friday',
        'https://schema.org/Saturday',
      ],
      opens: '09:00',
      closes: '18:00',
    },
  ],
};
