# Golden Studio Plus — Site Web Vitrine (React / Vite)

Bienvenue sur le code source du site web vitrine pour **Golden Studio Plus**.
Ce document a pour but de vous aider à reprendre le projet rapidement et facilement.

## Architecture du Projet

Le projet est deploye en deux parties :

1. **Frontend (`frontend/`)** : site React + Vite, pages publiques, reservation, portfolio et dashboard admin.
2. **Backend (`backend/`)** : API Express, PostgreSQL/Prisma, authentification admin, reservations, paiements, medias, emails et synchronisation Cal.com.

## Demarrage rapide

Assurez-vous d'avoir Node.js installe sur votre machine.

1. Ouvrez votre terminal dans ce dossier (`Version_1.0`).
2. Installez les dépendances :
   ```bash
   npm install
   ```
3. Lancez le serveur de développement local :
   ```bash
   npm run dev
   ```
4. Ouvrez votre navigateur a l'adresse indiquee par Vite.

## Structure des fichiers

* `src/components/` : Contient les composants réutilisables (`Header.jsx`, `Footer.jsx`).
* `src/pages/` : Contient les vues principales du site (`Home.jsx`, `Services.jsx`, `Portfolio.jsx`, `Contact.jsx`, `AdminDashboard.jsx`, etc.).
* `public/` : Contient les images statiques, y compris les images générées par IA pour le portfolio (`portfolio_portrait_2.png`, `hero_banner.png`, dossier `portfolio/`).

## Production

Le frontend de production utilise :

```env
VITE_API_URL=https://gsplus.vip
```

Build :

```bash
npm run build
```

Le dossier `dist/` est servi par Nginx sur le serveur.

La page admin utilise l'API backend :

```text
POST /api/admin/login
GET  /api/admin/me
```

Le mot de passe admin est defini par `ADMIN_PASSWORD` dans `backend/.env` puis applique via `npm run db:seed`.

Bon codage !
