# Plan d’implémentation — Golden Studio Plus

Version du plan : 1er août 2026
Sources normatives : rapport d’audit unifié du 29 juillet 2026, bibliothèque d’e-mails révisée du 30 juillet 2026, textes juridiques consolidés du 31 juillet 2026 et `docs/new_prompt.md`.
Règle d’exécution : un seul problème à la fois, dans l’ordre ci-dessous. Aucun problème suivant ne commence avant preuves complètes et approbation explicite du problème courant.

> **Correction du 9 août 2026** — L’audit indépendant du 9 août 2026 (voir `GOLDEN_STUDIO_PLUS_TRACEABILITY_MATRIX.md`, section « Audit indépendant du 9 août 2026 », et `GOLDEN_STUDIO_PLUS_TEST_REPORT.md`) a établi que la ligne « Notifications » ci-dessous, qui décrivait un état du 1er août 2026 (« six modèles rudimentaires seulement », « pas la cadence normative 0/2/10 min »), ne reflète plus l’état réel du dépôt : les 23 modèles E-xx (+E-04A/B) et 12 modèles I-xx sont implémentés dans `backend/src/emails/templates.ts`/`notifications.ts`, la cadence WhatsApp/Cal.com est bien 0/2/10 min, et l’ensemble est couvert par des tests d’intégration réels et déployé en production. Le NOTIF-01 décrit plus bas comme travail futur était donc déjà très largement réalisé au moment de la lecture de ce plan ; ne pas s’y fier pour évaluer l’état courant — se référer à la matrice de traçabilité mise à jour.

## 1. État initial vérifié

### Architecture réelle

| Domaine | État constaté |
|---|---|
| Frontend | React 19.2, Vite 8, React Router DOM 7, Framer Motion, Lucide React. Application client rendue par `frontend/src/App.jsx`; routes publiques, juridiques et administration dans un même bundle découpé par routes. |
| Backend | Node.js, TypeScript strict, Express 5.2, Zod 4; API montée sous `/api` dans `backend/src/app.ts` et routes publiques/admin/webhooks séparées. |
| Données | PostgreSQL 16, Prisma 7.9 avec dix-neuf migrations SQL. Les dates sont stockées comme instants `DateTime`; conversion métier centralisée partiellement dans `backend/src/utils/business-time.ts` avec `Africa/Douala` (UTC+01:00). |
| Réservation | `ReservationIntent` protège temporairement un créneau; `Reservation` référence un `Customer` mutable et un `PackageVersion` immuable. Référence actuelle `GSPAAAAMMJJ` + dix caractères hexadécimaux. |
| Paiement | `Payment` séparé de `Reservation`; transitions optimistes versionnées. L’API vérifie/rejette un paiement sans confirmer automatiquement, mais l’API de confirmation ne contrôle pas le paiement. |
| Notifications | `NotificationEvent` sert d’outbox. Worker `setInterval` toutes les 15 s; SMTP via Nodemailer/Zoho; Meta Graph API et webhook WhatsApp. Cinq tentatives exponentielles par défaut, pas la cadence normative 0/2/10 min. Six modèles rudimentaires seulement. |
| Calendrier | Appels Cal.com v2 synchrones; journal `CalendarSyncLog`, clé par réservation/version/action et verrou optimiste. Aucun worker de trois reprises ni `nextAttemptAt`, empreinte de charge utile ou version synchronisée. |
| Administration | JWT HS256 en cookie HttpOnly/Secure/SameSite Strict, révocation par `sessionVersion`; rôles `OWNER`/`STAFF` stockés mais aucune permission fine. Actions sensibles encore fondées sur `window.prompt()`/`confirm()`. Chargement global au login et après action, sans rafraîchissement à l’ouverture ni temps réel. |
| Sécurité | Helmet, CORS explicite, rate limiting, honeypot/Turnstile optionnel, Nginx HTTPS/CSP/HSTS, stockage privé des originaux médias. AuditLog générique, sans tous les champs normatifs. |
| Planification | Aucun cron ou timer systemd métier trouvé. Seul le worker de notifications en mémoire est planifié; aucune garantie multi-instance. |
| Cookies/traceurs | Aucun outil publicitaire ou de mesure d’audience trouvé. Seul le cookie strictement nécessaire de session admin est émis. |
| Production | `goldenstudioplus-backend.service`, utilisateur `deploy`, Node `dist/server.js`, port loopback 4000; Nginx sert `frontend/dist`, `/api` et `/uploads`. Endpoints locaux `/health` et `/api/health` conformes. |

### Écarts structurels déjà confirmés

- `findOrCreateCustomer()` recherche par téléphone ou e-mail puis met à jour la fiche trouvée; toutes les réservations reliées relisent donc la dernière identité.
- `Reservation` ne contient ni snapshot client, ni téléphone brut, ni e-mail/adresse de notification figés, ni versions de CGV/confidentialité/droit à l’image.
- Les e-mails, WhatsApp et Cal.com chargent `reservation.customer`; un changement de profil réécrit les futurs destinataires et rendus d’anciens dossiers.
- Le test existant `returns actor...` confirme actuellement une réservation sans paiement vérifié : il documente involontairement P0-04.
- `COMPLETED` et `NO_SHOW` ne contrôlent pas l’heure de fin côté serveur.
- Les pages juridiques affichent encore « 24 juillet 2026 » et ne reprennent pas intégralement le texte normatif du 31 juillet.

### État Git à préserver

Le dépôt était déjà fortement modifié avant ce plan : 44 suppressions suivies, quatre nouveaux documents source et des modifications utilisateur dans `frontend/src/pages/AdminDashboard.jsx` et `.css` relatives au menu admin mobile. Ces changements ne doivent être ni restaurés, ni écrasés, ni attribués aux corrections futures.

### Commandes initiales et résultats

| Commande | Résultat initial |
|---|---|
| `npm ci` dans `backend` | Réussi; 355 paquets installés, audit npm : 0 vulnérabilité. |
| `npm run build` dans `backend` | Réussi; TypeScript strict sans erreur. Sert aussi de vérification de types backend. |
| `npx prisma validate` | Réussi; schéma valide. |
| `npm test` dans `frontend` | Réussi; 37/37 tests. |
| `npm run lint` dans `frontend` | Réussi; aucune erreur. |
| `npm run build` dans `frontend` | Réussi; 2 173 modules, 11 pages indexables, 3 privées et 404 générées; budgets de performance réussis. |
| `npm test` dans `backend` | Bloqué avant découverte des tests : `DATABASE_URL or TEST_DATABASE_URL is required`. Aucun `.env` local; la tentative d’utiliser l’environnement du service a été refusée par la protection `/proc`. |
| `npx prisma migrate status` | Bloqué : `datasource.url property is required`. |
| `npm run test:e2e:local` | Démarrage réussi et sept scénarios Chromium observés conformes, puis canal interrompu; relance Chromium terminée par SIGTERM 143 après trois succès. Suite complète non prouvée. |
| `curl http://127.0.0.1:4000/health` et `/api/health` | Réussi; API locale de production opérationnelle. Aucun appel fournisseur mutatif. |

Actions préalables obligatoires au premier correctif : fournir une `TEST_DATABASE_URL` dédiée et non-production; stabiliser l’exécution Playwright longue; ne jamais utiliser la base de production pour une remise à zéro de tests.

## 2. Registre ordonné des problèmes

| Ordre | Identifiant | Intitulé | Priorité | Source principale |
|---:|---|---|---|---|
| 1 | P0-01 | Immutabilité des coordonnées et consentements par réservation | P0 | Audit §3; prompt §5; e-mails §4/§9 |
| 2 | P0-04 | Paiement et réservation : machines à états distinctes | P0 | Audit §3/§7; prompt §6; CGV §1 |
| 3 | P0-03 | Protection du cycle temporel et des créneaux futurs | P0 | Audit §3; prompt §7; e-mails E-17/E-18 |
| 4 | P0-02 | Synchronisation Cal.com fiable et fidèle | P0 | Audit §3; prompt §8; I-07 |
| 5 | P1-01 | WhatsApp transactionnel entreprise/client | P1 | Audit §4; prompt §9; I-08 |
| 6 | NOTIF-01 | Bibliothèque complète E-01 à E-23, E-04A/B et I-01 à I-12 | P1 | Bibliothèque §§2–10; prompt §10 |
| 7 | P1-02 | Réparer « Proposer mon horaire » | P1 | Audit §5; prompt §12 |
| 8 | VAL-01 | Validation téléphone/e-mail client et serveur | P1 | Audit §5.1/5.2; prompt §13 |
| 9 | P1-03 | Remplacer tous les dialogues natifs métier | P1 | Audit §6; prompt §14 |
| 10 | P1-04 | Versionnement/publication des tarifs et mentions | P1 | Audit §6; prompt §15 |
| 11 | UI-WA-01 | Identité, accessibilité et position du bouton WhatsApp | P1 | Audit §4.1; prompt §9 |
| 12 | REF-01 | Référence publique courte stable `GSP-AAMMJJ-XXXX` | P1 | Audit §4.4; prompt §11 |
| 13 | P2-01 | Erreurs françaises localisées près des champs | P2 | Audit §5.2; prompt §18 |
| 14 | P2-02 | Rafraîchissement fiable de l’administration | P2 | Audit §6.1; prompt §17 |
| 15 | P2-03 | États désactivés explicites et accessibles | P2 | Audit §5.3; prompt §18 |
| 16 | P2-04 | Libellés français, accents, dates, devise et statuts | P2 | Audit §6.1/§10; prompt §18 |
| 17 | P2-05 | Navigation interne et remise en haut | P2 | Audit corrections de lecture/§11; prompt §19 |
| 18 | P2-06 | Non-régression responsive | P2 | Audit §5/§11; prompt §19 |
| 19 | LEG-01 | Alignement des mentions légales | Transverse | Textes juridiques, Mentions légales |
| 20 | LEG-02 | Alignement de la politique de confidentialité | Transverse | Textes juridiques, Confidentialité §§1–10 |
| 21 | LEG-03 | Alignement des CGV et rétractation | Transverse | Textes juridiques, CGV §§1–8 |
| 22 | LEG-04 | Consentements, preuve, retrait et versionnement | Transverse | Confidentialité §§2/3/9; CGV §4 |
| 23 | LEG-05 | Conservation, archivage, sécurité et demandes de droits | Transverse | Confidentialité §§6/8/9 |
| 24 | LEG-06 | Cookies et traceurs selon usage réel | Transverse | Confidentialité §7; prompt §16.8 |
| 25 | LEG-07 | Droit à l’image et données de prestation | Transverse | Confidentialité §§5/9; CGV §§4–6 |

## 3. Cartographie et tâches atomiques

Chaque fiche ci-dessous précise les composants, données, API, migration, tests, critère et preuve. Les fichiers exacts pourront être affinés après le test rouge du problème concerné, sans élargir son périmètre.

### P0-01 — Immutabilité par réservation

- Impact : critique métier, confidentialité, preuve contractuelle et risque d’envoi à un tiers.
- Composants : `schema.prisma`, nouvelle migration, `reservations.ts`, requêtes admin, `notifications.ts`, `calendar.ts`, réponses publiques, tests d’intégration.
- Données : conserver `Customer` comme profil courant; ajouter un `ReservationSnapshot` 1:1 immuable comprenant prénom/nom, téléphone brut, téléphone E.164, e-mail, adresse de notification, source, formule/version, créneau/durée, montant/devise, choix et versions de CGV/confidentialité/image/WhatsApp, dates d’acceptation et empreintes de preuve. Ajouter la relation au dossier et une protection SQL contre UPDATE/DELETE applicatif.
- Migration : créer la table et index; backfiller chaque réservation depuis `Customer`, `PackageVersion` et `Reservation`; marquer les preuves historiques inconnues `HISTORICAL_BACKFILL_UNVERIFIED`; contrôler nombre de lignes, doublons et valeurs nulles; rendre le snapshot obligatoire pour toute nouvelle réservation. Rollback non destructif : désactiver d’abord les lectures snapshot, conserver la table; ne jamais écraser `Customer`.
- API/code : créer snapshot et réservation dans la même transaction; ne plus mettre à jour une fiche partagée par simple collision téléphone/e-mail; toutes notifications, exports, administration et Cal.com lisent le snapshot; journaliser toute incohérence profil/snapshot par événement dédupliqué I-10.
- Tests rouges : six réservations, même téléphone, six identités/e-mails/consentements; mise à jour du profil après création; destinataires d’e-mails avant/après; notification en file avant changement de profil; reprise/idempotence; backfill historique; tentative de mutation SQL/applicative du snapshot; concurrence.
- Critère/preuve : six snapshots et six destinataires indépendants; diff SQL avant/après; résultats ciblés + suite complète; requêtes anonymisées montrant les six lignes; aucun secret ou donnée réelle dans la preuve.

### P0-04 — Paiement et réservation distincts

- Composants : enums/schema et migration, `status-transitions.ts`, route admin, `admin-workflow.js`, dashboard, outbox, audit.
- Données/API : ajouter `PAYMENT_INFO_REQUIRED` et `VERIFICATION_BLOCKED`; centraliser les gardes. `CONFIRMED` exige `VERIFIED|PAID`; actions vérifier, rejeter, demander information, bloquer, confirmer, refuser et « vérifier et confirmer » atomique avec commande/idempotency key/version attendue.
- Tests : table complète des transitions; appel API direct; double clic/concurrence; `PENDING+PENDING`; `VERIFIED+PENDING`; rollback atomique de l’action combinée; E-03/E-05; motif obligatoire et permissions.
- Critère : vérification seule laisse la réservation en attente; confirmation impossible avant paiement autorisé; audit ancien/nouveau état, auteur, motif et corrélation.

### P0-03 — Temps et disponibilité

- Composants : machine d’états, `business-time.ts`, `booking-slots.ts`, route/admin UI, permissions et audit.
- Données/API : garde serveur `now >= endAt`; horloge injectable; permission dédiée de dérogation, motif, indicateur, auteur/date; les statuts anticipés ne libèrent jamais un créneau futur.
- Tests : -1 min, exacte, +1 min, UTC/Douala, changement de jour, API/UI, double-booking, dérogation avec/sans droit/motif.
- Critère : aucune clôture normale avant fin; disponibilité et statistiques cohérentes.

### P0-02 — Cal.com

- Composants : `CalendarSyncLog`, migration, `calendar.ts`, worker durable, admin/API, I-07.
- Données : état `NOT_REQUIRED|PENDING|SYNCING|SYNCED|RETRYING|FAILED`, opération, `nextAttemptAt`, succès, version réservation, idempotence, empreinte du payload, erreur assainie et identifiant distant.
- Code : create/update/cancel; cadence 0/2/10 min; détection d’un succès distant après rupture réseau; reprise manuelle idempotente; aucune bannière de succès sur HTTP 400.
- Tests/preuves : succès, 400, 500, timeout, reprise, réponse perdue, retry après succès, report, annulation, fuseau et zéro doublon; preuve sandbox/fournisseur avec identifiant et horaire avant approbation.

### P1-01 — WhatsApp

- Composants : outbox/worker/webhook, configuration Meta, snapshot, dossier admin, bouton d’écriture.
- Données : notification entreprise à chaque création sans dépendre du consentement client; notification client uniquement avec règle et consentement; rendu/version/idempotence/delivery; cadence 0/2/10 min; I-08 après troisième échec.
- Tests/preuves : consentement vrai/faux, entreprise, client, webhook livré/lu/échoué, masquage, reprise et preuve fournisseur réelle.

### NOTIF-01 — E-mails normatifs

- Composants : registre versionné de templates, moteur de rendu validé, outbox durable, scheduler, bounce/webhook SMTP si disponible, admin et digest.
- Données : modèle/version, événement, destinataire snapshot, sujet/préheader/rendu reconstituable, variables validées, clé `événement+modèle+version réservation`, statut/tentatives/fournisseur.
- Implémentation atomique par modèle : E-01…E-23, E-04A/B puis I-01…I-12; chaque modèle reçoit un test de déclenchement et un test de non-envoi. E-03 à +5 min annulable; I-03 à +30 min; I-11 à 18 h Douala vide = aucun envoi; I-07/I-08 après trois échecs; I-01/I-02 exclusifs.
- Preuves : snapshots texte/HTML, adresse distribuable autorisée, journaux Zoho masqués, idempotence et fuseau.

### P1-02 — Proposer mon horaire

- Cause actuelle : `clearVerifiedSelection()` efface `formData.date/time`; `holdSlot()` efface aussi la sélection avant la réponse.
- Code : distinguer saisie libre et créneau vérifié; préserver toute autre donnée; états chargement/disponible/occupé/passé/fermé/durée/erreur; empêcher double soumission.
- Tests : cas normatifs, retour arrière, rafraîchissement contrôlé, mobile, clavier et conservation du profil déjà saisi.

### VAL-01 — Téléphone/e-mail

- Code : schéma partagé ou vecteurs identiques frontend/backend; conserver valeur brute et normalisée; formats camerounais seulement selon règle validée; e-mail trim et syntaxe; détails Zod traduits et reliés aux champs.
- Tests : `640 70 32 49` → `+237640703249`, formats +237/00237/local, longueurs/caractères invalides, e-mails limites, WhatsApp sans téléphone.

### P1-03 — Modales métier

- Remplacer chaque `prompt/confirm` de réservation, paiement, report, blocage, tarif, lead et notification par une modale accessible réutilisable; champs structurés, validation, focus trap/retour, chargement, double clic et erreur réelle.
- Tests : recherche statique zéro `window.prompt|alert|confirm`; clavier/Escape/focus/mobile; validations serveur et audit.

### P1-04 — Tarifs et mentions

- Données : compléter `PackageVersion` par contenu/inclusions/conditions/statut/auteur/date d’effet/publication; snapshot tarif conservé par réservation.
- Workflow : brouillon, validation, aperçu, publication, duplication, archivage, suppression protégée; publication interdite sans mentions approuvées.
- Tests : cycle complet et prix/texte historique inchangés.

### UI-WA-01 et REF-01

- UI-WA-01 : remplacer l’icône générique par l’actif officiel blanc, fond `#25D366`, zone sûre via variables/insets; tests 390×844, largeurs contractuelles, portrait/paysage, clavier et aucun recouvrement.
- REF-01 : générer `GSP-AAMMJJ-XXXX` avec alphabet non ambigu, collision retry, contrainte unique/index, immutabilité; migration conservant les anciennes références via colonne publique dédiée si nécessaire; tests de collision, recherche et stabilité après report.

### P2-01 à P2-06

- P2-01 : erreurs API structurées par champ, dictionnaire français, `aria-describedby`, valeurs préservées; tests formulaire/API.
- P2-02 : revalidation à l’ouverture, bouton actualiser, horodatage; choisir polling modéré conditionnel ou SSE après mesure; aucun rechargement complet.
- P2-03 : styles `disabled`, texte expliquant le prérequis, pas couleur seule; tests axe et visuels.
- P2-04 : dictionnaire central des statuts/termes, formatteurs Douala/FCFA; tests statiques et UI.
- P2-05 : conserver `ScrollManager`; couvrir tous liens header/footer bureau/mobile, avant/arrière et focus.
- P2-06 : matrice 320/390/768/992/1280+, orientations, zoom 200 %, clavier mobile; protéger aussi les modifications locales du menu admin.

### LEG-01 à LEG-07

- LEG-01 : publier fidèlement les mentions légales du 31 juillet, sans inventer les mentions officielles absentes; conserver les informations vérifiées utiles existantes si non contradictoires.
- LEG-02 : aligner toutes les catégories, finalités, destinataires/transferts, conservation, sécurité et droits; date 31 juillet 2026.
- LEG-03 : publier CGV §§1–8, règle paiement, annulations, reports, rétractation 15 jours et état d’exécution; workflow de demande et décision motivée.
- LEG-04 : registre de versions juridiques, preuves de consentement distinctes, retrait futur, finalité/portée; aucune case précochée.
- LEG-05 : politiques exécutables de rétention/archivage restreint/anonymisation, sauvegardes, registre des demandes d’accès/rectification/limitation/opposition/portabilité/retrait/effacement.
- LEG-06 : conserver l’absence actuelle de traceur facultatif; inventaire automatique; si ajout futur, CMP avec refus aussi accessible et retrait. Le cookie admin reste nécessaire.
- LEG-07 : autorisation/refus/retrait d’image séparés; finalité, portée, version/date; stockage privé, livraison vérifiée et retrait prospectif.
- Tests communs : texte normatif, liens croisés, responsive, consentements, droits, permissions, conservation et absence de traceur avant consentement.

## 4. Non-régression obligatoire

À chaque problème, exécuter les tests ciblés puis backend intégration, frontend unitaires, Playwright local, lint, types/build, Prisma validate/migrate sur base dédiée. Préserver explicitement : login admin; réservation standard et durée; double-booking nominal; blocages; références fictives sans débit; B2B et statut; portfolio; pages légales; Facebook/Instagram et ajout LinkedIn validé; tarifs; consentements; navigation/scroll; responsive; pictogrammes existants.

Les tests fournisseur utilisent sandbox ou opérations non financières autorisées. Aucune preuve Cal.com/WhatsApp/Zoho n’est déclarée réussie sans identifiant ou réception réelle.

## 5. Déploiement, contrôle et rollback communs

1. Sauvegarde logique chiffrée et contrôle de restauration avant toute migration risquée.
2. Migration additive compatible avec l’ancienne version; backfill contrôlé; déploiement backend; worker; frontend; activation éventuelle par feature flag réel.
3. Contrôles post-déploiement : santé, migrations, erreurs 5xx, files en attente/échec, doublons, latence, cohérence snapshots, Cal.com/WhatsApp/e-mail.
4. Rollback applicatif vers la version compatible précédente; ne jamais supprimer les colonnes ou preuves nouvellement écrites pendant le rollback d’urgence.
5. Migration descendante seulement si supportée et sans perte; sinon procédure de roll-forward documentée.
6. Aucun déploiement production avant approbation explicite du problème.

## 6. Premier problème autorisable : P0-01

Le premier changement sera exclusivement P0-01. Avant implémentation :

1. configurer une base `_test` isolée;
2. écrire le scénario rouge à six identités partageant `+237640703249` et démontrer la réécriture actuelle;
3. écrire le test rouge d’un événement en file dont le destinataire change après mise à jour du profil;
4. écrire les tests de backfill et d’immutabilité;
5. présenter les échecs initiaux;
6. seulement ensuite appliquer migration et code P0-01.

Éléments explicitement hors P0-01 : garde de confirmation paiement, temps, reprise Cal.com, nouveaux templates, modales, référence courte et corrections visuelles. Ils ne seront pas anticipés.

## 7. Exécution P0-01 au 31 juillet 2026

État : implémentation terminée et validée sur PostgreSQL jetable; déploiement production validé le 1er août 2026.

- Le scénario rouge a reproduit la fuite : six dossiers affichaient `Identite6` avant correction.
- La migration additive crée/backfille `ReservationSnapshot`, protège UPDATE/DELETE direct et ajoute le registre dédupliqué I-10.
- Les notifications et Cal.com utilisent exclusivement le snapshot et refusent une livraison si celui-ci manque.
- L’API publique et l’admin priorisent le snapshot; le frontend conserve un fallback de rolling deployment jusqu’au redémarrage backend.
- Preuves : backend 51/51, frontend 37/37, lint/build conformes, Playwright local 32/32, backfill fictif et immutabilité conformes.
- Baseline production non destructif avant déploiement : E2E 22/22 et axe 2/2.
- Rapport détaillé : `GOLDEN_STUDIO_PLUS_TEST_REPORT.md`; changelog : `GOLDEN_STUDIO_PLUS_CHANGELOG.md`.

## 8. Déploiement contrôlé P0-01 au 1er août 2026

État : migration, redémarrage et preuves post-déploiement terminés; backend stable sur le processus démarré le 1er août à 07:05:31 UTC.

- Préflight production : 13 réservations, zéro lien client ou version de formule manquant; P0-01 était l’unique migration en attente.
- Sauvegarde logique chiffrée et restreinte créée sous `.phase0-backups/20260801-054250-pre-p0-01/`; catalogue `pg_restore` de 124 entrées vérifié après déchiffrement, empreinte SHA-256 enregistrée dans le rapport.
- Migration `20260731195200_p0_01_reservation_snapshot` appliquée avec succès; schéma Prisma production à jour.
- Intégrité après backfill : 13 réservations = 13 snapshots; zéro snapshot manquant, orphelin, dupliqué ou champ obligatoire nul; zéro incident I-10.
- Preuve production transactionnelle puis `ROLLBACK` : six identités/e-mails indépendants sur un même téléphone, mutation du profil sans effet, UPDATE/DELETE du snapshot bloqués et zéro ligne fictive persistée.
- Contrôles publics après migration : santé 200/200, Playwright production 22/22 et axe 2/2; aucun nouvel événement notification/calendrier ni incident d'intégrité pendant le contrôle.
- Le premier redémarrage a révélé l’absence de `backend/.env`; systemd a effectué 45 reprises. Le fichier courant, vérifié par le manifeste Phase 12, a été restauré en mode 0600 sans afficher ni modifier de secret.
- Après récupération : processus stable, `/health`, `/api/health` et `/api/packages` à 200; 13/13 snapshots, zéro incident ou nouvel échec de file; Playwright 22/22 et axe 2/2.

P0-01 est `VALIDÉ-PROD`. P0-04 devient le prochain et seul problème autorisé; tous les problèmes suivants restent non commencés.

## 9. Exécution P0-04 au 1er août 2026

État : `VALIDÉ-PROD`; implémentation, sauvegarde, migrations, redémarrage et preuves post-déploiement terminés le 1er août 2026.

- Défaut initial : l’API permettait de demander `CONFIRMED` sans paiement autorisé et l’interface appelait les anciennes mutations sans commande idempotente ni version attendue.
- Cause racine : gardes dispersées, absence de permission fine et de commande durable, actions UI non corrélées, et notification E-03 immédiate sans fenêtre d’annulation.
- Schéma : ajout des états `PAYMENT_INFO_REQUIRED`, `VERIFICATION_BLOCKED`, `PAID`, de `AdminCommand`, puis de `NotificationStatus.CANCELLED` pour supprimer durablement E-03 lorsqu’E-05 prend le relais.
- Serveur : matrices centralisées, garde `VERIFIED|PAID`, décisions séparées, action atomique « vérifier et confirmer », contrôle optimiste, idempotence, permissions OWNER, audit ancien/nouveau état/auteur/motif/commande.
- Notifications : vérification seule planifie E-03 à +5 minutes; confirmation dans la fenêtre annule E-03 et crée E-05 une seule fois; l’action combinée ne crée jamais E-03.
- Interface : toutes les décisions distinctes sont exposées; confirmation désactivée avant paiement autorisé; actions OWNER désactivées pour STAFF; commande UUID et versions attendues envoyées; verrou synchrone contre le double clic.
- Tests : matrice cartésienne complète, API directe, idempotence, concurrence, rollback atomique, motifs, permissions, E-03/E-05 et navigateur Chromium/WebKit.
- Preuves locales : Prisma valide; backend 50/50; frontend 39/39; lint et builds réussis; Playwright local 34/34.
- Baseline production non destructive : Playwright 22/22 et axe 2/2; `/api/health` HTTP 200. Le chemin public `/health` retourne actuellement 404 contrairement au rapport P0-01 et doit être clarifié au préflight de déploiement.
- Préflight migration en lecture seule : les deux migrations P0-04 `20260801072000_p0_04_payment_reservation_commands` et `20260801094000_p0_04_notification_scheduling` sont les seules migrations en attente sur la base configurée.
- Hors périmètre inchangé : I-03 à +30 minutes reste dans NOTIF-01; les modales accessibles remplaçant les dialogues natifs restent dans P1-03; P0-03 et tous les problèmes suivants ne sont pas commencés.

P0-04 est `VALIDÉ-PROD`. P0-03 devient le prochain et seul problème autorisé; il reste non commencé jusqu’à son propre scénario rouge et plan de preuve.

## 10. Déploiement contrôlé P0-04 au 1er août 2026

- Préflight production agrégé conforme : 13 réservations = 13 snapshots, zéro manque ou incident; états paiement/réservation inchangés.
- Sauvegarde chiffrée 0600 : `.phase0-backups/20260801-102122-pre-p0-04/database-pre-p0-04.dump.enc`; SHA-256 `f98f857eff1191a1f4a0b421e7824bf142c927ae90fba06b7e6518a37cfc7d0a`.
- Déchiffrement de contrôle identique au dump clair; catalogues `pg_restore` identiques de 143 objets; tous les fichiers clairs temporaires supprimés.
- Les deux seules migrations en attente ont été appliquées; Prisma confirme 14/14 migrations à jour.
- Prisma Client, backend et frontend reconstruits; budgets frontend conformes.
- Le compte deploy ne disposant pas du contrôle systemd interactif, le PID deploy-owned a reçu le `SIGTERM` configuré; `Restart=always` a lancé PID 3793097 à 10:35:53 UTC. Le processus est resté stable.
- Postflight : `AdminCommand` présent/vide, enums complets, comptages métier inchangés, santé locale 200/200 et API publique 200.
- Production read-only : Playwright Chromium/WebKit 22/22 et axe 2/2.
- Observation : aucun nouvel événement/échec notification/calendrier, incident, commande ou audit P0-04 depuis le redémarrage.
- Nginx ne proxyfie que `/api/`; le chemin public `/health` à 404 est donc un écart de documentation hors P0-04, sans effet sur `/api/health` ni les contrôles de sécurité.

P0-04 est `VALIDÉ-PROD`. P0-03 est le prochain problème autorisé.

## 11. Exécution P0-03 au 1er août 2026

État : `VALIDÉ-PROD`; implémentation, redémarrage contrôlé et preuves post-déploiement terminés le 1er août 2026.

- Défaut initial : un appel direct `CONFIRMED → COMPLETED` avant `endAt` répondait 200 et libérait immédiatement le créneau, car la disponibilité ne bloquait que `PENDING_CONFIRMATION|CONFIRMED`.
- Preuve rouge : le scénario API « rejects a direct early completion » a échoué avec `expected 409, got 200` sur la base dédiée `goldenstudioplus_db_test`.
- Cause racine : la matrice autorisait `COMPLETED|NO_SHOW` sans garde temporelle, la route ne distinguait aucune dérogation et les requêtes de disponibilité utilisaient une liste de statuts statique.
- Serveur : garde centrale `now >= endAt` avec horloge injectable; erreurs dédiées avant fin; version attendue acceptée pour la clôture; instant de changement cohérent avec l’horloge de décision.
- Dérogation : permission dédiée `RESERVATION_EARLY_CLOSE_OVERRIDE` réservée à OWNER, confirmation explicite et motif obligatoires, auteur/date/ancien/nouvel état dans les journaux, métadonnée visible et audit `reservation.early_close_override`.
- Disponibilité : une réservation clôturée par dérogation reste bloquante tant que son `endAt` futur n’est pas atteint; la création d’un intent concurrent reste refusée.
- Interface : actions normales `COMPLETED|NO_SHOW` désactivées avant la fin; actions distinctes de dérogation OWNER; motif/confirmation explicites; version attendue envoyée; historique marqué « Dérogation temporelle ».
- Fuseau : comparaison d’instants indépendante du fuseau, avec scénarios -1/0/+1 minute et créneau traversant minuit en `Africa/Douala`.
- Migration : aucune. P0-03 réutilise `ReservationTransition.metadata`, `AuditLog` et les rôles existants; la base de test reste à 14/14 migrations.
- Preuves : backend ciblé 4/4 puis complet 54/54; frontend 41/41; Prisma valide; TypeScript, lint et builds réussis; Playwright ciblé 2/2 et complet 36/36 sous Chromium/WebKit.
- Baseline publique read-only sur les actifs statiques régénérés : production E2E 22/22, axe 2/2, `/api/health` et `/api/packages` 200; aucune connexion admin ni écriture.
- Hors périmètre : les modèles E-17/E-18 restent dans NOTIF-01; le remplacement des `prompt/confirm` reste dans P1-03; P0-02 et les problèmes suivants ne sont pas commencés.
- État de livraison : actifs backend/frontend alignés; PID 4029461 actif depuis 13:32:46 UTC après arrêt gracieux du PID 3793097 et reprise systemd `NRestarts` 46→47.

P0-03 est `VALIDÉ-PROD`. P0-02 devient le prochain et seul problème autorisé; il reste non commencé jusqu’à son propre scénario rouge et plan de preuve.

## 12. Déploiement contrôlé P0-03 au 1er août 2026

- Déploiement code-only : aucune migration, aucun backfill et aucune mutation métier; production déjà à 14/14 migrations.
- Préflight : PID 3793097 actif, santé/API 200, protection admin 401, 13 réservations/13 snapshots, zéro manque ou incident; compteurs notification/calendrier historiques inchangés.
- Les artefacts compilés contenaient la garde temporelle, la permission de dérogation, l’audit et la règle de disponibilité avant activation.
- Redémarrage : SIGTERM gracieux du processus deploy-owned; `Restart=always` a lancé PID 4029461 à 13:32:46 UTC, `NRestarts` 46→47, journal de démarrage normal et écoute `127.0.0.1:4000`.
- Postflight : `/health`, `/api/health` et `/api/packages` 200; `/api/admin/me` non authentifié 401; production E2E 22/22 et axe 2/2.
- Intégrité : états des 13 réservations et 13 paiements identiques, 13 snapshots, zéro manque, zéro incident ouvert et `AdminCommand` vide.
- Observation : zéro nouvel événement notification/calendrier, incident, audit ou dérogation; PID, reprise et santé stables.
- Aucun formulaire, aucune connexion admin et aucun appel Cal.com, WhatsApp ou Zoho n’ont été déclenchés.

P0-03 est `VALIDÉ-PROD`. P0-02 est le prochain problème autorisé.

## 13. Exécution P0-02 au 1er août 2026

État : `VALIDÉ-PROD`; code, preuve fournisseur officielle, sauvegarde, migrations, redémarrage et preuves post-déploiement terminés le 1er août 2026.

- Preuve rouge : une erreur fournisseur au premier essai produisait immédiatement `FAILED`; le test exigeant `RETRYING` et une échéance à +2 minutes a échoué avec `expected RETRYING, received FAILED`.
- Schéma : deux migrations additives ajoutent `payloadHash`, `reservationVersion`, `nextAttemptAt`, `syncedAt`, la valeur par défaut de trois tentatives, les états fidèles et le backfill de l’heure des succès historiques.
- Ledger : opérations explicites `CREATE|UPDATE|CANCEL`, clé stable par réservation/version/opération, empreinte SHA-256 de la charge utile, identifiant distant, tentative, échéance, verrou, erreur assainie et date de succès.
- Worker : première tentative immédiate, puis reprises durables à +2 et +10 minutes; récupération des verrous périmés; aucun succès enregistré sans identifiant fournisseur confirmé.
- Idempotence : une reprise ambiguë réconcilie d’abord Cal.com via la métadonnée `gspCalendarKey`; création concurrente, réponse perdue, rejeu manuel, report et annulation ne créent pas de doublon.
- Incident I-07 : un seul événement admin est placé dans l’outbox après la troisième défaillance fournisseur, jamais avant.
- Administration : état réel, prochaine tentative, date de synchronisation et commande de reprise explicite/idempotente; `SYNCING` seul bloque le bouton.
- Fuseau : Cal.com reçoit l’instant UTC ISO et l’invité `Africa/Douala`; timeout fournisseur configurable sans fuite de secret.
- Preuves locales finales : test P0-02 13/13; backend complet 60/60; frontend 41/41; Playwright local Chromium/WebKit 36/36; Prisma valide; TypeScript, ESLint, builds et `git diff --check` conformes; chaîne 16/16 rejouée depuis zéro sur un schéma PostgreSQL jetable puis supprimé.
- Contrat Cal.com corrigé pendant la preuve : bookings create/report/cancel en `2026-02-25`, listing bookings en `2026-05-01` et event-types en `2024-06-14`; le report n’envoie plus la propriété `metadata`, interdite par le contrat courant.
- Preuve fournisseur officielle : création UID `mdd1YizBWCohAHZGYjJxc7` le 31 août 2026 à 07:00 UTC/08:00 Douala, report vers le 1er septembre 2026 à 07:00 UTC/08:00 Douala avec UID `wkQeDWmiL1ECtQ7U836rgk`, puis annulation HTTP 200; aucun événement de test actif ne subsiste.

P0-02 est `VALIDÉ-PROD`. P1-01 devient le prochain et seul problème autorisé.

## 14. Déploiement contrôlé P0-02 au 1er août 2026

- Sauvegarde : dump PostgreSQL custom chiffré AES-256-CBC/PBKDF2 dans `.phase0-backups/20260801-145657-pre-p0-02`; checksum chiffré `0445f8baa174d867e191eee6f16cb773d406bbf02dc1979c1de571f30d9ddb3c`, déchiffrement byte-identique et catalogue `pg_restore` identique; fichiers conservés en mode 0600 et copies claires temporaires supprimées.
- Migrations : `20260801140000_p0_02_calendar_ledger` et `20260801140500_p0_02_calendar_synced_backfill` appliquées; production à 16/16. Colonnes, valeurs par défaut, unicité et index de reprise vérifiés; aucun `SYNCED` sans `syncedAt`.
- Redémarrage : arrêt gracieux du PID 4029461; systemd a lancé le PID 4180053 à 15:07:44 UTC, `NRestarts` 47→48. Le processus est resté actif et les journaux ne montrent que le démarrage normal sur `127.0.0.1:4000`.
- Santé : `/health` local et `/api/health` public à 200, `/api/packages` à 200, `/api/admin/me` non authentifié à 401. La santé Cal.com est 200, event type `5733625` trouvé, avec les trois versions d’API attendues.
- Intégrité : 13 réservations, 13 paiements, 13 snapshots, zéro snapshot manquant, zéro incident ouvert et zéro commande admin. Le backfill produit 8 lignes historiques `FAILED` et 3 `NOT_REQUIRED` sans nouvelle tentative automatique.
- Production read-only : Playwright Chromium/WebKit 22/22 et axe 2/2.
- Observation : les deux snapshots après redémarrage sont identiques; 11 lignes calendrier, 43 notifications, 57 audits, mêmes dates maximales historiques, aucun nouvel incident, événement, audit ou redémarrage.

P0-02 est `VALIDÉ-PROD`. P1-01 est le prochain problème autorisé; tous les suivants restent non commencés.

## 15. Exécution locale P1-01 au 1er août 2026

État : `IMPLÉMENTÉ-ISOLÉ`; code et non-régression locale conformes. La configuration Meta, la preuve fournisseur officielle et le déploiement du code avec redémarrage restent obligatoires avant `VALIDÉ-PROD`. Les migrations additives ont été appliquées prématurément en production pendant NOTIF-01; elles ne constituent pas un déploiement fonctionnel.

- Preuve rouge initiale : 5/5 scénarios ciblés échouaient — aucune trace WhatsApp entreprise/client, reprise à +1 au lieu de +2 minutes, absence de `readAt`, échec webhook terminal prématuré et impossibilité de livrer le modèle entreprise sans consentement client.
- Preuve rouge complémentaire : le compteur global ne conservait pas chaque tentative; l’accès attendu à `NotificationAttempt` échouait avant l’ajout du ledger détaillé.
- Routage : chaque nouvelle réservation journalise une notification WhatsApp entreprise, indépendamment du consentement client et de l’activation du worker; une notification client n’est créée que si le consentement immuable du snapshot l’autorise.
- Preuve figée : destinataire, code/version de modèle, paramètres/rendu reconstituable, audience, statut, échéance, erreur assainie et clé d’idempotence sont persistés dans `NotificationEvent`.
- Tentatives : `NotificationAttempt` conserve chaque essai, son numéro, début/fin, statut, identifiant/statut fournisseur et erreur assainie; unicité par notification/numéro et suppression en cascade.
- Worker : trois tentatives WhatsApp à 0, +2 et +10 minutes; les délais et tentatives e-mail existants restent inchangés.
- Livraison Meta : timeout configurable, identifiant fournisseur obligatoire, aucune réponse brute ni jeton persisté; la notification entreprise ne dépend jamais du consentement client.
- Webhooks : signatures HMAC existantes conservées; états `delivered`, `read` et `failed` corrélés à l’essai fournisseur, progression livré/lu monotone, `readAt` persisté, échec non terminal remis en file.
- Incident I-08 : événement e-mail interne dédupliqué uniquement après le troisième échec WhatsApp; absent après les essais 1 et 2, erreur réduite à un code sûr.
- Administration : consentement WhatsApp et date affichés dans le dossier; action préremplie « Écrire au client sur WhatsApp » uniquement avec snapshot consenti, sinon bouton désactivé explicite. Modèle/version, livraison/lecture et historique des tentatives sont consultables; identifiant fournisseur masqué.
- Performance : panneau WhatsApp admin chargé paresseusement dans un chunk privé de 1,33 Ko; chunk admin principal 48 154 octets, sous le budget de 50 000.
- Migrations : `20260801153000_p1_01_whatsapp_ledger` et `20260801154500_p1_01_notification_attempts`; chaîne complète 18/18 rejouée depuis zéro sur un schéma jetable de `goldenstudioplus_db_test`, quatre colonnes et table d’essais vérifiées, schéma supprimé.
- Preuves locales : P1-01 backend 5/5; backend complet 65/65; frontend 43/43; Playwright P1-01 Chromium/WebKit 2/2 et complet 38/38; Prisma valide; TypeScript, ESLint, build/prerender/budgets et `git diff --check` conformes.
- Gate production : livraison WhatsApp actuellement désactivée; phone-number ID, jeton, secrets webhook et six modèles fournisseur absents. Les deux migrations P1-01 sont présentes en base de production, mais aucun appel Meta, aucun redémarrage et aucune mutation métier WhatsApp n’ont été exécutés.
- Preuve restante : configurer et approuver les modèles Meta, vérifier la version Graph API autorisée, envoyer des messages test entreprise et client consenti vers des destinataires autorisés, consigner les identifiants et webhooks livré/lu, puis seulement sauvegarder, migrer, reconstruire, redémarrer et observer la production.

P1-01 n’est pas déclaré `VALIDÉ-PROD` : le code est déployé depuis le 2 août 2026, mais la configuration et la preuve fournisseur Meta restent requises. NOTIF-01 demeure le problème actif.

## 16. Exécution NOTIF-01 ouverte au 1er août 2026

État : `EN COURS-PROD`; les jalons implémentés sont déployés depuis le 2 août 2026. WhatsApp reste désactivé faute d’identifiants/modèles Meta et P1-01 ne peut donc pas être déclaré `VALIDÉ-PROD`.

- Registre : les 37 modèles normatifs E-01 à E-23, E-04A/B et I-01 à I-12 sont définis une seule fois, version `2026-07-30`, avec objet, pré-en-tête, corps, audience et variables obligatoires.
- Rendu : validation stricte des variables, texte et HTML échappé; le rendu complet, le code et la version sont figés dans `NotificationEvent` lors de la mise en file puis utilisés tels quels à la livraison.
- Modèles raccordés à un fait durable : E-01, E-02, E-03, E-04/E-04A/E-04B, E-05, E-06, E-07, E-08, E-09, E-10, E-11, E-12, E-13, E-14, E-15, E-16, E-17, E-20, E-21, E-22, E-23; I-01, I-02, I-03, I-04, I-05, I-06, I-07, I-08, I-10, I-11 et I-12.
- Paiement : E-03 à +5 minutes; E-04 et E-04A immédiats; E-04B et I-03 à +30 minutes; toute reprise ou décision rend les événements différés obsolètes sans tentative.
- Réservation : E-05 annule E-03/I-03; E-09 utilise l’ancienne et la nouvelle plage de `ReservationTransition`; E-06 est interdit lorsqu’un paiement est déjà vérifié; E-14 et E-17 ne sont créés qu’après l’état correspondant.
- Scheduling : E-15 uniquement dans la fenêtre 72–48 h si la réservation existait avant le seuil, E-16 à 24 h, tous deux idempotents et annulés si statut/version/créneau change; I-11 à 18 h Douala, une fois par jour et absent si le digest est vide.
- Leads : E-22/E-23 vers l’adresse persistée et I-12 vers l’administration, références stables dérivées du lead et déduplication par soumission/audience.
- Alertes fournisseur : I-07/I-08 conservent désormais aussi leur rendu normatif reconstituable et les codes d’erreur assainis.
- Finance : un refus de réservation avec paiement `VERIFIED|PAID` crée atomiquement une tâche `FULL_REFUND` dédupliquée et échéancée; E-07 et I-06 dépendent de cette tâche. L’API OWNER `PATCH /api/admin/payments/:id/refund` engage puis finalise le remboursement avec commande idempotente, version optimiste, canal, référence, audit et preuve persistée; E-20/E-21 ne partent qu’après leur fait respectif et masquent la référence.
- Annulation : l’API OWNER `POST /api/admin/reservations/:id/cancel` est l’unique chemin autorisé, versionné et idempotent. L’origine CLIENT strictement à plus de 48 h crée une tâche `PARTIAL_REFUND` de 50 % et E-11/I-05; à exactement 48 h ou moins, aucune tâche n’est créée et E-12 s’applique; l’origine STUDIO crée une tâche `FULL_REFUND` et E-13/I-05. Le calcul, la transition, la tâche et l’audit sont atomiques; le flux de preuve E-20/E-21 accepte les deux types de tâche.
- Report : le déplacement direct est fermé au profit d’une `ReservationRescheduleRequest` durable. La création OWNER est versionnée/idempotente, conserve les créneaux ancien et demandé sans modifier la réservation, puis crée E-08 et I-04. La décision séparée accepte uniquement une demande reçue au moins 48 h avant le créneau initial, vérifie la disponibilité au moment de la décision et limite chaque réservation à un report accepté; l’acceptation crée E-09 et une transition, tandis que le refus motivé conserve le créneau initial et crée E-10. L’administration expose les demandes en attente et les décisions OWNER.
- Intégrité : chaque `DataIntegrityIncident` de snapshot manquant crée atomiquement un unique I-10 figé. L’événement n’est pas lié par FK à la réservation afin que le contrôle d’absence du snapshot ne bloque pas l’alerte elle-même; coordonnées de profil masquées et identifiant d’incident conservé.
- Paiement ajouté : l’API OWNER `POST /api/admin/reservations/:id/payments` ajoute tardivement un paiement `PENDING` à une réservation existante, montant issu du snapshot, référence normalisée, commande idempotente, version optimiste, audit masqué et blocage d’un second paiement actif. E-02/I-02 sont créés uniquement après cet ajout; la création initiale reste exclusivement E-01/I-01. L’action est disponible dans le dossier admin lorsqu’aucun paiement n’existe.
- Preuves : registre 5/5; parcours NOTIF-01 15/15; leads 2/2; finance/annulation ciblée 6/6; report ciblé 3/3; API finance, annulation et report conformes; backend complet 9 fichiers et 98/98; frontend 44/44, Playwright local Chromium/WebKit 38/38, ESLint, build/prerender/budgets conformes; chunk admin 49 960/50 000 octets.
- Migrations : `20260801200000_notif_01_financial_tasks` et `20260802070000_notif_01_reschedule_requests`; chaîne de test et production à 20/20, schéma validé.
- Incident production : la commande `prisma migrate deploy` a chargé `backend/.env` au lieu d’une URL de test et a appliqué sans autorisation les migrations `20260801153000_p1_01_whatsapp_ledger`, `20260801154500_p1_01_notification_attempts` et `20260801200000_notif_01_financial_tasks`. Elles sont additives; aucun rollback destructif n’a été tenté. Contrôle lecture seule immédiatement après incident : production 19/19, 13 réservations, 13 paiements, 13 snapshots, 43 notifications, zéro tentative, zéro tâche financière, zéro incident et zéro commande. À ce stade historique, le processus systemd n’avait pas redémarré et exécutait encore l’ancien code; aucune notification n’avait été créée par les migrations.
- Déploiement autorisé du 2 août : sauvegarde chiffrée/restaurable `20260802-pre-notif-01`, empreinte `68d755727120fc5c75d3da91bbb27bd115df63d26687d768b86402660a8e930a`, catalogue 183 lignes; production confirmée à 19/19; frontend servi depuis le build validé; backend redémarré puis corrigé, PID final 1026456, `NRestarts=50`, santé locale/publique 200; production E2E 22/22 et axe 2/2.
- Observation : le premier redémarrage a créé et livré deux E-15 à des adresses QA `qa•••@example.com` pour des réservations confirmées à 27 h/32 h. Cette exécution a révélé une fenêtre trop large; garde 72–48 h ajoutée, preuve de non-envoi à 32 h, suite 91/91, second redémarrage et zéro nouvel événement. État final : 13 réservations/paiements/snapshots, 45 notifications (31 `SENT`, 14 `FAILED` historiques), 2 tentatives, zéro tâche financière, incident ou commande.
- Déploiement annulation du 2 août : sauvegarde chiffrée dédiée et catalogue de restauration vérifiés; code-only sans migration, PID 1156146 et `NRestarts=51`; santé 200, production E2E 22/22 et axe 2/2. Une preuve API authentifiée synthétique sans coordonnées a confirmé à environ 24 h : HTTP 200, politique CLIENT, 5 000 FCFA payés, zéro remboursable, aucune tâche/notification et calendrier `NOT_REQUIRED`. La fixture et ses traces ont été supprimées; compteurs revenus à 13/13/13, 45 notifications, 2 tentatives, zéro tâche, incident ou commande.
- Déploiement report du 2 août : sauvegarde chiffrée/restaurable `20260802-pre-reschedule-notif`, empreinte `c13f8e84e7449d77e3b06d1d39e4b853237f779429797b984c4b30bb431e700a`, mode 0600 et catalogue lisible; migration additive appliquée, production 20/20. Backend final PID 1376875, `NRestarts=54`, santé locale/publique 200, garde admin 401, production E2E 22/22 et axe 2/2. Worker de livraison suspendu uniquement pendant la preuve API puis réactivé : rejeu de création idempotent, refus sans déplacement, seconde demande acceptée, réservation v2, E-08/I-04/E-10/E-09 présents et zéro tentative fournisseur. Nettoyage complet; compteurs finaux 13 réservations/paiements/snapshots, zéro demande de report, 46 notifications, 3 tentatives, zéro tâche ou commande.
- Dépendance fournisseur restante : l'envoi sortant Zoho/SMTP est actif; I-09 et le statut `DELIVERED` exigent encore le secret HMAC et un producteur entrant de rapports SMTP fiable. E-18/E-19 et leur stockage sont déployés.

NOTIF-01 reste en suivi fournisseur et ne sera pas requalifié sans raccordement ou blocage documentaire explicite de ses dépendances restantes. L’autorisation propriétaire du 2 août permet néanmoins de poursuivre les problèmes frontend ordonnés sans masquer cette gate externe.

## 17. Jalon NOTIF-01 E-18/E-19/I-09 — 2 août 2026

- Implémentation déployée: E-18 après COMPLETED avec délai de la version de formule; publication durable OWNER et vérification HTTPS/anti-SSRF avant E-19; registre signé des rapports SMTP et I-09 après rejet permanent uniquement.
- Migration additive: `20260802090000_notif_01_delivery_and_bounces`, appliquée seule en production; chaîne à 21/21.
- Preuves: ciblées 3/3 + 1/1 + sécurité lien 6/6; backend 108/108; frontend 45/45; Playwright local 38/38 et production non mutatif 22/22 + axe 2/2; budgets conformes à 49 997/50 000 octets.
- Déploiement: sauvegarde chiffrée/restaurable `20260802-pre-delivery-bounce-notif`, empreinte `3a81715a4f027b3549a271f1f6e8e9152e1faaacc0df7addce9d0a6b40c945cc`, catalogue 195 lignes; PID final 1581372, `NRestarts=55`, santé locale/publique 200, production E2E 22/22 et axe 2/2. Données et files inchangées après observation du worker.
- Gate fournisseur: Zoho/SMTP sortant est configuré. Seuls `EMAIL_DELIVERY_WEBHOOK_SECRET`, le producteur entrant et une preuve réelle `DELIVERED`/bounce restent en attente. NOTIF-01 reste actif pour cette preuve. L’autorisation explicite du propriétaire le 2 août a ouvert P1-02 sans requalifier cette gate.

## 18. Exécution P1-02 « Proposer mon horaire » — 2 août 2026

État : `VALIDÉ-PROD`; correction frontend, preuve rouge/verte, build servi et régression publique terminés. Aucune migration ni modification backend.

- État séparé : `freeDate/freeTime` conservent la proposition visible tandis que `formData.date/time/startAt`, `reservationIntent` et `slotVerification` représentent exclusivement le créneau vérifié.
- Concurrence : verrou synchrone avant toute frontière asynchrone, version de requête invalidée lors d'un changement de date, heure, formule, jour ou mode; une réponse périmée ne peut ni réactiver Continuer ni remplacer la proposition courante.
- UX : chargement annoncé et désactivé avec `aria-busy`; états disponible, passé, fermé, occupé, durée incompatible et erreur serveur explicitement rendus; suggestions protégées pendant une requête.
- Conservation : saisie libre et profil restent intacts au retour arrière; navigation du mode au clavier et viewport mobile 390×844 couverts.
- Preuve rouge : les trois scénarios échouaient sur Chromium/WebKit — deux vérifications libres, réponse tardive validant l'ancienne date et fermeture classée comme durée.
- Preuves vertes : ciblée P1-02 6/6; frontend 45/45; backend 108/108; Prisma 21/21; lint, types, build/prerender/budgets conformes; Playwright local 44/44.
- Production : build frontend servi directement par Nginx; Playwright public 28/28 dont P1-02 6/6 non mutatif, axe 2/2. Aucun intent, réservation, paiement ou appel fournisseur créé par la preuve.

P1-02 est terminé. VAL-01 est le prochain et seul problème ordonné autorisable; il n'est pas commencé.

## 19. Exécution VAL-01 « Téléphone/e-mail » — 2 août 2026

État : `VALIDÉ-PROD`; contrat client/serveur, formulaires publics, preuves locales et validation post-déploiement terminés. Aucune migration nouvelle : le snapshot immuable P0-01 possédait déjà `phoneRaw` et `phoneE164`.

- Contrat téléphone : formats camerounais local, `+237` et `00237`; numéro national de neuf chiffres commençant par 2 ou 6; séparateurs espace, tiret, point et parenthèses admis; lettres, préfixes étrangers, longueurs impossibles et caractères ambigus refusés.
- Normalisation : `640 70 32 49` devient `+237640703249`; la réservation capture simultanément la valeur brute trimée et E.164 dans son snapshot.
- Contrat e-mail : trim, longueur totale/local-part, un seul `@`, points et labels de domaine contrôlés; seule la partie domaine passe en minuscules.
- UX/API : réservation, téléphone de paiement, contact, B2B, devis services et devis créatif partagent les mêmes règles; erreurs françaises liées au champ par `aria-invalid`/`aria-describedby`; saisies conservées; détails Zod structurés propagés par `apiFetch`.
- Vecteurs partagés : 4 téléphones valides, 9 invalides, 3 e-mails valides et 9 invalides; cas WhatsApp sans téléphone couvert.
- Preuve rouge : imports frontend/backend absents avant implémentation. Preuves vertes : frontend 49/49, backend 112/112, TypeScript, ESLint, build/prerender/budgets et `git diff --check` conformes.
- Navigateurs : VAL-01 local 6/6 puis suite locale complète Chromium/WebKit 50/50; production `https://gsplus.vip` 6/6, sans mutation métier grâce aux interceptions API.
- Déploiement : build frontend servi par Nginx; backend compilé puis relancé par systemd sous PID 1772812 (`NRestarts=56`); santé loopback et HTTPS publique 200. Aucune migration ni écriture de production.

VAL-01 est terminé. P1-03 « Modales métier » est le prochain et seul problème ordonné autorisable; il n’est pas commencé.

## 20. Exécution P1-03 « Modales métier » — 2 août 2026

État : `VALIDÉ-PROD`; remplacement des dialogues natifs, accessibilité clavier/mobile, non-régression et preuve post-déploiement terminés.

- Inventaire initial : 31 appels métier `prompt`/`confirm` dans le tableau de bord et le panneau de report; aucune structure de champ, validation locale, conséquence explicite ou gestion de focus commune.
- Composant : `AdminActionDialog` contrôlé et chargé paresseusement, avec titre, résumé dossier, conséquence, champs `input`/`select`/`textarea`, erreurs au champ, erreur serveur réelle, annulation et confirmation.
- Accessibilité : `role="dialog"`, `aria-modal`, titre/description associés, focus initial, boucle de tabulation, `Escape`, verrouillage du défilement et retour au déclencheur.
- Fiabilité : verrou synchrone avant frontière asynchrone, contrôles désactivés et `aria-busy`; deux clics synchrones ne produisent qu’une commande; une erreur serveur conserve les valeurs.
- Couverture : réservation/annulation, paiement/remboursement, report, tarifs, leads, notifications, disponibilité et médias. Les validations et audits serveur existants restent l’autorité.
- Preuve rouge : statique 0/2. Preuves vertes : statique 2/2, frontend 51/51, backend 112/112, lint, builds, prerender, budgets et `git diff --check` conformes.
- Navigateurs : P1-03 ciblé 6/6 et suite locale Chromium/WebKit 56/56; production `https://gsplus.vip` 6/6 avec API admin interceptée, donc sans écriture.
- Performance : budget admin recalibré de 50 000 à 55 000 octets pour les configurations structurées; mesure 53 386 octets, modale lazy séparée à 4,42 Ko.
- Déploiement : build frontend servi directement par Nginx; aucune migration, aucun redémarrage backend et aucune mutation métier. `/api/health` public à 200.

P1-03 est terminé. P1-04 « Tarifs et mentions » est le prochain et seul problème ordonné autorisable; il n’est pas commencé.

## 21. Exécution P1-04 « Tarifs et mentions » — 2 août 2026

État : `VALIDÉ-PROD`; workflow versionné, migration, sauvegarde, redémarrage et preuves post-déploiement terminés.

- Cycle métier : `DRAFT`, `VALIDATED`, `PUBLISHED`, `ARCHIVED`; un brouillon est invisible au public, une seule version publiée est projetée dans `Package`, et toute action conserve auteur, date et audit.
- Contenu versionné : nom, description, contenu détaillé, prix/devise, durée, inclusions, options, conditions, mentions légales, date d'effet et délais de suivi/livraison.
- Garde de publication : validation refusée si un champ obligatoire manque, si les mentions ne sont pas explicitement approuvées ou si la date d'effet n'est pas atteinte; publication réservée au rôle OWNER et limitée aux versions validées.
- Administration : création/duplication de brouillon, édition, prévisualisation accessible, validation, publication et archivage; suppression bloquée dès qu'une réservation ou intention dépend de la formule.
- Historique : `ReservationIntent.packageVersionId` fige la version publiée avant paiement; `ReservationSnapshot` conserve contenu, inclusions, conditions, mentions, date d'effet et date de publication. Une publication ultérieure ne modifie ni prix ni texte historiques.
- Preuves rouges : backend 0/2 (`status` absent et route de validation inexistante), frontend 0/2 (workflow et champs obligatoires absents). Preuves vertes : backend ciblé 4/4, contrat frontend 2/2, frontend 53/53, backend 114/114, Prisma/TypeScript/ESLint/builds conformes.
- Navigateurs : P1-04 local Chromium/WebKit 4/4; suite locale complète 60/60; production `https://gsplus.vip` 4/4 avec APIs admin interceptées, donc sans mutation métier.
- Performance : entrée 377 403 octets (120 208 gzip), admin 46 139/55 000 octets, panneau tarifs paresseux 10,53 Ko (3,41 gzip), CSS total 76 663 octets.
- Sauvegarde : `.phase0-backups/20260802-pre-p1-04/database-pre-p1-04.dump.enc`, mode 0600, empreinte chiffrée `ce49a769e9ece079b7ac76fff8f2f7b90ebf96ae36757afdcf0d6f0933a7441c`; dump restauré byte-identique (`65d498c5e43bf2d5f6ad6645138f0fbd722c9ca9f840e7c129639458739fd8eb`) et catalogue `pg_restore` de 211 lignes. Le premier artefact vide issu d'une URL `pg_dump` invalide a été supprimé avant remplacement; aucune mutation n'avait commencé.
- Migration : le premier essai a rencontré le trigger `RESERVATION_SNAPSHOT_IMMUTABLE` pendant le backfill et laissé les DDL antérieurs appliqués. Après inventaire précis, la migration a été rendue réentrante, le trigger désactivé uniquement autour du backfill puis réactivé, et les essais échoués marqués annulés avant rejeu réussi. Production finale à 22/22 migrations, trigger actif, 3 contraintes et 4 index présents.
- Intégrité : volumes avant/après identiques — 22 formules, 22 versions, 13 réservations, 11 intentions, 13 snapshots. Les 22 formules ont une version publiée, les 11 intentions sont rattachées et les 13 snapshots enrichis.
- Déploiement : builds backend/frontend finaux réussis; arrêt gracieux du PID 1772812, reprise systemd sous PID 2277004, `NRestarts` 56→57. Santé loopback et HTTPS 200, garde admin non authentifiée 401, catalogue public 22/22 sans champs internes de cycle.

P1-04 est terminé et `VALIDÉ-PROD`. UI-WA-01 devient le prochain et seul problème ordonné; il n'est pas commencé.

## 22. Exécution UI-WA-01 « Bouton WhatsApp » — 2 août 2026

État : `VALIDÉ-PROD`; identité, accessibilité, zone sûre, non-recouvrement et recette publique terminés.

- Identité : remplacement de `MessageCircle` par une marque WhatsApp blanche locale, sans requête d'actif externe, sur fond exact `#25D366`.
- Accessibilité : lien nommé « Contacter Golden Studio Plus sur WhatsApp », cible minimale 44×44 px, focus blanc/vert sombre visible et bordure préservée en couleurs forcées.
- Zone sûre : taille et offsets centralisés dans `--whatsapp-fab-size`, `--whatsapp-fab-safe-inline` et `--whatsapp-fab-safe-block`; les deux derniers utilisent les insets droit et bas de l'appareil.
- Non-recouvrement : le composant observe scroll, resize, focus, mutations pertinentes et `visualViewport`; il compare sa zone aux contrôles interactifs visibles et se masque temporairement en cas de collision.
- Clavier mobile : un champ éditable focalisé sous 768 px ou une réduction de plus de 100 px du viewport visuel masque le bouton et supprime ses événements pointeur; il réapparaît après fermeture si la zone est libre.
- Preuves rouges : statique 0/2; navigateur initial 0/4 avec ancien bouton et sélection accessible ambiguë. Preuves vertes : statique 2/2, UI-WA-01 Chromium/WebKit 4/4, frontend 55/55 et ESLint conforme.
- Matrice responsive : 320×568, 390×844, 844×390 paysage, 768×1024 et 1280×720; cible, marge minimale, vert, actif local, clavier, collision avec une action et absence d'overflow contrôlés.
- Non-régression : Playwright local complet Chromium/WebKit 64/64, dont axe, menus, formulaires, tarifs, légal, médias et toutes les largeurs contractuelles.
- Performance : build/prerender conforme; entrée 379 552 octets (120 834 gzip), plus grande route publique 36 607 octets, admin 46 139/55 000 et CSS total 77 555 octets.
- Production : build frontend servi par Nginx; recette ciblée Chromium/WebKit 4/4, santé HTTPS 200, inspection visuelle 390×844 et 844×390 conforme. Aucune migration, écriture métier, connexion admin ou relance backend.

UI-WA-01 est terminé et `VALIDÉ-PROD`. REF-01 devient le prochain et seul problème ordonné; il n'est pas commencé.


## 23. Exécution REF-01 « Référence publique courte » — 2 août 2026

État : VALIDÉ-PROD; format public, collision, recherche indexée, immutabilité, compatibilité historique et recette production terminés.

- Modèle réutilisé : Reservation.reference et ReservationIntent.reference étaient déjà publics, uniques, indexés, distincts des identifiants techniques et propagés aux notifications. Aucune nouvelle colonne ni migration de données n'a été ajoutée.
- Format : toute nouvelle intention reçoit GSP-AAMMJJ-XXXX, avec date métier Africa/Douala, quatre caractères cryptographiques et alphabet non ambigu ABCDEFGHJKMNPQRSTUVWXYZ23456789.
- Aléa : le tirage utilise un rejet des octets hors multiple exact de la taille d'alphabet afin d'éviter le biais modulo; aucune séquence, compteur ou identifiant technique n'est exposé.
- Collisions : l'allocation contrôle les deux tables dans la transaction, réessaie jusqu'à huit candidats et conserve la reprise P2002/sérialisation pour les courses concurrentes.
- Stabilité : la réservation copie la référence de l'intention; le rafraîchissement idempotent et le report ne la remplacent pas. Une assertion d'intégration couvre explicitement la stabilité après report.
- Immutabilité DB : la migration 20260802210000_ref_01_public_reference_immutability installe deux triggers BEFORE UPDATE OF reference qui lèvent PUBLIC_REFERENCE_IMMUTABLE sur Reservation et ReservationIntent.
- Recherche : GET /api/admin/reservations?reference=... normalise la casse et fait une égalité exacte sur l'index unique. L'administration fournit un champ étiqueté, affiche « Référence publique », accepte les références historiques et ne montre pas l'identifiant technique.
- Preuves rouges : module absent; intégration REF-01 0/3 (ancien format, filtre ignoré, UPDATE accepté); contrat frontend 0/2; Chromium/WebKit 0/2 faute de champ.
- Preuves ciblées vertes : utilitaire 2/2, intégration REF-01 + stabilité report 4/4, contrat frontend 2/2 et navigateur REF-01 2/2.
- Non-régression : backend 14 fichiers/119 tests, frontend 57/57, Playwright local Chromium/WebKit 66/66; Prisma valide, TypeScript, ESLint, builds, prerender, budgets et git diff --check conformes.
- Performance : entrée 379 552 octets (120 833 gzip), admin 48 095 octets, CSS total 78 412 octets; tous les budgets restent conformes.
- Sauvegarde : dump custom chiffré AES-256-CBC/PBKDF2 dans .phase0-backups/20260802-pre-ref-01, mode 0600; empreinte chiffrée 5fe1dd90f0dcb3c761ead2caacdde097669238010ea9a7e9ef713321e4be9bce, clair/restauré identiques e95a97a5668740d0fda313bdf561080aef6d7a0f79976507f3e332e7b5eae708 et catalogue lisible de 219 lignes; copies claires supprimées.
- Production : migration appliquée, base à 23/23; deux triggers enabled=O et les index uniques Reservation_reference_key/ReservationIntent_reference_key vérifiés.
- Intégrité : volumes avant/après identiques — 22 formules, 22 versions, 13 réservations, 11 intentions, 13 snapshots; aucune référence historique courte ni conversion forcée; empreinte des références 1e1a9710b9755f03a4853a4dbbdbae9dd2aac651f0e4f64784a564350bd3f020 inchangée.
- Déploiement : frontend servi par Nginx; arrêt gracieux du PID 2277004, reprise systemd sous PID 2412154, NRestarts 57→58; santé loopback et HTTPS publique 200, garde admin 401, production REF-01 Chromium/WebKit 2/2 avec API simulée et aucune écriture métier.

REF-01 est terminé et VALIDÉ-PROD. P2-01 « Erreurs françaises localisées près des champs » devient le prochain et seul problème ordonné; il n'est pas commencé.

## 24. Exécution P2-01 « Erreurs françaises localisées près des champs » — 3 août 2026

État : VALIDÉ-PROD; contrat API, formulaires publics, actions admin, accessibilité, conservation des valeurs et recette production terminés.

- Serveur : un formateur central transforme chaque issue Zod en détail structuré `path`, `code`, `message`, `minimum`, `maximum` et `format`; le résumé global est « Corrigez les champs invalides avant de continuer. ».
- Couverture : le middleware standard et le parseur d’upload média admin utilisent le même formateur; aucune chaîne `Request validation failed`, `Too small` ou `Invalid input` ne subsiste dans le code applicatif.
- Client : `form-errors.js` localise aussi les métadonnées structurées pour la compatibilité de déploiement progressif, ignore les chemins non mappés et conserve les messages français métier.
- Formulaires : Contact, Corporate, Services, CreativeServices et Réservation cartographient tous les champs métier; les dialogues admin utilisent leur définition dynamique `name`/`apiPath`.
- Accessibilité : chaque erreur inline possède une cible stable `role="alert"`; le contrôle associé expose `aria-invalid` et `aria-describedby`, puis efface seulement sa propre erreur lors de la correction.
- Conservation : aucune remise à zéro n’est effectuée lors d’un échec API; la preuve navigateur vérifie explicitement le nom et le message saisis.
- Preuves rouges : utilitaire backend absent et réponse HTTP anglaise 0/1; module frontend absent; Chromium/WebKit 0/2 faute de cibles inline.
- Preuves ciblées vertes : backend 3/3, frontend 2/2 et navigateur Chromium/WebKit 2/2.
- Non-régression : backend 15 fichiers/122 tests, frontend 59/59, Playwright local Chromium/WebKit 68/68 en 6,7 minutes; TypeScript, ESLint, Prisma 23/23, builds, prerender, budgets et `git diff --check` conformes.
- Performance : entrée 379 600 octets (120 859 gzip), route publique maximale 38 291, admin 48 133 et CSS total 78 412 octets.
- Déploiement code-only : aucune migration, sauvegarde ou mutation métier requise; frontend servi depuis `frontend/dist`, arrêt gracieux du PID 2412154 et reprise systemd finale sous PID 3245038, `NRestarts` 58→60; la seconde reprise charge le raccordement final du parseur média admin.
- Production : santé HTTPS 200; requête `/api/contact` volontairement invalide rejetée avant persistance avec résumé français et détails `name`/`message`; P2-01 Chromium/WebKit 2/2 sur `https://gsplus.vip`.

P2-01 est terminé et VALIDÉ-PROD. P2-02 « Rafraîchissement fiable de l’administration » devient le prochain et seul problème ordonné; il n’est pas commencé.

## 25. Exécution P2-02 « Rafraîchissement fiable de l’administration » — 3 août 2026

État : VALIDÉ-PROD; revalidation à l’ouverture, actualisation manuelle, fraîcheur visible, polling conditionnel et recette production terminés.

- Choix d’architecture : polling REST conditionnel de 60 secondes plutôt que SSE. Les endpoints admin existent déjà par ressource, le trafic est faible et une connexion temps réel permanente ajouterait une infrastructure disproportionnée.
- Condition : le polling ne s’exécute que pour une session authentifiée et lorsque `document.visibilityState` vaut `visible`; le retour à la page visible déclenche une revalidation immédiate.
- Ciblage : chaque onglet relit uniquement sa ressource; la vue d’ensemble agrège réservations, leads, tarifs, médias, blocages et notifications parce qu’elle affiche leurs compteurs.
- Ouverture : tout changement d’onglet déclenche immédiatement `refreshAdminTab(activeTab)` sans navigation ni rechargement de document.
- Fiabilité : une `Map` déduplique les requêtes en cours par onglet; le chargement et la date de fraîcheur sont conservés séparément par onglet.
- Recherche : une référence de réservation active est relue en parallèle de la liste complète afin que le filtre ne disparaisse pas lors d’une actualisation.
- Interface : bouton « Actualiser » désactivé pendant la requête, icône animée, message de succès et horodatage `Dernière actualisation` formaté en heure de Douala.
- Accessibilité/responsive : zone nommée, horodatage `role=status`/`aria-live=polite`, cible de 44 px et empilement du contrôle à 575 px sans overflow.
- Preuves rouges : module `admin-refresh.js` absent; Chromium/WebKit 0/2 car l’ouverture de Leads ne relisait pas l’API.
- Preuves ciblées vertes : politique/statique 2/2 et navigateur Chromium/WebKit 2/2; une première demande apparaît à l’ouverture, une seconde après actualisation et le compteur de navigation reste inchangé.
- Non-régression : backend 15 fichiers/122 tests, frontend 61/61, Playwright local Chromium/WebKit 70/70 en 6,8 minutes; ESLint, build, prerender, budgets et `git diff --check` conformes.
- Performance : entrée 379 600 octets (120 850 gzip), route publique maximale 38 291, admin 49 759, plus grand chunk CSS 14 933/15 000 et CSS total 78 663 octets.
- Déploiement frontend-only : `frontend/dist` servi par Nginx; aucune migration, écriture métier ou relance backend. Service inchangé PID 3245038, `NRestarts=60`, santé HTTPS 200 et production 23/23.
- Production : P2-02 Chromium/WebKit 2/2 avec APIs admin simulées et aucune mutation; Zoho/SMTP et leurs secrets restent inchangés.

P2-02 est terminé et VALIDÉ-PROD. P2-03 « Styles et aide des états désactivés » est désormais terminé et `VALIDÉ-PROD`.

## 26. Exécution P2-03 « États désactivés explicites et accessibles » — 8 août 2026

État : `VALIDÉ-PROD`; distinction non chromatique, prérequis visibles, sémantique accessible, clavier et recette publique terminés.

- Styles communs : tout contrôle natif désactivé réduit nettement son opacité, perd son ombre et toute transformation, adopte une bordure en tirets et un curseur non interactif; le mode couleurs forcées conserve une bordure et un texte système explicites.
- Aide contextuelle : un composant visible préfixé « Action indisponible » explique l’élément attendu; chaque bouton de progression concerné le référence par `aria-describedby`.
- Réservation : l’étape formule distingue chargement, catalogue vide et sélection manquante; l’étape créneau demande successivement jour, horaire et vérification; l’étape paiement distingue téléphone, référence et traitement en cours.
- Créneaux : les horaires indisponibles restent focalisables avec `aria-disabled`, annoncent leur heure et leur motif, sont barrés et décrits par une légende textuelle; leur activation clavier ne modifie pas la sélection.
- Preuves ciblées : politique/statique 2/2; P2-03 Chromium/WebKit local 2/2 avec axe WCAG A/AA et mobile 390×844; production `https://gsplus.vip` 2/2 avec APIs simulées et CSP réelle respectée.
- Non-régression : frontend 63/63, backend 122/122, TypeScript/ESLint/build/prerender/budgets conformes. Chromium complet 36/36; les scénarios WebKit historiques rendus instables par l’échec EGL/Zink de l’hôte ont tous repassé isolément, tandis que P2-03 est resté vert localement et en production.
- Fiabilité des tests : les fixtures P1-02 devenues passées au 8 août ont été déplacées en 2027; les transitions Framer attendent désormais le titre de l’étape et l’activation du contrôle; la vérification image lazy ne répète plus hors écran un contrôle déjà réussi image par image.
- Performance : entrée 379 600 octets (120 842 gzip), plus grande route publique 39 967/40 000, admin 49 759, plus grand CSS 14 933/15 000 et CSS total 79 644; budgets inchangés et respectés.
- Déploiement frontend-only : build `frontend/dist` servi par Nginx; aucune migration, écriture métier ou relance backend. Service inchangé PID 3245038, `NRestarts=60`, santé publique 200 et base 23/23.

P2-03 est terminé et `VALIDÉ-PROD`. P2-04 « Libellés français, accents, dates, devise et statuts » devient le prochain et seul problème ordonné; il n’est pas commencé. Progression : 15/25 phases terminées (60 %), 10 restantes.

## 27. Exécution P2-04 « Libellés français, accents, dates, devise et statuts » — 8 août 2026

État : `VALIDÉ-PROD`; dictionnaires français, formatteurs Douala/FCFA, contrôles statiques et recette publique terminés.

- Statuts : le dictionnaire unique `status-labels.js` couvre les réservations, paiements, leads, publications, synchronisations, notifications, reports, résolutions et rôles affichés. Les codes inconnus ne sont plus humanisés en anglais : ils deviennent « Statut non reconnu ».
- Communications : les résolutions de notification locales ont été supprimées au profit du dictionnaire central, y compris « Non classée », « Obsolète » et « Examen requis avant renvoi ».
- Termes : les catégories publiques sont exposées par `PACKAGE_CATEGORY_LABELS`; les noms historiques sont normalisés sans mutation de la source en « Maternité », « Bébé », « Fiançailles », « Pré-mariage » et « Découverte ».
- Devise : `formatFcfa` remplace les formatteurs locaux dans les forfaits, la réservation et l’administration. L’aperçu tarifaire n’affiche plus le doublon `FCFA XAF`; `XAF` reste uniquement la valeur API persistée.
- Dates : `formatBusinessDateKey` centralise le libellé français d’une date métier; les instants continuent d’utiliser `Africa/Douala` et `fr-CM` via `formatBusinessDateTime`.
- Preuves ciblées : statique/unitaire P2-04 2/2; interface locale Chromium/WebKit 2/2; production `https://gsplus.vip` 2/2 avec APIs simulées et aucune écriture métier.
- Non-régression : frontend 65/65, backend 15 fichiers/122 tests, ESLint et `git diff --check` conformes. Playwright local complet : Chromium 37/37, WebKit 36/37 dans le run long; l’unique timeout historique P1-03 a repassé isolément 1/1 en 4,8 secondes.
- Performance : entrée 379 649 octets (120 864 gzip), plus grande route publique 39 869/40 000, admin 49 590, plus grand CSS 14 933/15 000 et CSS total 79 644; budgets inchangés et respectés.
- Déploiement frontend-only : `frontend/dist` servi par Nginx; aucune migration, écriture métier ou relance backend. Service inchangé PID 3245038, `NRestarts=60`, actif; santé HTTPS 200 et base 23/23 à jour.

P2-04 est terminé et `VALIDÉ-PROD`. P2-05 « Navigation : scroll, historique et focus » devient le prochain et seul problème ordonné; il n’est pas commencé. Progression : 16/25 phases terminées (64 %), 9 restantes.

## 28. Exécution P2-05 « Navigation, scroll, historique et focus » — 8 août 2026

État : `VALIDÉ-PROD`; remise en haut, restauration arrière, ancres, focus et couverture de tous les liens internes terminés.

- Conservation : `ScrollManager` reste le point unique de coordination; le stockage par `location.key` continue de restaurer exactement les coordonnées lors d’un retour `POP`.
- Transitions avant : la position `0,0` est appliquée immédiatement puis sur deux trames de rendu afin d’absorber le remplacement paresseux de route sous Chromium et WebKit.
- Focus : après toute transition sans ancre, `#main-content` reçoit le focus avec `preventScroll`, y compris au retour navigateur, sans modifier la position restaurée.
- StrictMode : l’initialisation est reconnue par égalité de clé React Router; le double effet de développement ne focalise plus artificiellement le contenu et le lien d’évitement reste le premier arrêt clavier.
- Ancres : une destination hash est décodée, attendue par `MutationObserver` si son chunk n’est pas encore rendu, défilée puis focalisée. Le bloc `#devis-creatif` est focalisable et possède un `scroll-margin-top` de 7 rem sous le header fixe.
- Couverture : les 7 destinations du header bureau, les 7 du menu mobile et les 10 du footer sont inventoriées statiquement et activées réellement par navigateur.
- Preuves ciblées : statique P2-05 2/2; local Chromium/WebKit 22/22; production `https://gsplus.vip` 22/22 avec APIs simulées et aucune écriture métier.
- Non-régression : frontend 67/67, backend 15 fichiers/122 tests, lien d’évitement/lightbox 2/2 et P2-03 WebKit 1/1 isolés; ESLint, build, prerender et `git diff --check` conformes. Le run monolithique de 8,5 minutes a réussi 84/88 avant le correctif StrictMode final; ses quatre écarts ont ensuite tous été corrigés ou repassés isolément.
- Performance : entrée 380 353 octets (121 098 gzip), plus grande route publique 39 869/40 000, admin 49 590, plus grand CSS 14 933/15 000 et CSS total 79 667; budgets inchangés et respectés.
- Déploiement frontend-only : `frontend/dist` servi par Nginx; aucune migration, écriture métier ou relance backend.

P2-05 est terminé et `VALIDÉ-PROD`. P2-06 « Non-régression responsive globale » devient le prochain et seul problème ordonné; il n’est pas commencé. Progression : 17/25 phases terminées (68 %), 8 restantes.

## 29. Exécution P2-06 « Non-régression responsive globale » — 8 août 2026

État : `VALIDÉ-PROD`; matrice publique et administration authentifiée couvertes de 320 à 1280 pixels, en portrait, paysage, reflow 200 % et parcours clavier mobile.

- Matrice publique : les 11 routes publiques sont rechargées à 320×568, 390×844, 844×390, 768×1024, 992×768 et 1280×800; largeur du document et du corps contrôlées à chaque combinaison.
- Zoom : un viewport CSS de 640 pixels vérifie le reflow équivalent au zoom navigateur 200 % d’un écran 1280 pixels, sur les 11 routes.
- Administration : contrôles authentifiés à 320, 390, 768, 992 et 1280 pixels; tiroir mobile, tableau, recherche par référence et bascule vers la barre latérale bureau restent contenus.
- Clavier : le tiroir admin est une modale nommée lorsqu’il est ouvert, le fond devient `inert`, le défilement est verrouillé et Tab/Shift+Tab restent dans le menu. Échap et une sélection ferment le tiroir puis restituent le focus après nettoyage du fond.
- Défaut corrigé : Échap tentait auparavant de focaliser le bouton encore `inert`; la restitution est désormais différée à la trame suivante et prouvée sur Chromium/WebKit.
- Preuves ciblées : statique P2-06 2/2; local Chromium/WebKit 8/8; production finale 8/8 avec APIs simulées et aucune écriture métier. Une navigation WebKit a d’abord conservé le seul HTML pré-rendu sans hydratation, puis le scénario complet a repassé isolément 1/1.
- Non-régression : frontend 69/69, backend 15 fichiers/122 tests, ESLint, `git diff --check`, client-only, build et budgets conformes. Le run Playwright complet a réussi 102/104 en 10,9 minutes; les deux scénarios historiques WebKit intermittents P2-05/Phase 9 ont repassé ensemble 2/2 immédiatement. P2-06 y a réussi 8/8.
- Performance : entrée 380 353 octets (121 106 gzip), plus grande route publique 39 869/40 000, admin 50 360, plus grand CSS 14 933/15 000 et CSS total 79 667.
- Déploiement frontend-only : `frontend/dist` servi par Nginx; accueil et santé HTTPS 200; aucune migration, écriture métier ou relance backend. Service inchangé PID 3245038, `NRestarts=60`, actif; base inchangée 23/23.

P2-06 est terminé et `VALIDÉ-PROD`. LEG-01 « Alignement des mentions légales » devient le prochain et seul problème ordonné; il n’est pas commencé. Progression : 18/25 phases terminées (72 %), 7 restantes.

## 30. Exécution LEG-01 « Alignement des mentions légales » — 8 août 2026

État : `VALIDÉ-PROD`; version consolidée du 31 juillet 2026 publiée fidèlement, avec conservation séparée des informations déjà vérifiées et signalement explicite des mentions officielles absentes.

- Structure normative : la page expose exactement les quatre sections « Éditeur et propriété intellectuelle », « Responsabilité », « Droit applicable et différends » et « Documents associés ».
- Propriété intellectuelle : ajout de l’absence de cession de droits et des interdictions normatives d’extraction automatisée/répétée, réutilisation commerciale, base concurrente et entraînement/test/alimentation d’un système automatisé ou d’IA.
- Différends : formulation alignée sur la compétence exclusive des tribunaux matériellement compétents du ressort de Douala, sous réserve des dispositions impératives.
- Informations vérifiées : coordonnées publiées du Studio et fiche Hetzner conservées sous des sous-titres non normatifs clairement identifiés.
- Informations absentes : forme juridique/capital, RCCM/NIU et direction de publication restent listés comme en attente; aucun identifiant ou nom non vérifié n’est inventé.
- Version : date propre `31 juillet 2026` pour les mentions légales; Confidentialité et CGV conservent le 24 juillet jusqu’à LEG-02 et LEG-03.
- Preuves ciblées : statique LEG-01 2/2; local Chromium/WebKit 4/4; tests liés texte/liens/responsive/axe 6/6; production 8/8 sans écriture métier.
- Non-régression : frontend 71/71, backend 15 fichiers/122 tests, ESLint, `git diff --check`, client-only, build et budgets conformes. Playwright complet : 106/108 en 11,7 minutes; LEG-01 4/4. Deux crashes WebKit historiques P2-04/P2-05 ont repassé séparément 1/1 et 1/1 dans des processus neufs.
- Performance : entrée 380 353 octets (121 096 gzip), plus grande route publique 39 869/40 000, admin 50 360, plus grand CSS 14 933/15 000 et CSS total 79 782.
- Déploiement frontend-only : `frontend/dist` servi par Nginx; page et santé HTTPS 200; aucune migration, écriture métier ou relance backend. Service inchangé PID 3245038, `NRestarts=60`, actif; base inchangée 23/23.

LEG-01 est terminé et `VALIDÉ-PROD`. LEG-02 « Alignement de la politique de confidentialité » devient le prochain et seul problème ordonné; il n’est pas commencé. Progression : 19/25 phases terminées (76 %), 6 restantes.

## 31. Exécution LEG-02 « Alignement de la politique de confidentialité » — 8 août 2026

État : `VALIDÉ-PROD`; politique consolidée du 31 juillet 2026 publiée en dix sections, alignée sur le document juridique normatif et complétée par les pratiques opérationnelles déjà vérifiées.

- Structure normative : responsable, données collectées, finalités/fondements, destinataires/prestataires/transferts, traitement numérique des images, durées/archivage, cookies/traceurs, sécurité, droits et documents associés.
- Données et finalités : couverture des demandes, réservations, paiements, communications et suivis; catégories d’identité/contact, réservation, paiement, entreprise, technique, consentement, échanges et images; prévention de la fraude et des doublons explicitée.
- Destinataires et transferts : opérateurs habilités, banques, assureurs, conseils, recouvrement et autorités couverts; tableau des intégrations actives/désactivées conservé; aucune vente commerciale autonome des données.
- Conservation et sécurité : cycles actif/archivé/anonymisé, archive à accès restreint, résidus de sauvegarde et exceptions légales décrits; confidentialité, intégrité, disponibilité et traçabilité couvertes sans promettre un risque nul.
- Droits : modalités de contact, justificatif d’identité proportionné au risque, limites légales à l’effacement et retrait distinct/prospectif du droit à l’image publiés. L’automatisation des demandes et échéances reste réservée à LEG-05.
- Traceurs : politique normative publiée avec l’état opérationnel vérifié — aucun outil public publicitaire ou analytique actif; seul le cookie d’administration strictement nécessaire, privé et limité à huit heures, est déclaré.
- Preuves : test rouge statique 0/2, puis statique 2/2; LEG-02 local Chromium/WebKit 4/4; tests liés contenu/liens/responsive/axe 6/6; production ciblée 8/8 sans écriture métier.
- Non-régression : frontend 73/73, backend 15 fichiers/122 tests, Playwright local complet 112/112 en 11 minutes; ESLint, `git diff --check`, client-only, build, prerender et budgets conformes.
- Performance : entrée 380 353 octets (121 098 gzip), plus grande route publique 39 869/40 000, admin 50 360, plus grand CSS 14 933/15 000 et CSS total 79 782.
- Déploiement frontend-only : `frontend/dist` servi par Nginx; confidentialité et santé HTTPS 200; aucune migration, écriture métier ou relance backend. Service inchangé PID 3245038, `NRestarts=60`, actif; base inchangée 23/23.

LEG-02 est terminé et `VALIDÉ-PROD`. LEG-03 « Alignement des conditions générales de vente » devient le prochain et seul problème ordonné; il n’est pas commencé. Progression : 20/25 phases terminées (80 %), 5 restantes.

## 32. Exécution LEG-03 « Alignement des conditions générales de vente » — 8 août 2026

État : `VALIDÉ-PROD`; CGV consolidées du 31 juillet 2026 publiées en huit sections et workflow de rétractation traçable livré sans annulation ni remboursement automatique.

- Publication normative : réservation/prix/paiement, retards/annulations/reports, rétractation, droit à l’image/droits d’auteur, traitement numérique, exécution/livraison/responsabilité, réclamations/litiges et documents associés.
- Règles opérationnelles : délai de 48 heures calculé selon Douala, report unique et gratuit, conditions de remboursement effectif et version des CGV acceptée explicités; les workflows existants restent ciblés et traçables.
- Rétractation : registre persistant relié à la réservation et à la commande idempotente, fenêtre légale figée à 15 jours depuis la conclusion du contrat, canal/texte/preuve/date de réception et état d’exécution conservés.
- Décision humaine distincte : acceptation ou rejet motivé, réservé au propriétaire; état/version contrôlés et audit enrichi. La décision ne déclenche automatiquement ni annulation, ni remboursement, ni mutation de paiement.
- Base : migration additive `20260808160000_leg_03_withdrawal_requests`, sept contraintes et sept index; aucune ligne métier de production créée pendant la validation.
- Preuves : test rouge statique 0/3 puis final 3/3; backend ciblé 3/3; LEG-03 local Chromium/WebKit 6/6; tests liés 6/6; production ciblée 10/10 avec API administration simulée, sans écriture métier réelle.
- Non-régression : frontend 76/76, backend 15 fichiers/125 tests, ESLint, TypeScript backend, `git diff --check`, build, prerender et budgets conformes. Le run Playwright monolithique a produit 116/118 en 11,1 minutes, LEG-03 6/6; les deux fermetures de processus WebKit historiques hors LEG-03 ont chacune repassé 1/1 dans un processus neuf.
- Performance : entrée 380 353 octets (121 099 gzip), plus grande route publique 39 869/40 000, admin 53 632, plus grand CSS 14 933/15 000 et CSS total 79 782.
- Déploiement : sauvegarde PostgreSQL valide de 119 530 octets (`sha256:29e0001808a263e5e541ac6a94cec68f145f31d30c8d21e2b7541792f34be1e8`), migration 24/24, frontend servi par Nginx et backend actif PID 4153872 avec `NRestarts=61`; CGV et santé HTTPS 200. Les 13 réservations et 13 paiements sont inchangés; zéro demande de rétractation en production.

LEG-03 est terminé et `VALIDÉ-PROD`. LEG-04 « Consentement distinct au droit à l’image » devient le prochain et seul problème ordonné; il n’est pas commencé. Progression : 21/25 phases terminées (84 %), 4 restantes.

## 33. Exécution LEG-04 « Consentements, preuve, retrait et versionnement » — 8 août 2026

État : `VALIDÉ-PROD`; choix juridiques publics séparés, registre de versions publié et preuves append-only d’accord, refus et retrait prospectif activés.

- Registre juridique : versions publiées distinctes pour CGV, confidentialité et autorisation d’image, toutes datées du 31 juillet 2026 et reliées au SHA-256 de la source consolidée.
- Choix public : CGV et lecture de la confidentialité disposent désormais de cases requises séparées; droit à l’image et WhatsApp restent séparés et décochés par défaut. La finalité « Portfolio et promotion du Studio » et la portée site web/Instagram/TikTok sont affichées avant le choix.
- Preuve : chaque nouvelle réservation crée, dans la même transaction, un événement immuable `GRANTED` ou `REFUSED` avec version, finalité, portée, texte présenté, source, date et identifiants idempotents.
- Retrait : événement propriétaire idempotent et chaîné à la preuve précédente, avec date Douala, canal et référence de preuve; contrôle de concurrence et audit. Il produit effet pour l’avenir sans réécrire le snapshot, le profil ou les autres données nécessaires.
- Migration : `20260808194500_leg_04_legal_consents` crée deux registres additifs, publie trois versions et reprend une preuve par snapshot existant; trigger SQL contre UPDATE/DELETE direct des événements.
- Preuves : test rouge statique 0/3 puis final 3/3; backend ciblé 3/3; LEG-04 local Chromium/WebKit 4/4; parcours liés réservation/axe/validation 26/26; production ciblée 8/8 avec API admin simulée.
- Non-régression : frontend 79/79, backend 15 fichiers/128 tests, ESLint, TypeScript backend, `git diff --check`, build, prerender et budgets conformes. Playwright global : 120/122 en 12,1 minutes, LEG-04 4/4; les deux instabilités WebKit historiques hors LEG-04 (P1-03 et P2-04) ont repassé séparément 1/1 et 1/1 dans des processus neufs.
- Performance : entrée 380 353 octets (121 107 gzip), plus grande route publique 37 272/40 000, admin 54 921/55 000, plus grand CSS 14 933/15 000 et CSS total 79 782; le bloc de consentements est chargé à l’étape utile.
- Production : sauvegarde PostgreSQL valide de 126 843 octets (`sha256:c74e82caf605f3ed75919f884cb0226f0faac4fa3d09195557fb902a47154e9e`), migration 25/25 et backend actif PID 276996 avec `NRestarts=62`; réservation et santé HTTPS 200. Les 13 réservations et 13 paiements sont inchangés; trois versions et 13 preuves historiques (9 accords, 4 refus, aucun retrait artificiel) sont présentes.

LEG-04 est terminé et `VALIDÉ-PROD`. LEG-05 « Conservation, archivage, sécurité et demandes de droits » devient le prochain et seul problème ordonné; il n’est pas commencé. Progression : 22/25 phases terminées (88 %), 3 restantes.

## 34. Exécution LEG-05 « Conservation, archivage, sécurité et demandes de droits » — 8 août 2026

État : `VALIDÉ-PROD`; politiques exécutables publiées et registre confidentiel des demandes de droits activé sans délai légal inventé ni effacement automatique.

- Politiques : sept catégories versionnées couvrent réservations, paiements, consentements, images/fichiers de travail, journaux techniques, sauvegardes et demandes de droits. Chaque politique décrit déclencheur, phase active, archivage restreint, sort final et traitement des sauvegardes.
- Garde destructive : `automaticExecution=false` est imposé en base. Anonymisation et effacement sont des actions explicites à exécuter après revue des obligations, preuves, litiges et gels; aucune donnée n’est supprimée silencieusement.
- Registre : accès, rectification, limitation, opposition, portabilité, retrait et effacement; identité/contact minimisés, référence de réservation facultative, canal, résumé, réception et échéance opérationnelle saisie. L’interface précise que cette cible n’est pas un délai légal automatique.
- Instruction : statut, vérification d’identité sans dépôt de pièce brute, limitation des nouveaux traitements, archivage restreint, anonymisation/effacement requis ou gel juridique daté, motif et preuve de réponse.
- Sécurité : API et onglet réservés au rôle `OWNER`; commandes dédupliquées, version optimiste, audit minimisé et événements append-only. Les politiques publiées et événements sont protégés contre UPDATE/DELETE SQL direct.
- Migrations : `20260808213000_leg_05_data_governance` puis `20260808214500_leg_05_governance_integrity`; 27/27 en production, sept politiques, zéro demande et zéro événement artificiel.
- Preuves : rouge statique 0/4 puis final 4/4; backend ciblé 3/3; local Chromium/WebKit 4/4; production 4/4 avec API interceptée et sans écriture métier.
- Non-régression : frontend 83/83, backend 15 fichiers/131 tests, Prisma/TypeScript/ESLint, `git diff --check`, build, prerender et budgets conformes. Playwright complet : 125/126 en 11,7 minutes, LEG-05 4/4; l’unique intermittence historique WebKit de réservation hors LEG-05 a repassé 1/1 dans un processus neuf.
- Performance : entrée 380 356 octets (121 110 gzip), plus grande route publique 37 272/40 000, admin 54 946/55 000, CSS maximal 14 933/15 000 et CSS total 80 958. Le panneau et son CSS sont chargés paresseusement.
- Production : sauvegarde `.phase0-backups/20260808-210800-pre-leg-05/database-pre-leg-05.dump`, 137 436 octets, mode 0600, SHA-256 `55abf6b8f378c898ab6705909210c10ab27379f10cfc719fcd33975a410c01be`, catalogue `pg_restore` de 252 lignes. Backend actif PID 374587, `NRestarts=63`; admin et santé HTTPS 200; 13 réservations et 13 paiements inchangés.

LEG-05 est terminé et `VALIDÉ-PROD`. LEG-06 « Inventaire des traceurs et préférences si nécessaire » devient le prochain et seul problème ordonné; il n’est pas commencé. Progression : 23/25 phases terminées (92 %), 2 restantes.

## 35. Exécution LEG-06 « Inventaire des traceurs et préférences si nécessaire » — 8 août 2026

État : `VALIDÉ-PROD`; inventaire réel centralisé, audit bloquant au build et preuve navigateur livrés sans afficher une fausse CMP en l’absence de traceur facultatif.

- Inventaire : version `2026-08-08`, deux entrées déclarées. `__Host-gsp_admin_session` reste strictement nécessaire, privé, HttpOnly, Secure, SameSite Strict, sans Domain et limité à huit heures; Google Fonts est déclaré comme ressource typographique externe sans finalité de traçage.
- Situation publique : aucun cookie, `localStorage`, `sessionStorage`, IndexedDB, `document.cookie` ou `sendBeacon` utilisé par l’application; seules les origines `fonts.googleapis.com` et `fonts.gstatic.com` sont automatiquement chargées et inventoriées.
- Garde-fous : le build recherche les signatures d’analytics/publicité connues, les APIs de stockage et les origines auto-chargées non déclarées. Toute future entrée facultative doit être désactivée par défaut, exiger un accord, offrir « Refuser » aussi directement que « Accepter » et permettre le retrait.
- Transparence : la section 7 de la politique publie l’inventaire opérationnel, la finalité, la portée, le mécanisme et la durée. Aucune bannière ou préférence factice n’est affichée puisqu’aucun choix facultatif n’existe actuellement.
- Preuves : rouge statique 0/4 puis final 4/4; audit build passé avec deux entrées, deux origines, zéro facultatif, zéro stockage et zéro signature interdite; LEG-06 local Chromium/WebKit 4/4; production 4/4.
- Non-régression : frontend 87/87, backend 15 fichiers/131 tests, ESLint, `git diff --check`, build, prerender et budgets conformes. Playwright complet : 129/130 en 12,3 minutes, LEG-06 4/4; l’unique fermeture WebKit hors périmètre sur P2-05 a repassé 1/1 dans un processus neuf.
- Performance : entrée 380 356 octets (121 101 gzip), plus grande route publique 37 272/40 000, admin 54 946/55 000 et CSS total 80 958; rapport public `tracker-audit-report.json` généré à chaque build.
- Production frontend-only : rapport `passed: true`, confidentialité, admin et santé HTTPS 200; aucune migration, écriture métier ou relance backend. Service inchangé PID 374587, `NRestarts=63`, actif; base inchangée 27/27.

LEG-06 est terminé et `VALIDÉ-PROD`. LEG-07 « Respect effectif du droit à l’image sur les médias » devient le prochain et seul problème ordonné; il n’est pas commencé. Progression : 24/25 phases terminées (96 %), 1 restante.

## 36. Exécution LEG-07 « Respect effectif du droit à l’image sur les médias » — 8 août 2026

État : `VALIDÉ-PROD`; chaque publication est désormais justifiée par une autorisation de catalogue propriétaire ou par un accord client courant relié au contenu exact, et tout retrait cesse automatiquement la nouvelle utilisation concernée.

- Modèle de droits : `MediaItem` porte la base, la preuve, la réservation et les dates de publication/dépublication; `MediaConsentUsage` relie un média précis à la réservation, à l’accord, à la finalité et à la portée autorisées.
- Publication sûre : création en brouillon par défaut, référence de réservation obligatoire pour un média client, actions réservées à `OWNER` et refus de publication sans accord `GRANTED` courant pour `PORTFOLIO_AND_PROMOTION`/`WEBSITE`.
- Garde base de données : trigger différé contre toute publication sans base valide; contrôle de cohérence de l’usage; insertion d’un retrait qui clôt les usages actifs et dépublie/dé-épingle les médias exacts. Une nouvelle publication reste bloquée jusqu’à un nouvel accord.
- Exposition publique : filtre centralisé limité au catalogue propriétaire autorisé ou aux usages clients actifs; base de droits, preuve, réservation et relations de consentement ne quittent pas l’administration.
- Administration accessible : panneau médias chargé paresseusement, base/statut/référence visibles, publication directe décochée et contrôles désactivés pour STAFF.
- Catalogue historique : seuls les 17 médias `owner-approved-*` du manifeste privé ont été repris comme `OWNER_APPROVED_CATALOG`; `seed-hero` reste non publié et aucun usage client artificiel n’a été créé.
- Livrables : masters/fichiers de travail privés et workflow `ReservationDelivery` inchangés; LEG-07 ne crée ni ne modifie aucune livraison. La preuve fournisseur E-19 demeure suivie séparément sous NOTIF-01.
- Preuves : rouge statique 0/4 puis final 4/4; backend ciblé 3/3; LEG-07 local Chromium/WebKit 4/4; production ciblée 4/4; API publique à 17 médias avec zéro fuite de champ interne.
- Non-régression : frontend 91/91, backend 15 fichiers/134 tests, Prisma/TypeScript/ESLint, `git diff --check`, audit traceurs, build, prerender et budgets conformes. Playwright complet : 132/134 en 12,5 minutes, LEG-07 4/4; les deux intermittences WebKit historiques LEG-03/Phase 9 ont repassé ensemble 6/6 immédiatement.
- Performance : entrée 380 353 octets (121 106 gzip), plus grande route publique 37 272/40 000, admin 50 170, CSS total 80 958 et panneau médias 6 910 octets chargé à la demande.
- Production : sauvegarde `.phase0-backups/20260808T230000Z-pre-leg-07/database-pre-leg-07.dump`, 155 163 octets, mode 0600, SHA-256 `ced864afc6b81c7b105615b4f776ff4970c36409718f52ea454dd99f7cfc7321`; migration `20260808233000_leg_07_media_rights` appliquée, base 28/28. Backend actif PID 570395, `NRestarts=64`; santé/admin HTTPS 200. Les 13 réservations, 13 paiements, 9 accords et 4 refus sont inchangés.

LEG-07 est terminé et `VALIDÉ-PROD`. Le registre ordonné est achevé : 25/25 phases terminées (100 %), aucune phase restante.

## 37. Plan de clôture post-audit des trois DOCX — 9 août 2026

État initial : `PLANIFIÉ`. Ce registre remplace la lecture trompeuse « 25/25 » pour la clôture exhaustive des 61 identifiants atomiques extraits des trois DOCX. Le commit d’audit `8c27a59` constitue la baseline : 49/61 `VALIDÉ-PROD`, 6/61 `DÉPLOYÉ NON PROUVÉ`, 4/61 `TESTÉ LOCALEMENT` et 2/61 `BLOQUÉ-PREUVE-EXTERNE`.

### 37.1 Périmètre et règle de clôture

- Périmètre actif : 59 identifiants. P1-01/I-08 WhatsApp sont explicitement différés jusqu’à la fourniture des identifiants Meta Business; ils ne bloquent pas la clôture du périmètre e-mail, mais restent visibles et ne seront jamais requalifiés artificiellement.
- Cible active : 59/59 `VALIDÉ-PROD`, soit 59/61 au registre global. Le verdict final devra écrire « 100 % du périmètre actif, WhatsApp/Meta différé », jamais « 100 % global ».
- Une preuve mockée valide le code, pas un fournisseur. Une preuve externe exige un message réellement reçu ou un rapport réellement émis par Zoho, avec éléments personnels expurgés du dépôt.
- Aucun e-mail réel, aucune création de réservation QA et aucune publication de livrable ne seront effectués sans autorisation explicite préalable du propriétaire et désignation d’une boîte de test contrôlée.
- Les 22 contenus tarifaires manquants ne seront pas inventés. Ils doivent être fournis ou approuvés par l’OWNER puis publiés par le workflow versionné existant, sans UPDATE SQL direct des versions historiques.

### 37.2 Registre ordonné

| Ordre | Phase | Couverture | État initial | Condition de sortie |
|---|---|---|---|---|
| 0 | AUD-00 — Baseline indépendante | 61 identifiants, correctifs P1-04/NOTIF-01/LEG-02 | `VALIDÉ-PROD` | Commit `8c27a59`, tests et production documentés |
| 1 | POST-01 — Cycles et déduplication I-03 à I-06 | I-03, I-04, I-05, I-06 | `VALIDÉ-PROD` | Scénarios dédiés de premier cycle, rejeu, concurrence et second cycle verts; 53/61 `VALIDÉ-PROD` |
| 2 | POST-02 — Anti-saturation administrative | NOTIF-01 critère 12 | `VALIDÉ-PROD` | Politique acteur/destinataire explicite, testée et déployée sans supprimer les alertes de boîte partagée |
| 3 | POST-03 — Complétude des 22 formules | Dette de contenu P1-04 | `DIFFÉRÉ-OWNER` | Chaque formule publique courante possède résumé et délai approuvés dans une nouvelle version publiée; snapshots historiques inchangés |
| 4 | POST-04 — Preuve destinataire des livrables | E-17, E-18, E-19 | `BLOQUÉ-GATES-OWNER` | Parcours réel supervisé reçu, lien HTTPS ouvert et preuve expurgée consignée; 56/61 `VALIDÉ-PROD` |
| 5 | POST-05 — Preuves Zoho et alertes internes | I-09, I-11, I-12 | `BLOQUÉ-ACCÈS-OAUTH-ET-AUTORISATION` | Rapports/notifications réels capturés et déduplication/rejeu prouvés; 59/61 `VALIDÉ-PROD` |
| 6 | POST-06 — Revalidation exhaustive et clôture | 59 identifiants actifs | `PLANIFIÉ` | Relecture DOCX, matrice 59/59 active, suites complètes, postflight production, documentation et commit |
| D | META-01 — WhatsApp Business | P1-01, I-08 | `DIFFÉRÉ-META` | Hors chemin critique; ne démarre qu’après fourniture et approbation des identifiants Meta |

Progression de clôture : 2/6 phases actives terminées; 53/61 exigences sont `VALIDÉ-PROD` et META-01 reste différée hors dénominateur actif. POST-02 clôt un critère transverse sans ajouter artificiellement un identifiant au registre atomique.

Ordre d’exécution : POST-01 → POST-02. POST-03 peut avancer en parallèle dès que le contenu OWNER est disponible. POST-04 précède POST-05 afin que la même fenêtre de preuve supervisée couvre réception et retours fournisseur. POST-06 ne commence qu’après POST-01 à POST-05, ou documente précisément toute gate externe encore ouverte.

### 37.3 POST-01 — Cycles et déduplication I-03 à I-06

État : `VALIDÉ-PROD` le 9 août 2026. Les preuves d'exécution et de production sont consignées dans la section 38.

Objectif : transformer les quatre statuts `TESTÉ LOCALEMENT` en preuves comportementales dédiées, en particulier le deuxième cycle paiement→attente que l’idempotency key actuelle peut confondre avec le premier.

Implémentation et tests :

- Écrire d’abord des scénarios rouges ciblés dans les tests d’intégration notification/finance/report.
- I-03 : prouver une alerte au premier cycle, zéro doublon au rejeu du même cycle, puis exactement une nouvelle alerte pour un nouveau paiement ou cycle de décision légitime; couvrir deux workers concurrents.
- I-04 : distinguer le rejeu idempotent d’une même demande de report d’une nouvelle demande métier autorisée; une seule alerte par demande réelle.
- I-05 : couvrir annulation client et Studio, seuils financiers, rejeu de commande et concurrence; une alerte par décision effective.
- I-06 : couvrir création, engagement et finalisation de tâche financière, rejeu de commande et version périmée; aucune alerte avant la tâche requise ni duplication après finalisation.
- Si le test I-03 révèle que la clé stable par réservation supprime un cycle légitime, inclure l’identité du paiement/cycle dans la clé tout en conservant la déduplication du rejeu. Ne jamais réécrire les événements historiques.

Validation et sortie : tests ciblés verts, backend complet vert, TypeScript/Prisma conformes, déploiement sans envoi fournisseur, smoke production non mutatif et matrice I-03/I-04/I-05/I-06 passée à `VALIDÉ-PROD`.

### 37.4 POST-02 — Anti-saturation administrative

État : `VALIDÉ-PROD` le 9 août 2026. Les preuves d'exécution et de production sont consignées dans la section 39.

Objectif : rendre explicite et testable le critère « l’auteur d’une action n’est pas alerté inutilement de sa propre action » sans perdre les alertes opérationnelles destinées à la boîte partagée.

Politique à implémenter :

- Modéliser ou transmettre l’acteur de la commande, l’audience et la destination de l’alerte interne.
- Supprimer uniquement une notification redondante lorsque le destinataire nominatif correspond réellement à l’admin acteur.
- Conserver l’alerte lorsque la destination est la boîte opérationnelle partagée, lorsque l’action vient du système/worker ou lorsque le destinataire est un autre admin.
- Ne jamais appliquer ce filtre aux messages client E-xx, aux alertes terminales de sécurité/intégrité ni aux destinataires externes.
- Auditer la suppression avec une raison minimale, sans adresse complète ni secret.

Tests obligatoires : OWNER vers sa boîte nominative, OWNER vers boîte partagée, STAFF vers OWNER, worker sans acteur, destinataire client, rejeu et concurrence. Une migration ne sera ajoutée que si l’identité acteur/destinataire ne peut pas être portée durablement par les structures existantes.

Sortie : politique documentée, tests rouges puis verts, backend complet vert, production déployée et preuve qu’aucune alerte historique n’a été supprimée.

### 37.5 POST-03 — Complétude métier des formules

Objectif : résorber la dette de données révélée par P1-04 : les 22 versions/formules publiques existantes ont `description` et `deliveryLabel` à `null`, même si le code bloque désormais toute nouvelle publication incomplète.

Procédure :

- Exporter un inventaire OWNER avec identifiant, nom, catégorie, version publiée, résumé manquant et délai manquant.
- Faire fournir ou approuver un résumé public et un délai réel pour chaque formule; aucune génération automatique ne vaut approbation métier.
- Le préflight base confirme aussi 22 listes d'inclusions vides et 22 `legalText` absents. La relecture intégrale des trois DOCX récupère toutefois les CGV communes, une grille de délais déjà affichée et trois listes d'inclusions; seules les données formule par formule introuvables et les exceptions doivent être demandées à l'OWNER.
- Créer une nouvelle version DRAFT par formule via le service/API normal, prévisualiser, valider avec les mentions approuvées puis publier par commande OWNER idempotente.
- Archiver la version publiée précédente par le workflow existant; préserver les snapshots des 13 réservations et les prix/conditions historiques.
- Vérifier le rendu public, l’administration, les accents, FCFA, mobile et accessibilité; aucune formule ne doit disparaître pendant la bascule.

Sortie : zéro formule publique courante sans `description` ou `deliveryLabel`, historique/snapshots inchangés, compteurs/versionnements expliqués, tests P1-04 et production ciblée verts.

### 37.6 POST-04 — Preuve réelle E-17/E-18/E-19

Gate d’entrée : autorisation explicite d’envoi réel, adresse de test contrôlée, réservation QA autorisée ou dossier existant expressément désigné, et livrable HTTPS non sensible prévu pour la preuve.

Parcours supervisé :

- Capturer les compteurs et sauvegarder la base avant toute écriture de production.
- Utiliser exclusivement les commandes métier normales; aucun INSERT/UPDATE SQL direct pour fabriquer les événements.
- Prouver E-17 à la fin prévue, E-18 après passage effectif à `COMPLETED` avec délai/version, puis E-19 seulement après publication OWNER d’un `ReservationDelivery` dont l’URL HTTPS répond réellement en 2xx.
- Vérifier dans la boîte de test les sujets, références, Message-ID et horaires UTC/Douala; ouvrir le lien depuis le message et confirmer le téléchargement attendu.
- Vérifier qu’un master privé ou chemin interne n’est jamais exposé et qu’un lien absent/invalide/inaccessible bloque E-19.
- Consigner des preuves expurgées ou empreintes; ne jamais committer adresse complète, token, URL privée ou contenu client.

Sortie : E-17/E-18/E-19 requalifiés `VALIDÉ-PROD`, delta QA attendu documenté, files stabilisées et absence de mutation des 13 dossiers réels non concernés.

### 37.7 POST-05 — Preuves Zoho I-09/I-11/I-12

Gate d’entrée : autorisation d’envoi réel et confirmation du mécanisme que le compte Zoho utilisé fournit effectivement pour les rapports (webhook, DSN, API ou boîte de rebonds). Un webhook simulé ne suffit pas comme preuve fournisseur.

Travail prévu :

- Identifier et documenter le producteur Zoho réel. S’il n’émet pas le format signé attendu, implémenter un adaptateur entrant vérifiable, idempotent et minimisé; conserver la validation HMAC/rejeu aux frontières qui la supportent.
- Réception normale : rattacher le rapport réel au `NotificationEvent` exact et conserver identifiant fournisseur, statut et date sans dupliquer le contenu du message.
- I-09 : employer uniquement un simulateur officiel ou une adresse de test contrôlée pour obtenir un échec permanent; ne jamais envoyer volontairement vers une adresse tierce. Prouver zéro I-09 sur succès/échec temporaire et une seule I-09 sur échec permanent malgré rejeu.
- I-11 : prouver le digest une fois à 18 h Douala lorsqu’un travail utile existe, puis zéro envoi lorsqu’il est vide; vérifier la clé par date Douala.
- I-12 : soumettre un lead CONTACT/B2B QA autorisé, prouver l’accusé client correspondant et une seule alerte interne I-12 réellement reçue.
- Capturer les preuves expurgées, vérifier les files et documenter tout écart de capacité Zoho comme gate externe factuelle plutôt que comme succès.

Sortie : I-09/I-11/I-12 `VALIDÉ-PROD`, rapports fournisseur et réceptions réelles consignés, secrets absents du dépôt et aucun impact sur les destinataires réels hors QA.

### 37.8 POST-06 — Revalidation et clôture

- Réextraire intégralement les trois DOCX et recalculer l’inventaire des 61 identifiants; ne pas recopier les statuts antérieurs sans preuve.
- Vérifier code, schéma, migrations, workers, configuration et production pour chaque exigence.
- Exécuter Prisma format/validate/generate, TypeScript, backend complet, frontend complet, ESLint, audit traceurs, build/prerender/budgets, Playwright Chromium/WebKit local complet, production ciblée et axe.
- Distinguer dans le rapport le run complet initial et les éventuelles reprises de flakes; aucune reprise ne doit effacer le résultat initial.
- Comparer les compteurs production avant/après, vérifier santé, service, migrations et absence de secret dans le diff.
- Mettre à jour matrice, plan, changelog et rapport; créer un commit isolé sur `main`, pousser seulement si un remote existe, puis remettre l’arbre propre.

Condition de clôture active : 59/59 identifiants non-Meta `VALIDÉ-PROD`, toutes les gates e-mail levées, dette tarifaire résorbée et aucun écart transverse ouvert. Le rapport global restera 59/61 avec P1-01/I-08 `DIFFÉRÉ-META` jusqu’à META-01.

### 37.9 META-01 — Phase différée WhatsApp/Meta

Cette phase n’est pas autorisée ni planifiée dans le chemin actif. Aucun secret ne doit être inventé, committé ou demandé dans un canal non sécurisé. Elle pourra démarrer uniquement après fourniture d’un numéro WhatsApp Business vérifié, des identifiants/token/secrets Meta, des modèles approuvés et d’un destinataire de test consentant.

À sa reprise : configurer les secrets hors Git, valider le webhook Meta, laisser le canal désactivé jusqu’au préflight complet, réaliser un envoi entreprise et un envoi client consenti, prouver `sent/delivered/read`, cadence 0/2/10, échec terminal et I-08 unique, puis exécuter la non-régression et mettre à jour le registre à 61/61. Tant que ces conditions ne sont pas réunies, l’état reste `DIFFÉRÉ-META` et non `VALIDÉ-PROD`.

## 38. Exécution POST-01 « Cycles et déduplication I-03 à I-06 » — 9 août 2026

État : `VALIDÉ-PROD`; les quatre alertes internes reposent désormais sur une identité métier immuable et disposent de scénarios dédiés couvrant premier cycle, rejeu, concurrence et nouveau cycle légitime.

- I-03 : le test rouge a reproduit la collision de la clé historique stable par réservation (7/8 scénarios verts, échec sur la clé attendue). La nouvelle clé `payment:{id}:v{version}:{status}:I-03:email` distingue chaque cycle réel tout en dédupliquant ses rejeux. La version attendue est figée dans les métadonnées et un cycle périmé est classé `PAYMENT_CYCLE_CHANGED`; les événements historiques ne sont ni réécrits ni supprimés.
- I-04 : l'identité `reschedule-request:{id}` produit une seule I-04 sous rejeu et producteurs concurrents, puis une nouvelle I-04 pour une deuxième demande métier autorisée.
- I-05 : annulations client et Studio, seuil strictement supérieur à 48 heures, limite exacte, seuil inférieur, rejeu et deux décisions concurrentes sont couverts; une seule tâche et une seule I-05 résultent de la décision effective.
- I-06 : aucune alerte n'est créée avant la tâche financière atomique; rejeu, version périmée, double traitement concurrent, engagement et finalisation prouvée conservent une seule I-06 liée à la tâche.
- Validation locale : scénario rouge 7/8 puis final 9/9; suites notification/report/finance 33/33; backend complet 17 fichiers et 146/146; Prisma format/validate/generate, TypeScript et `git diff --check` conformes. Aucune migration.
- Production : backend compilé puis repris par systemd, PID `1172481`, `NRestarts=66`, actif; schéma 28/28 à jour; santé et administration HTTPS 200.
- Postflight non mutatif : 13 réservations, 13 paiements, 54 notifications, zéro tâche financière et zéro demande de report, inchangés par rapport à la baseline; aucun envoi fournisseur déclenché (dernier `sentAt` antérieur au déploiement, le 8 août 2026 à 17:00:12 UTC).

POST-01 est terminé et `VALIDÉ-PROD`. Progression de clôture : 1/6 phases actives; 53/61 exigences globales sont `VALIDÉ-PROD`. POST-02 « Anti-saturation administrative » devient la prochaine phase ordonnée; META-01 reste `DIFFÉRÉ-META` hors chemin critique.

## 39. Exécution POST-02 « Anti-saturation administrative » — 9 août 2026

État : `VALIDÉ-PROD`; la politique acteur/audience/destination est centralisée et raccordée à toutes les alertes internes I-01 à I-12 sans supprimer les alertes de la boîte opérationnelle partagée.

- Modèle sans migration : `NotificationEvent.metadata` porte `audience`, `destinationType`, `actorType`, l'identifiant admin acteur et, pour une destination nominative, l'identifiant admin destinataire. Les adresses ne sont pas recopiées dans la métadonnée d'audit.
- Suppression ciblée : uniquement une alerte `ADMIN` vers une destination `NOMINATIVE` correspondant à l'acteur. Elle est conservée comme événement `CANCELLED`, `resolution=SUPPRESSED` et `resolutionNote=SELF_NOMINATIVE_REDUNDANT`, sans tentative fournisseur.
- Préservation : `SHARED_OPERATIONAL`, autre admin, worker/système, source client/externe et messages E-xx restent envoyables. I-07/I-08/I-09/I-10 sont explicitement non supprimables même si une future destination devient nominative.
- Raccordement : les routes admin transmettent l'acteur aux alertes I-02 à I-06; I-01 est attribuée au client, I-11 au système et I-12 à une source externe. I-09/I-10 transactionnelles portent explicitement la destination partagée et l'acteur système.
- Preuve TDD : rouge 0 test chargé (module absent), puis POST-02 6/6; suites notification/finance/report/intégrité 43/43; backend complet 18 fichiers et 152/152; Prisma format/validate/generate, TypeScript et `git diff --check` conformes. Aucune migration.
- Production : backend repris par systemd, PID `1224482`, `NRestarts=67`, actif; schéma 28/28; santé et administration HTTPS 200.
- Postflight non mutatif : 13 réservations, 13 paiements, 54 notifications (40 `SENT`, 14 `FAILED`), zéro tâche financière, zéro demande de report et zéro suppression historique. Aucun envoi fournisseur; dernier `sentAt` inchangé au 8 août 2026 à 17:00:12 UTC.

POST-02 est terminé et `VALIDÉ-PROD`. Progression : 2/6 phases actives et 53/61 exigences atomiques `VALIDÉ-PROD`; le compteur ne change pas car l'anti-saturation est un critère transverse. POST-03 reste en attente du contenu OWNER des 22 formules; en l'absence de ce contenu, la prochaine phase techniquement exécutable est POST-04, soumise à l'autorisation explicite d'envoi réel.

## 40. Préparation POST-03 « Complétude métier des 22 formules » — 9 août 2026

État courant : `DIFFÉRÉ-OWNER`; aucune version n'a été créée et aucune donnée de production n'a été modifiée.

- Extraction directe en lecture seule : 22 formules actives/non archivées, 22 versions 1 `PUBLISHED`, zéro `DRAFT`, zéro `VALIDATED`.
- Dette confirmée : 22/22 `description`, 22/22 `deliveryLabel`, 22/22 listes `inclusions` et 22/22 `legalText` sont absents. Les valeurs `content`/`conditions` issues du backfill reprennent seulement le nom : elles passent la garde technique mais exigent confirmation ou remplacement OWNER.
- Relecture exhaustive corrigée : les 1 064 lignes de la bibliothèque d'e-mails, 509 lignes du rapport d'audit et 125 lignes juridiques ont été lues. Les CGV communes du 31 juillet, la grille frontend 24 h/48 h/72 h/5 j/7 j et trois listes d'inclusions sont récupérables; le DOCX e-mail précise néanmoins que le délai réel doit être défini selon la prestation, et l'audit constate explicitement l'absence de description/mentions sur Flash Social.
- Livrable corrigé : `GOLDEN_STUDIO_PLUS_OWNER_PACKAGE_CONTENT_INVENTORY.md` distingue contenus récupérés, sources normatives, grille existante et seuls écarts réels; l'hypothèse « 88 nouveaux textes » est abandonnée.
- Invariants : 13 réservations et 13 snapshots; empreinte SHA-256 des liaisons et données tarifaires figées `30c8b4efc31b89abe8081a1e1d7b33576bb5e4002afc025d4932bb824a968be1`.
- Gate : aucune création DRAFT, validation ou publication avant identification de la source catalogue détaillée, approbation ou correction de la grille de livraison, confirmation de l'application des CGV communes et inventaire des éventuelles conditions particulières.

POST-03 n'est pas terminé et la progression reste à 2/6 phases actives et 53/61 exigences `VALIDÉ-PROD`. Le 9 août 2026, l'OWNER a demandé de différer cette phase pendant l'attente des réponses catalogue : son état devient `DIFFÉRÉ-OWNER`, sans requalification en succès. POST-04 et POST-05 restent également fermées faute d'autorisation d'envoi réel et de boîte de test contrôlée; POST-06 ne peut donc pas commencer.

## 41. Relecture exhaustive et correction de préparation POST-03 — 9 août 2026

État courant : `DIFFÉRÉ-OWNER`; préparation technique et documentaire corrigée, production métier inchangée.

- Sources intégrales : bibliothèque e-mails 1 064/1 064 lignes, rapport d'audit 509/509 et textes juridiques 125/125 relus; historique Git complet et sources publiques du dépôt rapprochés.
- Récupération : CGV communes déjà approuvées et publiées, délais frontend existants pour 22/22 formules, inclusions commerciales existantes pour `classic-propre`, `pack-signature` et `duo-couple`.
- Écarts réels : aucun catalogue détaillé formule par formule dans les trois DOCX, la base ou l'historique Git; 19 listes d'inclusions restent sans source locale. La bibliothèque d'e-mails demande explicitement de définir le délai réel selon la prestation.
- Correctif frontend : `packageView` donne désormais priorité au `deliveryLabel` versionné fourni par l'API et ne conserve le calcul historique que comme fallback. Le test rouge recevait `24 h` au lieu de la valeur OWNER; le test final est vert.
- Validation : test ciblé 5/5, frontend complet 92/92, ESLint, build/prerender/budgets et audit traceurs conformes; P1-04 local Chromium/WebKit 4/4 et production interceptée non mutative 4/4.
- Production frontend : chunk `packages-DXmI3P88.js` servi avec priorité `e.deliveryLabel?.trim()`, santé/admin 200. Base inchangée : 22 `PUBLISHED`, zéro DRAFT/VALIDATED, 13 réservations/snapshots et empreinte tarifaire identique.
- Documentation : l'inventaire initial réclamant 88 nouveaux textes est remplacé par une matrice de récupération. Une réponse OWNER globale peut approuver les délais et CGV; seuls les descriptions/contenus et inclusions réellement absents doivent être sourcés.

POST-03 reste ouvert mais différé par décision OWNER : aucune version 2, validation ou publication ne sera créée avant récupération du catalogue détaillé et aperçu OWNER. Progression inchangée : 2/6 phases actives et 53/61 exigences `VALIDÉ-PROD`.

## 42. Préflight POST-04 « Preuve réelle E-17/E-18/E-19 » — 9 août 2026

État : `BLOQUÉ-GATES-OWNER`; code prêt et tests ciblés verts, aucune réservation, livraison ou notification créée en production et aucun e-mail réel envoyé.

- Deux dossiers QA indépendants sont obligatoires : E-17 termine un dossier en `NO_SHOW`, tandis que E-18/E-19 exigent un autre dossier en `COMPLETED`. Ces états sont terminaux et ne peuvent pas être enchaînés sur une même réservation.
- Préflight production en lecture seule : 13 réservations (6 `PENDING_CONFIRMATION`, 4 `CONFIRMED`, 1 `COMPLETED`, 2 `CANCELLED`), zéro `ReservationDelivery`, zéro E-17/E-18/E-19 et zéro tentative associée.
- SMTP sortant prêt : livraison e-mail, worker, hôte, expéditeur et authentification configurés. Le secret de webhook de rapports fournisseur est absent; ce point relève de POST-05 et n'empêche pas la preuve de réception POST-04.
- Blocage E-18 : 0/22 versions `PUBLISHED` ont un `deliveryLabel`, et 0/13 réservations référencent une version qui en possède un. Le code refuse donc correctement de créer E-18 dans l'état actuel.
- Gates restantes : autorisation explicite des envois réels; adresse QA contrôlée; autorisation de créer deux réservations QA; au moins une version publiée avec un délai OWNER approuvé pour le dossier `COMPLETED`; livrable HTTPS public, non sensible et téléchargeable approuvé.
- Validation locale ciblée : `email-notifications.test.ts` + `delivery-notifications.test.ts`, 2 fichiers et 18/18 tests verts. Le runbook supervisé est `GOLDEN_STUDIO_PLUS_POST_04_EMAIL_PROOF_RUNBOOK.md`.

POST-04 ne sera pas déclaré terminé par des mocks. Les 13 dossiers existants sont exclus par défaut et ne pourront être utilisés que si l'OWNER en désigne expressément un; la voie recommandée reste deux dossiers QA neufs et identifiables.

## 43. Préflight POST-05 « Preuves Zoho et alertes internes » — 9 août 2026

État : `BLOQUÉ-ACCÈS-OAUTH-ET-AUTORISATION`; aucune donnée de production créée ou modifiée et aucun e-mail réel supplémentaire envoyé.

- Configuration active classifiée sans exposer l'hôte : Zoho Mail SMTP, pas ZeptoMail. `EMAIL_DELIVERY_WEBHOOK_SECRET` est absent; le point d'entrée de rapports reste donc fermé par défaut.
- I-11 fonctionne déjà en production : sept événements du 2 au 8 août, chacun créé à 18 h Douala, tenté une fois, `SENT` et accepté par SMTP. Aucun n'a `deliveredAt`, faute de rapport fournisseur, et la réception en boîte reste à capturer.
- I-09 : zéro événement et zéro `EmailDeliveryReport`. Les 14 e-mails actuellement `FAILED` ne seront pas requalifiés rétroactivement en bounces sans preuve fournisseur.
- I-12 : zéro événement actuel malgré huit leads historiques; une nouvelle soumission QA autorisée est nécessaire pour une preuve réelle et isolée.
- Compatibilité fournisseur : le webhook interne attend un JSON normalisé et une signature `x-gsplus-signature-256`. Zoho Mail documente des journaux de livraison consultables/exportables et une API SMTP Logs à portée OAuth partenaire; ZeptoMail documente des webhooks bounce avec un payload et une signature `producer-signature` différents. Aucun de ces producteurs n'est actuellement raccordé au format interne.
- Décision requise avant implémentation : conserver Zoho Mail et autoriser/valider l'accès API en lecture seule aux SMTP Logs, ou migrer le canal transactionnel vers ZeptoMail puis implémenter son adaptateur signé. Aucun secret ne sera placé dans Git.
- Validation locale ciblée : quatre fichiers, 21/21 tests verts pour bounce/I-09, signature/rejeu, digest I-11 et lead/I-12. Le protocole est `GOLDEN_STUDIO_PLUS_POST_05_ZOHO_PROOF_RUNBOOK.md`.

POST-05 reste ouvert. I-11 ne sera pas requalifié sur le seul statut SMTP `accepted`; I-09 exige un vrai rapport de bounce et I-12 une réception réelle sur les boîtes QA autorisées.

## 44. POST-05 — Voie A Zoho Mail sélectionnée et probe OAuth — 9 août 2026

État : `BLOQUÉ-ACCÈS-OAUTH-ET-AUTORISATION`; le choix fournisseur est levé, mais l'accès réel n'est pas encore confirmé.

- Décision OWNER : conserver Zoho Mail et utiliser les SMTP Logs en lecture seule; aucune migration vers ZeptoMail.
- Ajout d'un probe opérateur `npm run email:zoho-smtp-logs:check`, sans raccordement au worker ni exécution automatique en production.
- Sécurité : neuf origines régionales officielles Zoho en liste blanche stricte; filtre sur un seul Message-ID I-11 connu, fenêtre de 14 jours, limite d'un résultat, délai réseau de 10 secondes et aucune donnée du journal affichée.
- Le Message-ID est résolu en lecture seule depuis le dernier I-11 si aucun override n'est fourni. Le token n'est ni loggé, ni écrit par le probe, ni ajouté au dépôt.
- Validation : 4/4 tests du probe, backend complet 19 fichiers et 156/156 tests, build TypeScript vert. Le lancement sans accès échoue avant le réseau avec `ZOHO_SMTP_LOGS_PROBE_ENV_MISSING:ZOHO_MAIL_ORG_ID`.
- Gate restante : fournir hors Git `ZOHO_MAIL_ORG_ID` et un token d'une heure portant `ZohoMail.partner.organization.READ`; configurer le datacenter régional seulement s'il diffère de `https://mail.zoho.com`, puis exécuter le probe.

Aucune variable production, donnée, notification ou livraison n'a été modifiée. La confirmation OAuth exigera une réponse `accessConfirmed=true`; la présence du Message-ID sera rapportée uniquement comme compteur 0/1.
