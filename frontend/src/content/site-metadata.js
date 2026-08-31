import { DEFAULT_LOCALE, SUPPORTED_LOCALES, resolveLocale } from '../lib/i18n.js';
import { alternatePaths, baseRoutePath, localizedPath, PUBLIC_BASE_PATHS, routeLocale } from '../lib/locale-routes.js';

export const SITE_ORIGIN = 'https://gsplus.vip';
export const SOCIAL_IMAGE_PATH = '/images/og-golden-studio-plus-2026.jpg';
export const SOCIAL_IMAGE_ALT = 'Golden Studio Plus — studio photo premium à Douala';
export const SOCIAL_IMAGE_WIDTH = 1200;
export const SOCIAL_IMAGE_HEIGHT = 630;
export const SOCIAL_IMAGE_TYPE = 'image/jpeg';

const route = (path, fr, en) => ({ path, fr, en });
export const BASE_INDEXABLE_ROUTES = Object.freeze([
  route('/', {
    title: 'Golden Studio Plus | Studio photo premium à Douala',
    description: 'Studio photo premium à Douala : portraits, familles, maternité, événements et images corporate, avec une expérience guidée.',
    heading: 'Studio photo premium à Douala',
    summary: 'Golden Studio Plus réalise des portraits, souvenirs de famille, séances maternité, reportages événementiels et visuels corporate à Douala.',
  }, {
    title: 'Golden Studio Plus | Premium photo studio in Douala',
    description: 'Premium photo studio in Douala for portraits, families, maternity, events and corporate imagery, with a fully guided experience.',
    heading: 'Premium photo studio in Douala',
    summary: 'Golden Studio Plus creates portraits, family memories, maternity sessions, event coverage and corporate imagery in Douala.',
  }),
  route('/services', {
    title: 'Séances photo et packs à Douala | Golden Studio Plus',
    description: 'Découvrez les packs photo Golden Studio Plus à Douala : portrait, couple, famille, maternité, anniversaire et pré-mariage.',
    heading: 'Séances photo et packs',
    summary: 'Comparez les formules, durées et tarifs des séances photo proposées par Golden Studio Plus, puis choisissez le pack adapté à votre projet.',
  }, {
    title: 'Photo sessions and packages in Douala | Golden Studio Plus',
    description: 'Explore Golden Studio Plus photography packages in Douala for portraits, couples, families, maternity, birthdays and pre-wedding sessions.',
    heading: 'Photo sessions and packages',
    summary: 'Compare photography packages, durations and prices, then choose the Golden Studio Plus session that suits your project.',
  }),
  route('/portfolio', {
    title: 'Portfolio photo à Douala | Golden Studio Plus',
    description: 'Explorez le portfolio Golden Studio Plus : portraits studio, couples, maternité, corporate et créations photographiques à Douala.',
    heading: 'Portfolio photographique',
    summary: 'Découvrez une sélection de portraits et de projets réalisés par Golden Studio Plus, présentée avec des images optimisées pour tous les écrans.',
  }, {
    title: 'Photography portfolio in Douala | Golden Studio Plus',
    description: 'Explore the Golden Studio Plus portfolio of studio portraits, couples, maternity, corporate work and creative photography in Douala.',
    heading: 'Photography portfolio',
    summary: 'Discover selected portraits and creative projects by Golden Studio Plus, with responsive imagery prepared for every screen.',
  }),
  route('/reservation', {
    title: 'Réserver une séance photo à Douala | Golden Studio Plus',
    description: 'Choisissez votre pack, votre date et votre créneau pour demander une séance photo Golden Studio Plus à Douala.',
    heading: 'Réserver une séance photo',
    summary: 'Préparez votre demande de réservation en sélectionnant une formule et un créneau disponible. La confirmation intervient après contrôle manuel.',
  }, {
    title: 'Book a photo session in Douala | Golden Studio Plus',
    description: 'Choose your package, date and preferred time slot to request a Golden Studio Plus photography session in Douala.',
    heading: 'Book a photo session',
    summary: 'Prepare your booking request by selecting a package and an available time. The studio confirms it after manual review.',
  }),
  route('/services-creatifs', {
    title: 'Design, retouche et impression à Douala | Golden Studio Plus',
    description: 'Retouche photo, design graphique, albums et impressions personnalisées à Douala par Golden Studio Plus.',
    heading: 'Services créatifs',
    summary: 'Golden Studio Plus accompagne vos images après la prise de vue avec des services de retouche, de création graphique et d’impression.',
  }, {
    title: 'Design, retouching and printing in Douala | Golden Studio Plus',
    description: 'Discover photography retouching, graphic design, albums and personalised printing services in Douala by Golden Studio Plus.',
    heading: 'Creative services',
    summary: 'Golden Studio Plus supports your images after the shoot with retouching, graphic design and professional printing services.',
  }),
  route('/a-propos', {
    title: 'À propos du studio | Golden Studio Plus Douala',
    description: 'Découvrez Golden Studio Plus, son approche Afro-Luxe et son accompagnement photographique au cœur de Douala.',
    heading: 'À propos de Golden Studio Plus',
    summary: 'Installé à Douala, Golden Studio Plus associe direction artistique, maîtrise de la lumière et accompagnement personnalisé.',
  }, {
    title: 'About the studio | Golden Studio Plus Douala',
    description: 'Discover Golden Studio Plus, its Afro-Luxe approach and its guided photography experience in the heart of Douala.',
    heading: 'About Golden Studio Plus',
    summary: 'Based in Douala, Golden Studio Plus combines art direction, mastery of light and personalised guidance for every session.',
  }),
  route('/contact', {
    title: 'Contact et horaires | Golden Studio Plus Douala',
    description: 'Contactez Golden Studio Plus à Cité des Palmiers, Douala. Studio ouvert du lundi au samedi de 9 h à 18 h.',
    heading: 'Contacter Golden Studio Plus',
    summary: 'Retrouvez l’adresse, le téléphone, l’e-mail et les horaires publiés du studio Golden Studio Plus à Douala.',
  }, {
    title: 'Contact and opening hours | Golden Studio Plus Douala',
    description: 'Contact Golden Studio Plus in Cité des Palmiers, Douala. The studio is open Monday to Saturday from 09:00 to 18:00.',
    heading: 'Contact Golden Studio Plus',
    summary: 'Find the published address, telephone number, email address and opening hours for Golden Studio Plus in Douala.',
  }),
  route('/corporate', {
    title: 'Photographie corporate à Douala | Golden Studio Plus',
    description: 'Portraits professionnels, équipes et contenus de marque à Douala pour entreprises, institutions et entrepreneurs.',
    heading: 'Photographie corporate',
    summary: 'Golden Studio Plus crée des portraits professionnels et des bibliothèques d’images cohérentes pour les entreprises et leurs équipes.',
  }, {
    title: 'Corporate photography in Douala | Golden Studio Plus',
    description: 'Professional portraits, team photography and brand content in Douala for companies, institutions and entrepreneurs.',
    heading: 'Corporate photography',
    summary: 'Golden Studio Plus creates professional portraits and consistent image libraries for companies, institutions and their teams.',
  }),
  route('/mentions-legales', {
    title: 'Mentions légales | Golden Studio Plus',
    description: 'Consultez les mentions légales, les coordonnées publiées et les informations éditoriales de Golden Studio Plus.',
    heading: 'Mentions légales',
    summary: 'Cette page présente les coordonnées publiées, les responsabilités éditoriales et les informations légales actuellement vérifiées.',
  }, {
    title: 'Legal notice | Golden Studio Plus',
    description: 'Read the Golden Studio Plus legal notice, published contact details, intellectual-property information and editorial responsibilities.',
    heading: 'Legal notice',
    summary: 'This page presents the published contact details, editorial responsibilities and currently verified legal information.',
  }),
  route('/confidentialite', {
    title: 'Politique de confidentialité | Golden Studio Plus',
    description: 'Découvrez comment Golden Studio Plus collecte, utilise, conserve et protège les données liées aux demandes et réservations.',
    heading: 'Politique de confidentialité',
    summary: 'La politique décrit les données collectées, leurs finalités, les prestataires actifs, les durées de conservation et vos droits.',
  }, {
    title: 'Privacy policy | Golden Studio Plus',
    description: 'Learn how Golden Studio Plus collects, uses, retains and protects personal data connected with enquiries, bookings and services.',
    heading: 'Privacy policy',
    summary: 'This policy describes collected data, its purposes, active providers, retention periods and your privacy rights.',
  }),
  route('/cgv', {
    title: 'Conditions générales de vente | Golden Studio Plus',
    description: 'Consultez les conditions de réservation, paiement, report, annulation et livraison de Golden Studio Plus.',
    heading: 'Conditions générales de vente',
    summary: 'Les conditions générales encadrent les demandes de réservation, le contrôle manuel des paiements, les reports et les livraisons.',
  }, {
    title: 'Terms of sale | Golden Studio Plus',
    description: 'Read the Golden Studio Plus terms governing bookings, payment verification, rescheduling, cancellation, delivery and liability.',
    heading: 'Terms of sale',
    summary: 'These terms govern booking requests, manual payment verification, schedule changes, cancellations, delivery and liability.',
  }),
]);

const baseRouteMap = new Map(BASE_INDEXABLE_ROUTES.map((item) => [item.path, item]));
export const INDEXABLE_ROUTES = Object.freeze(SUPPORTED_LOCALES.flatMap((locale) => BASE_INDEXABLE_ROUTES.map((item) => ({
  path: localizedPath(locale, item.path),
  basePath: item.path,
  locale,
  ...item[locale],
}))));
export const COMPATIBILITY_ROUTE_PATHS = PUBLIC_BASE_PATHS;
export const PRIVATE_ROUTE_PATHS = ['/admin', '/admin/login', '/admin/dashboard'];

export const normalizeRoutePath = (pathname = '/') => {
  const withoutQuery = pathname.split(/[?#]/, 1)[0] || '/';
  if (withoutQuery === '/') return '/';
  return withoutQuery.replace(/\/+$/, '') || '/';
};

const absoluteAlternates = (basePath) => {
  const paths = alternatePaths(basePath);
  return {
    fr: SITE_ORIGIN + paths.fr,
    en: SITE_ORIGIN + paths.en,
    xDefault: SITE_ORIGIN + paths.xDefault,
  };
};

export const getRouteMetadata = (pathname, requestedLocale = DEFAULT_LOCALE) => {
  const path = normalizeRoutePath(pathname);
  const detectedLocale = routeLocale(path);
  const locale = detectedLocale || resolveLocale(requestedLocale);
  const basePath = baseRoutePath(path);
  const definition = baseRouteMap.get(basePath);

  if (definition && detectedLocale) {
    const copy = definition[locale];
    return {
      ...copy,
      path,
      basePath,
      locale,
      canonical: SITE_ORIGIN + localizedPath(locale, basePath),
      alternates: absoluteAlternates(basePath),
      image: SITE_ORIGIN + SOCIAL_IMAGE_PATH,
      imageAlt: locale === 'en' ? 'Golden Studio Plus — premium photo studio in Douala' : SOCIAL_IMAGE_ALT,
      imageWidth: SOCIAL_IMAGE_WIDTH,
      imageHeight: SOCIAL_IMAGE_HEIGHT,
      imageType: SOCIAL_IMAGE_TYPE,
      robots: 'index, follow, max-image-preview:large',
      indexable: true,
    };
  }

  if (definition) {
    const copy = definition[locale];
    return {
      ...copy,
      path,
      basePath,
      locale,
      canonical: SITE_ORIGIN + localizedPath(locale, basePath),
      alternates: absoluteAlternates(basePath),
      robots: 'noindex, follow',
      indexable: false,
      compatibility: true,
    };
  }

  const isPrivate = path === '/admin' || path.startsWith('/admin/');
  return {
    path,
    locale,
    title: isPrivate ? 'Administration | Golden Studio Plus' : (locale === 'en' ? 'Page not found | Golden Studio Plus' : 'Page introuvable | Golden Studio Plus'),
    description: isPrivate
      ? (locale === 'en' ? 'Private Golden Studio Plus administration area.' : 'Espace privé d’administration Golden Studio Plus.')
      : (locale === 'en' ? 'The requested page could not be found.' : 'La page demandée est introuvable.'),
    heading: isPrivate ? 'Espace privé' : (locale === 'en' ? 'Private area' : 'Page introuvable'),
    summary: isPrivate
      ? 'Cette interface est réservée à l’administration du studio.'
      : (locale === 'en' ? 'Return home to continue browsing.' : 'Revenez à l’accueil pour poursuivre votre visite.'),
    robots: 'noindex, nofollow',
    indexable: false,
  };
};

export const LOCAL_BUSINESS_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': SITE_ORIGIN + '/#studio',
  name: 'Golden Studio Plus',
  url: SITE_ORIGIN,
  image: SITE_ORIGIN + SOCIAL_IMAGE_PATH,
  logo: SITE_ORIGIN + '/images/optimized/brand-logo-320.webp',
  telephone: '+237673026654',
  email: 'info@gsplus.vip',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Cité des Palmiers',
    addressLocality: 'Douala',
    addressRegion: 'Littoral',
    addressCountry: 'CM',
  },
  areaServed: { '@type': 'City', name: 'Douala' },
  openingHoursSpecification: [{
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: [
      'https://schema.org/Monday', 'https://schema.org/Tuesday', 'https://schema.org/Wednesday',
      'https://schema.org/Thursday', 'https://schema.org/Friday', 'https://schema.org/Saturday',
    ],
    opens: '09:00',
    closes: '18:00',
  }],
};

export const getLocalBusinessSchema = (metadata, settings = {}) => {
  const identity = settings.identity ?? {};
  const seo = settings.seo ?? {};
  const publicName = identity.publicName || LOCAL_BUSINESS_SCHEMA.name;
  return {
    ...LOCAL_BUSINESS_SCHEMA,
    name: publicName,
    telephone: identity.phoneE164 || LOCAL_BUSINESS_SCHEMA.telephone,
    email: identity.email || LOCAL_BUSINESS_SCHEMA.email,
    image: seo.socialImagePath ? SITE_ORIGIN + seo.socialImagePath : LOCAL_BUSINESS_SCHEMA.image,
    address: { ...LOCAL_BUSINESS_SCHEMA.address, streetAddress: identity.addressLine || LOCAL_BUSINESS_SCHEMA.address.streetAddress },
    inLanguage: metadata.locale,
  };
};
