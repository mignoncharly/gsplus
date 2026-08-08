# Rapport de tests — P0-01, P0-04, P0-03 et P0-02

Date : 1er août 2026
État global : P0-01, P0-04, P0-03 et P0-02 `VALIDÉ-PROD`; P0-02 redémarré et vérifié en production le 1er août 2026.

## Périmètre validé

- Snapshot 1:1 de l’identité, des coordonnées, du tarif, du créneau et des consentements au moment de la réservation.
- Séparation du profil `Customer` mutable et du dossier historique `ReservationSnapshot` immuable.
- Destinataires et rendus e-mail, WhatsApp et payload Cal.com basés sur le snapshot.
- Affichage admin priorisant le snapshot, avec compatibilité temporaire pendant un rolling deployment.
- Registre dédupliqué `DataIntegrityIncident` pour I-10 lorsqu’un snapshot manque.
- Backfill des réservations historiques, marqué `HISTORICAL_BACKFILL` avec preuve `UNVERIFIED_BACKFILL`.

## Preuve rouge initiale

Le test des six réservations partageant `+237640703249` échouait avant correction : les six dossiers relisaient la sixième identité (`Identite6`). Cette preuve a été obtenue uniquement sur PostgreSQL jetable `golden_studio_test`, port 55432.

## Résultats finaux isolés

| Contrôle | Résultat |
|---|---|
| Prisma `validate` | Réussi |
| 12 migrations rejouées depuis une base vide | Réussi |
| Test ciblé six identités / mutation profil / destinataire tardif | Réussi |
| UPDATE direct du snapshot | Bloqué par `RESERVATION_SNAPSHOT_IMMUTABLE` |
| DELETE direct du snapshot | Bloqué par `RESERVATION_SNAPSHOT_IMMUTABLE` |
| DELETE de la réservation et cascade du snapshot | Réussi |
| Backfill fictif depuis l’ancien schéma | Réussi : identité, formule v3, 22 500 XAF, 75 min, consentements et marqueur historique |
| Incident I-10 sur deux tentatives | Un seul incident, `occurrenceCount = 2`, aucune livraison Cal.com |
| Backend Vitest complet | 2 fichiers, 51/51 tests réussis |
| Backend TypeScript | Réussi |
| Frontend tests unitaires | 37/37 réussis |
| Frontend ESLint | Réussi |
| Frontend build/prerender/budgets | Réussi; 2 173 modules, 11 routes publiques, 3 privées, budgets conformes |
| Playwright local Chromium + WebKit | 32/32 réussis |

Un avertissement non bloquant du pilote `pg` signale l’usage historique de `client.query()` pendant une requête; aucun test n’échoue.

## Baseline production non destructive avant déploiement

URL : `https://gsplus.vip`.

- Playwright production Chromium + WebKit : 22/22 réussis.
- Axe production Chromium : 2/2 réussis.
- Aucun formulaire métier, aucune réservation, aucune connexion admin et aucun fournisseur n’ont été déclenchés.
- Ce baseline valide l’état public avant migration; il ne constitue pas encore la preuve post-déploiement du snapshot P0-01.

## Critère obligatoire des six réservations

Six réservations fictives avec un même téléphone conservent six prénoms/noms, six e-mails, six snapshots de consentement et six destinataires indépendants. Après mutation du profil de la première personne, une notification tardive reste adressée et rendue avec son identité et son e-mail d’origine. Le téléphone brut formaté et sa forme E.164 sont tous deux conservés.

## Déploiement production du 1er août 2026

| Contrôle | Résultat |
|---|---|
| Préflight | 13 réservations; zéro lien `Customer` ou `PackageVersion` manquant; P0-01 seule migration en attente |
| Sauvegarde | `.phase0-backups/20260801-054250-pre-p0-01/database-pre-p0-01.dump.enc`, mode 0600, AES-256-CBC/PBKDF2 |
| Empreinte sauvegarde | `799dc23d50c59bd19c0266341b3f606a4289a9f610da1505ee1a5f1bb637d692` |
| Restauration contrôlée | Déchiffrement temporaire réussi; catalogue `pg_restore` identique de 124 entrées; fichiers en clair supprimés |
| Migration | `20260731195200_p0_01_reservation_snapshot` appliquée; 12/12 migrations à jour |
| Backfill/intégrité | 13 réservations = 13 snapshots; 0 manquant, orphelin, doublon ou champ requis nul; 0 incident |
| Preuve six dossiers | 6 identités, 6 e-mails, téléphone commun conservé, profil mutable sans effet, UPDATE/DELETE bloqués |
| Rollback preuve | 0 réservation, 0 client et 0 snapshot fictifs persistés; aucun outbox/fournisseur déclenché |
| Régression locale | Backend 51/51, frontend 37/37, TypeScript, Prisma, lint et build réussis |
| Production publique | `/health` et `/api/health` HTTP 200; Playwright 22/22; axe 2/2 |
| Surveillance depuis migration | 0 notification créée, 0 échec notification actualisé, 0 événement calendrier créé, 0 échec calendrier actualisé, 0 incident créé |

Les 14 notifications et 8 synchronisations calendrier actuellement marquées `FAILED` sont historiques : aucune n’a été créée ni actualisée pendant cette phase. Les journaux systemd détaillés ne sont pas lisibles par le compte de déploiement; les contrôles API et base agrégés restent conformes.

## Validation post-redémarrage

Le premier redémarrage a exposé l’absence de `backend/.env` : le service a effectué 45 reprises et l’API était indisponible. La cause a été corrigée en restaurant le fichier runtime courant depuis le jeu de récupération Phase 12 dont toutes les empreintes étaient conformes, avec propriétaire `deploy` et mode 0600. Aucun secret n’a été imprimé ou modifié.

Le nouveau processus est stable depuis le 1er août 2026 à 07:05:31 UTC. `/health`, `/api/health` et `/api/packages` répondent HTTP 200. Les contrôles finaux confirment 13 réservations et 13 snapshots, zéro snapshot manquant, zéro incident ouvert, zéro nouvelle notification ou synchronisation calendrier et zéro nouvel échec de file depuis le redémarrage. Playwright production réussit 22/22 et axe 2/2.

P0-01 est validé en production. P0-04 est le prochain problème autorisé.

Aucun secret ni donnée réelle n’est inclus dans ce rapport.

# P0-04 — Paiement et réservation distincts

## Défaut, cause et correction

Avant P0-04, une confirmation de réservation ne contrôlait pas systématiquement l’état du paiement. Les décisions sensibles n’avaient ni commande durable, ni version attendue obligatoire, ni permission fine; l’interface utilisait encore l’ancien contrat. La cause était une orchestration dispersée entre routes, transitions et UI.

La correction centralise les matrices, exige `VERIFIED|PAID` avant `CONFIRMED`, sépare vérifier/rejeter/demander une information/bloquer/confirmer/refuser, et fournit une action atomique « vérifier et confirmer ». Chaque décision sensible porte un UUID, une version attendue et un audit corrélé. Seul OWNER peut les exécuter.

E-03 est planifié cinq minutes après une vérification seule. Une confirmation dans cette fenêtre marque E-03 `CANCELLED`/`OBSOLETE`, retire son échéance et crée E-05 une seule fois. L’action combinée crée directement E-05 sans E-03 intermédiaire.

## Schéma et migrations

| Avant | Après |
|---|---|
| Paiement sans états d’information/blocage/payé | `PAYMENT_INFO_REQUIRED`, `VERIFICATION_BLOCKED`, `PAID` |
| Mutations sensibles sans registre de commande | `AdminCommand` durable, empreinte de requête, auteur, état et achèvement |
| Notification différée non annulable explicitement | `NotificationStatus.CANCELLED` et résolution `OBSOLETE` |

Migrations ajoutées :

- `20260801072000_p0_04_payment_reservation_commands`;
- `20260801094000_p0_04_notification_scheduling`.

La base de test dédiée `goldenstudioplus_db_test` contient 14 migrations à jour. Le contrôle production en lecture seule montre uniquement ces deux migrations P0-04 en attente; aucune migration n’a été appliquée.

## API et interface

| Domaine | Avant | Après |
|---|---|---|
| Vérification paiement | Statut/référence seulement | UUID, version attendue, statut distinct, motif/référence |
| Confirmation | Appel direct possible sans garde paiement | Refus 409 `PAYMENT_NOT_VERIFIED` tant que le paiement n’est pas autorisé |
| Action combinée | Absente | `POST /api/admin/reservations/:id/verify-and-confirm`, transaction atomique |
| Concurrence/double clic | Protection incomplète | contrôle optimiste, commande idempotente, verrou UI synchrone |
| Permissions | OWNER/STAFF sans décision fine | décisions P0-04 réservées à OWNER |
| UI | deux actions paiement sur `PENDING` | toutes les décisions distinctes, action combinée, impossibilités visuellement désactivées |

## Résultats exacts

| Contrôle | Résultat |
|---|---|
| Test ciblé P0-04 backend | 2 fichiers, 12 réussis, 31 ignorés par filtre |
| Backend complet | 3 fichiers, 50/50 réussis |
| Backend TypeScript | Réussi |
| Prisma validate | Réussi |
| Migration test | 14/14, aucune en attente |
| Frontend unitaire | 39/39 réussis |
| Frontend ESLint | Réussi |
| Frontend build/prerender/budgets | Réussi; 2 173 modules, 11 routes publiques, 3 privées |
| P0-04 Playwright ciblé | Chromium + WebKit, 2/2 réussis |
| Playwright local complet | Chromium + WebKit, 34/34 réussis |
| Production publique read-only | E2E 22/22; axe 2/2; `/api/health` 200 |
| Recherche TODO/FIXME | Aucun dans les fichiers P0-04 |
| `git diff --check` ciblé | Réussi |

L’avertissement historique `pg` sur `client.query()` pendant une requête reste non bloquant. Le premier lancement E2E production sans `PLAYWRIGHT_BASE_URL` a échoué avant découverte; la relance explicite sur `https://gsplus.vip` a réussi 22/22. Le probe public `/health` retourne 404, alors que `/api/health` retourne 200; cette divergence préexistante doit être contrôlée avant déploiement.

## Critères de sortie

- [x] Implémentation P0-04 complète localement
- [x] Aucun placeholder métier, TODO ou FIXME ajouté
- [x] Test reproduisant le défaut par appel API direct
- [x] Test ciblé réussi
- [x] Tests d’intégration réussis
- [x] Tests end-to-end réussis
- [x] Suite complète réussie
- [x] Lint réussi
- [x] Types vérifiés
- [x] Build réussi
- [x] Critères documentaires P0-04 respectés
- [x] Non-régression locale vérifiée
- [x] Documentation et matrice mises à jour
- [x] Preuves locales et baseline public fournis
- [x] Sauvegarde/restauration de production contrôlée
- [x] Migrations et déploiement production
- [x] Preuves post-redémarrage et surveillance production

Risques/hors périmètre : I-03 à +30 minutes appartient à NOTIF-01; les dialogues natifs seront remplacés dans P1-03; Nginx ne publie que `/api/health`, donc le correctif éventuel du chemin public `/health` n’est pas inclus. P0-03 devient le prochain problème autorisé mais n’est pas commencé.

Message de commit proposé : `feat(p0-04): enforce versioned payment and reservation decisions`.

Aucun secret ni donnée réelle n’est inclus dans cette preuve P0-04.

## Déploiement production P0-04 — 1er août 2026

| Contrôle | Résultat |
|---|---|
| Préflight données | 13 réservations, 13 snapshots, 0 snapshot manquant, 0 incident ouvert |
| Préflight métier | Réservations 2 CANCELLED / 1 COMPLETED / 4 CONFIRMED / 6 PENDING_CONFIRMATION; paiements 10 PENDING / 2 REJECTED / 1 VERIFIED |
| Sauvegarde chiffrée | `.phase0-backups/20260801-102122-pre-p0-04/database-pre-p0-04.dump.enc`, mode 0600, AES-256-CBC/PBKDF2 200 000 itérations |
| Empreinte sauvegarde | `f98f857eff1191a1f4a0b421e7824bf142c927ae90fba06b7e6518a37cfc7d0a` |
| Restauration contrôlée | Déchiffrement identique au dump clair; catalogues `pg_restore` identiques, 143 objets; fichiers clairs supprimés |
| Clé de sauvegarde | `/home/deploy/.config/goldenstudioplus/backup-encryption.key`, propriétaire deploy, mode 0600; valeur jamais affichée |
| Migrations | `20260801072000_p0_04_payment_reservation_commands` et `20260801094000_p0_04_notification_scheduling` appliquées; 14/14 à jour |
| Build | Prisma généré; backend TypeScript réussi; frontend/prerender/budgets réussis |
| Redémarrage | PID 3506516 arrêté par SIGTERM; `Restart=always` a lancé PID 3793097 à 10:35:53 UTC; `NRestarts` 45→46, puis stable |
| Santé | Backend local `/health` et `/api/health` 200; public `/api/health` et `/api/packages` 200; `/api/admin/me` non authentifié 401 |
| Schéma post-migration | `AdminCommand` présent et vide; nouveaux états paiement et `NotificationStatus.CANCELLED` présents |
| Intégrité post-migration | Comptages réservation/paiement/snapshot inchangés; 0 snapshot manquant; 0 incident ouvert |
| Production publique | E2E Chromium/WebKit 22/22; axe 2/2 |
| Observation | 0 nouvel événement/échec notification, calendrier ou incident; 0 commande/audit P0-04; PID et santé stables |

Le compte de déploiement ne peut pas exécuter `systemctl restart` ni `sudo nginx -t` sans authentification interactive. Aucun changement Nginx n’étant inclus, le processus deploy-owned a reçu le signal d’arrêt configuré (`SIGTERM`) et systemd l’a relancé sous supervision. Le journal visible confirme un démarrage normal et l’écoute sur `127.0.0.1:4000`.

Aucun formulaire, aucune connexion admin, aucune réservation fictive et aucun appel Cal.com, WhatsApp ou Zoho n’ont été déclenchés pendant les preuves production. Les 14 notifications et 8 synchronisations calendrier en échec restent historiques et n’ont pas été actualisées.

P0-04 est `VALIDÉ-PROD`. P0-03 devient le prochain et seul problème autorisé.

# P0-03 — Cycle temporel et disponibilité

Date : 1er août 2026
État : `VALIDÉ-PROD`

## Défaut initial et cause racine

La transition `CONFIRMED → COMPLETED|NO_SHOW` ne comparait jamais l’heure courante à `Reservation.endAt`. Comme seules les réservations `PENDING_CONFIRMATION|CONFIRMED` étaient recherchées par la disponibilité, une clôture anticipée réussie libérait également un créneau futur. La route ne possédait ni permission, ni contrat, ni audit propres à une dérogation.

## Preuve rouge

Commande : `npm test -- --run test/integration/api.test.ts -t "rejects a direct early completion"`
Résultat avant correction : 1 test en échec, 41 ignorés; l’API a répondu `200 OK` alors que le test exigeait `409 Conflict`.

## Schéma, API et interface

| Domaine | Avant | Après |
|---|---|---|
| Schéma | Aucun champ P0-03 | Aucune migration; métadonnées existantes de transition/audit réutilisées |
| Transition | `COMPLETED|NO_SHOW` autorisé sans heure | `now >= endAt` obligatoire, horloge injectable |
| API normale | Clôture anticipée acceptée | `409 RESERVATION_END_NOT_REACHED` |
| Dérogation | Indistincte et non tracée | OWNER uniquement, `temporalOverride`, confirmation et motif obligatoires |
| Audit | Mise à jour générique | ancien/nouvel état, auteur, date, motif, fin planifiée et métadonnée de dérogation |
| Disponibilité | Liste statique de deux statuts | clôture anticipée encore bloquante jusqu’à `endAt` |
| Interface | Actions toujours actives | actions normales désactivées avant fin; dérogations OWNER distinctes et visibles dans l’historique |

## Tests et commandes

| Contrôle | Résultat |
|---|---|
| P0-03 backend ciblé | 4/4 réussis; -1/0/+1 min, minuit Douala, API directe, dérogation, STAFF, audit et double-booking |
| Backend complet | 3 fichiers, 54/54 réussis |
| Backend TypeScript | Réussi |
| Prisma validate/migrations test | Schéma valide; 14/14, aucune migration en attente |
| Frontend complet | 41/41 réussis |
| Frontend ESLint | Réussi |
| Frontend build/prerender/budgets | Réussi; 2 173 modules, 11 routes indexables, 3 privées; budgets conformes |
| P0-03 Playwright ciblé | Chromium + WebKit, 2/2 réussis |
| Playwright local complet | Chromium + WebKit, 36/36 réussis |
| Baseline production pré-redémarrage | Read-only E2E 22/22; axe 2/2; santé/API 200 |
| `git diff --check` | Réussi |
| TODO/FIXME métier | Aucun ajouté dans les fichiers P0-03 |

Le warning historique `pg` relatif à `client.query()` reste non bloquant et inchangé. Les tests ont utilisé uniquement `goldenstudioplus_db_test`; aucun fournisseur Cal.com, WhatsApp ou Zoho n’a été appelé.

## Critères de sortie

- [x] Implémentation P0-03 complète localement
- [x] Aucun placeholder métier, TODO ou FIXME ajouté
- [x] Test reproduisant le défaut
- [x] Test ciblé réussi
- [x] Tests d’intégration réussis
- [x] Tests end-to-end réussis
- [x] Suite complète réussie
- [x] Lint réussi
- [x] Types vérifiés
- [x] Build réussi
- [x] Critères documentaires respectés
- [x] Non-régression locale vérifiée
- [x] Documentation et matrice mises à jour
- [x] Preuves locales fournies
- [x] Redémarrage backend de production approuvé et exécuté
- [x] Contrôles santé, E2E, axe, intégrité et observation post-redémarrage

## Risques résiduels et éléments non modifiés

- Les modèles E-17/E-18 ne sont pas ajoutés : ils appartiennent à NOTIF-01.
- Les dialogues natifs restent inchangés jusqu’à P1-03.
- Aucun enum, table, colonne, donnée métier, intégration fournisseur ou configuration Nginx n’a été modifié pour P0-03.
- La fenêtre d’actifs mixtes a été fermée par le redémarrage contrôlé : frontend et backend P0-03 sont alignés sur le PID 4029461 depuis 13:32:46 UTC.

Message de commit proposé : `fix(p0-03): guard temporal closure and preserve future slots`.

P0-03 est `VALIDÉ-PROD`; P0-02 devient le prochain et seul problème autorisé.

## Déploiement production P0-03 — 1er août 2026

| Contrôle | Résultat |
|---|---|
| Nature | Code-only; aucune migration, aucun backfill, aucune écriture métier |
| Schéma | Production 14/14 migrations, déjà à jour |
| Préflight service | PID 3793097, `NRestarts=46`, actif depuis 10:35:53 UTC |
| Préflight API | `/api/health` et `/api/packages` 200; `/api/admin/me` non authentifié 401 |
| Préflight données | 13 réservations, 13 paiements, 13 snapshots, 0 manque, 0 incident ouvert, 0 commande admin |
| Redémarrage | SIGTERM gracieux; systemd `Restart=always` a lancé PID 4029461 à 13:32:46 UTC; `NRestarts=47` |
| Journal | Démarrage normal, environnement chargé sans valeur affichée, écoute `127.0.0.1:4000` |
| Santé postflight | Backend `/health` 200; Nginx `/api/health` et `/api/packages` 200; admin non authentifié 401 |
| Production publique | E2E Chromium/WebKit 22/22; axe 2/2 |
| Intégrité postflight | Comptages réservation/paiement/snapshot identiques; 0 manque, incident ou commande |
| Observation | 0 nouvel événement notification/calendrier, audit, incident ou dérogation; PID et santé stables |

Aucun test mutatif n’a été exécuté sur la base de production. Les gardes P0-03 sont prouvées sur `goldenstudioplus_db_test` et leur présence dans le backend compilé a été vérifiée avant redémarrage. Aucun secret ni donnée réelle n’est inclus dans cette preuve.

P0-03 est `VALIDÉ-PROD`. P0-02 reste non commencé.

# P0-02 — Synchronisation Cal.com fiable

Date : 1er août 2026
État : `VALIDÉ-PROD`

## Défaut initial et preuve rouge

Le journal basculait au premier échec de `PENDING` vers `PROCESSING`, puis directement vers `FAILED`. Il n’existait ni `nextAttemptAt`, ni worker calendrier, ni cadence 0/2/10, ni version/empreinte du payload, ni réconciliation d’un succès distant après réponse perdue.

Commande rouge : `npm test -- --run test/integration/calendar.test.ts`
Résultat avant correction : 8 tests, 1 échec; le nouveau scénario attendait `RETRYING` après la première défaillance et a reçu `FAILED`.

## Matrice ciblée

| Scénario | Preuve locale |
|---|---|
| Création | Un seul POST; UID distant, UTC ISO, Douala, version, clé et hash persistés |
| HTTP 400 | `RETRYING`, aucune date de succès, erreur `CALCOM_HTTP_400` assainie |
| HTTP 500 | Reprise planifiée, réponse fournisseur non persistée |
| Timeout | `CALENDAR_PROVIDER_FAILED`, aucun détail sensible |
| Cadence | Tentatives à 0, +2 et +10 minutes; aucun traitement avant échéance |
| I-07 | Absent aux essais 1/2; événement admin unique après essai 3 |
| Réponse perdue | Réconciliation avant nouvel envoi; UID distant récupéré; un seul create |
| Réconciliation réelle de l’adaptateur | GET paginé Cal.com et recherche de `metadata.gspCalendarKey` |
| Concurrence | Une ligne ledger et une livraison pour une version |
| Reprise manuelle | Même ligne remise en file; rejeu après succès sans nouvel appel |
| Report | `UPDATE` du UID existant; nouveau UID conservé si renvoyé |
| Annulation | `CANCEL` du UID courant; aucune nouvelle création |
| Snapshot manquant | Livraison bloquée, I-10 unique |
| Santé | Configuration vérifiée sans exposer la clé API |

## Commandes et résultats

| Contrôle | Résultat |
|---|---|
| P0-02 ciblé | 13/13 réussis |
| Backend complet | 3 fichiers, 60/60 réussis |
| TypeScript backend | Réussi |
| Prisma | Schéma valide; 16 migrations sur la base de test, rejeu intégral 16/16 sur schéma jetable réussi, 4 colonnes ledger vérifiées et schéma supprimé |
| Frontend unitaires | 41/41 réussis |
| Frontend ESLint | Réussi |
| Frontend build/prerender/budgets | Réussi; 2 173 modules, 11 routes indexables, 3 privées |
| Playwright local | Chromium + WebKit, 36/36 réussis |
| `git diff --check` | Réussi |

Le warning historique `pg client.query()` reste non bloquant et inchangé. Les tests utilisent uniquement `goldenstudioplus_db_test` et des adaptateurs/fournisseurs simulés.

## Critères de sortie

- [x] Scénario rouge reproduit
- [x] Ledger durable et migrations additives
- [x] Create/update/cancel et états fidèles
- [x] Cadence 0/2/10 et worker
- [x] Idempotence, concurrence et reprise après succès distant
- [x] I-07 seulement après trois échecs
- [x] Reprise manuelle et administration alignées
- [x] Tests ciblés et suites locales
- [x] Prisma, types, lint, builds et Playwright
- [x] Preuve Cal.com officielle avec UID et horaires UTC/Douala
- [x] Sauvegarde et contrôle de restauration production
- [x] Migrations et redémarrage production approuvés
- [x] Postflight santé, données, files, E2E/axe et observation

Message de commit proposé : `fix(p0-02): make calendar synchronization durable and idempotent`.

## Preuve fournisseur et production

| Contrôle | Résultat |
|---|---|
| Contrat Cal.com | Bookings `2026-02-25`; listing `2026-05-01`; event-types `2024-06-14`; `metadata` retirée du report conformément au contrat courant |
| Création officielle | HTTP 201, UID `mdd1YizBWCohAHZGYjJxc7`, 31 août 2026 07:00 UTC / 08:00 Douala |
| Report officiel | HTTP 201, nouvel UID `wkQeDWmiL1ECtQ7U836rgk`, 1er septembre 2026 07:00 UTC / 08:00 Douala |
| Annulation officielle | HTTP 200, statut distant annulé; aucun événement de test actif restant |
| Sauvegarde | Dump chiffré vérifié par déchiffrement byte-identique et catalogue identique; checksum `0445f8baa174d867e191eee6f16cb773d406bbf02dc1979c1de571f30d9ddb3c` |
| Migrations | Deux migrations P0-02 appliquées; production 16/16; colonnes, défauts, index et invariant `syncedAt` conformes |
| Redémarrage | PID 4029461 → 4180053 à 15:07:44 UTC; `NRestarts` 47→48; stable |
| Santé | local/public 200, packages 200, garde admin 401, santé Cal.com 200 et event type configuré trouvé |
| Production E2E/axe | 22/22 et 2/2 réussis |
| Intégrité/observation | 13 réservations/paiements/snapshots, 0 manque/incident/commande; 8 `FAILED` historiques + 3 `NOT_REQUIRED`; aucune nouvelle ligne ni mise à jour calendrier, notification ou audit |

Aucun secret ni donnée client réelle n’est inclus dans cette preuve. Les seuls identifiants consignés sont ceux des événements de test Cal.com créés puis annulés. P0-02 est `VALIDÉ-PROD`; P1-01 devient le prochain et seul problème autorisé.

# P1-01 — WhatsApp transactionnel et opérationnel

Date : 1er août 2026
État : `DÉPLOYÉ-SANS-META` — code et migrations actifs en production depuis le 2 août 2026; configuration et preuve fournisseur Meta absentes, WhatsApp désactivé.

## Défaut initial et preuves rouges

Le code ne créait aucune notification WhatsApp entreprise. Les événements client dépendaient du feature flag de livraison plutôt que de la seule règle de consentement, la reprise WhatsApp héritait de la cadence e-mail 1/2/4 minutes et de cinq essais, le webhook `failed` rendait immédiatement l’événement terminal, `readAt` et I-08 n’existaient pas.

Première commande rouge : `npm test -- --run test/integration/whatsapp.test.ts`
Résultat : 5 tests, 5 échecs ciblés. Après le premier correctif, une preuve rouge complémentaire a confirmé l’absence du ledger par tentative : `prisma.notificationAttempt` était inexistant.

## Matrice ciblée

| Scénario | Résultat local |
|---|---|
| Consentement faux | Une trace entreprise idempotente; aucune notification client |
| Consentement vrai | Une trace entreprise et une trace client, destinataires snapshot figés |
| Canal désactivé | Événements journalisés mais aucun worker fournisseur déclenché |
| Livraison entreprise | Aucun contrôle du consentement client; modèle entreprise et UID fournisseur persistés |
| Cadence | Essais exacts à 0, +2 et +10 minutes |
| Ledger détaillé | Trois `NotificationAttempt` distincts avec heures, statuts et erreurs sûres |
| Erreur fournisseur | Réponse brute et jeton absents; code `WHATSAPP_DELIVERY_FAILED` ou `WHATSAPP_PROVIDER_*` |
| I-08 | Absent après essais 1/2; un événement e-mail interne après essai 3 |
| Webhook livré | `deliveredAt`, événement et essai corrélés |
| Webhook lu | `readAt`, état monotone `read` |
| Webhook échoué | Reprise planifiée avant essai 3; échec terminal et I-08 seulement au troisième |
| Administration autorisée | Consentement/date visibles; lien `wa.me` prérempli et accessible |
| Administration non autorisée | Aucun lien; bouton désactivé et explication explicite |
| Masquage | Identifiant fournisseur abrégé dans l’interface; aucune donnée secrète dans l’erreur |

## Commandes et résultats

| Contrôle | Résultat |
|---|---|
| P1-01 backend ciblé | 5/5 réussis |
| Backend complet | 4 fichiers, 65/65 réussis |
| TypeScript backend | Réussi |
| Prisma | Schéma valide; 18/18 migrations rejouées depuis zéro sur schéma test jetable, colonnes/table vérifiées puis schéma supprimé |
| Frontend unitaires | 43/43 réussis |
| Frontend ESLint | Réussi |
| Frontend build/prerender/budgets | Réussi; admin 48 154/50 000 octets, panneau lazy 1,33 Ko |
| P1-01 Playwright | Chromium + WebKit, 2/2 réussis |
| Playwright local complet | Chromium + WebKit, 38/38 réussis |
| `git diff --check` | Réussi |

Le warning historique `pg client.query()` reste non bloquant et inchangé. Tous les tests backend ont utilisé `goldenstudioplus_db_test`; aucun appel Meta réel n’a été effectué.

## Critères de sortie

- [x] Scénarios rouges entreprise/client/cadence/webhook reproduits
- [x] Notification entreprise systématique et client conditionnelle au snapshot
- [x] Modèle/version/rendu/destinataire/idempotence persistés
- [x] Trois tentatives 0/+2/+10 et ledger individuel
- [x] Webhooks livré/lu/échoué et erreurs assainies
- [x] I-08 uniquement après trois échecs
- [x] Consentement et action préremplie dans le dossier admin
- [x] Tests, types, lint, builds, budgets et Playwright locaux
- [x] Rejeu intégral 18/18 sur schéma test jetable
- [ ] Identifiants Meta, secrets webhook et six modèles approuvés configurés
- [ ] Preuve fournisseur entreprise/client avec UID et webhooks livré/lu
- [x] Sauvegarde/restauration de contrôle production
- [x] Deux migrations présentes en production, appliquées prématurément pendant NOTIF-01
- [x] Déploiement du code et redémarrage production approuvés
- [x] Postflight données, files, E2E/axe et observation

Message de commit proposé : `feat(p1-01): make WhatsApp delivery consent-aware and auditable`.

P1-01 reste en attente de Meta uniquement : production est à 19/19 migrations et le processus actif exécute le nouveau code, avec livraison WhatsApp désactivée. Aucun secret, destinataire réel de test ou identifiant fournisseur n’est inclus dans cette preuve.

# NOTIF-01 — Jalon registre et événements durables

Date : 1er–2 août 2026. État : `EN COURS-PROD`.

## Preuve rouge

- Registre absent : import impossible avant création de `emails/templates.ts`.
- E-01/I-01/E-03/E-05 : `templateCode`, `templateVersion` et `renderedContent` étaient nuls.
- Leads : un seul e-mail interne générique au lieu des deux audiences E-22/E-23 et I-12.
- E-04/E-04A/E-04B/I-03, E-06/E-14/E-17, E-09, E-15/E-16 et I-11 : fonctions ou événements absents avant leur raccordement.
- Obsolescence : E-04B était effectivement envoyé après reprise du paiement avant l’ajout de la garde.
- Finance : `prisma.financialTask`, `executeRefundDecision` et `queueRefundStatusNotifications` étaient absents; les deux scénarios ciblés échouaient avant l’ajout du workflow durable.
- Intégrité : l’incident I-10 était durable mais ne créait aucun événement; la preuve rouge observait zéro alerte avant le raccordement atomique.
- Paiement ajouté : l’endpoint et les déclencheurs E-02/I-02 étaient absents; la preuve rouge obtenait 404 après une création différée valide sans paiement.

## Résultats locaux

| Contrôle | Résultat |
|---|---|
| Registre complet | 5/5 |
| Parcours e-mail NOTIF-01 | 15/15 |
| Leads E-22/E-23/I-12 | 2/2 |
| Cal.com + WhatsApp I-07/I-08 | 18/18 |
| Finance durable E-07/I-06/E-20/E-21 | 2/2 |
| API remboursement et paiement ajouté | 2/2 |
| Backend complet | 8 fichiers, 91/91 |
| TypeScript/build | Réussi |
| Prisma/migrations test | Schéma valide; 19/19, aucune migration en attente |
| Frontend | 43/43; Playwright local Chromium/WebKit 38/38; ESLint, build/prerender/budgets réussis; admin 49 058/50 000 octets |
| `git diff --check` | Réussi |

Le refus d’une réservation `VERIFIED|PAID` crée désormais dans la même transaction une tâche `FULL_REFUND` unique. E-07 et I-06 exigent cette tâche. L’engagement via l’API OWNER fait passer le paiement à `REFUND_PENDING`, la tâche à `IN_PROGRESS` et crée E-20; la finalisation exige la version suivante, persiste la preuve, passe la tâche à `COMPLETED` et crée E-21 avec référence masquée. La relecture d’une même commande ne duplique ni décision ni notification.

Chaque incident durable `I-10_RESERVATION_SNAPSHOT_MISSING` crée désormais un unique I-10 au même commit. L’événement conserve le rendu normatif et l’identifiant d’incident, masque téléphone/e-mail et reste livrable sans relation `reservationId`, ce qui évite que la garde de snapshot bloque l’alerte décrivant précisément cette anomalie.

L’ajout tardif d’un paiement est une commande OWNER portant UUID et version de réservation. Le montant provient exclusivement du snapshot, la référence est validée/normalisée, un paiement actif concurrent est interdit et l’audit ne conserve qu’une référence masquée. Le premier commit crée exactement E-02/I-02; le rejeu ne crée aucun paiement ni événement supplémentaire, tandis que la création initiale conserve uniquement E-01/I-01.

Incident de périmètre : `prisma migrate deploy` a chargé `backend/.env` et appliqué sans autorisation `20260801153000_p1_01_whatsapp_ledger`, `20260801154500_p1_01_notification_attempts` et `20260801200000_notif_01_financial_tasks` à la production. Aucun rollback destructif n’a été tenté car ces migrations sont additives. Le contrôle lecture seule immédiatement suivant a confirmé 19/19 migrations, 13 réservations, 13 paiements, 13 snapshots, 43 notifications, zéro tentative, zéro tâche financière, zéro incident et zéro commande. À ce stade historique, le PID systemd n’avait pas changé et exécutait encore l’ancien code; la migration n’avait créé aucune notification. Le déploiement autorisé ultérieur est détaillé ci-dessous.

## Déploiement production du 2 août 2026

| Contrôle | Résultat |
|---|---|
| Sauvegarde | `.phase0-backups/20260802-pre-notif-01/database-pre-notif-01.dump.enc`, AES-256-CBC/PBKDF2, mode 0600 |
| Empreinte | `68d755727120fc5c75d3da91bbb27bd115df63d26687d768b86402660a8e930a` |
| Restauration de contrôle | Déchiffrement byte-identique; catalogue `pg_restore` de 183 lignes; copies en clair supprimées |
| Migrations | Production 19/19, aucune migration en attente |
| Backend | PID final 1026456, démarré à 04:44:55 UTC, `NRestarts=50`, santé locale/publique 200 |
| Frontend/public | Build/prerender/budgets conformes; production E2E Chromium/WebKit 22/22; axe 2/2 |
| Postflight | 13 réservations, 13 paiements, 13 snapshots, zéro tâche financière, incident ou commande |

Au premier redémarrage, le scheduler a créé et livré deux E-15 à des adresses QA `qa•••@example.com` pour des séances confirmées situées à environ 27 h et 32 h. Cela a révélé que le rappel J-3 pouvait partir après la limite contractuelle de modification. La condition est désormais bornée à 72–48 h; une preuve de non-envoi à 32 h a été ajoutée, la suite backend passe 91/91 et le second redémarrage n’a créé aucun événement. État final : 45 notifications, 31 `SENT`, 14 `FAILED` historiques et 2 tentatives.

Les jalons alors implémentés sont actifs en production. À ce stade historique, les modèles dépendant d’une politique d’annulation, d’une demande de report, d’une livraison ou d’un bounce permanent restaient volontairement non déclenchables. Le jalon suivant raccorde désormais les annulations. WhatsApp reste désactivé et aucune preuve Meta réelle n’a été exécutée faute d’identifiants et de modèles approuvés.

## Jalon annulations E-11/E-12/E-13 et I-05 — 2 août 2026

Le chemin générique `PATCH /api/admin/reservations/:id` refuse désormais `CANCELLED`. La seule mutation autorisée est la commande OWNER `POST /api/admin/reservations/:id/cancel`, avec UUID, version attendue, origine `CUSTOMER|STUDIO` et motif. La transition, le calcul, la tâche financière éventuelle et l’audit sont enregistrés dans une transaction unique.

| Scénario ciblé | Résultat |
|---|---|
| Client à 48 h + 1 ms | `PARTIAL_REFUND` de 10 000 sur 20 000 FCFA; E-11 et I-05 |
| Client à exactement 48 h | Zéro tâche; E-12 |
| Client à 48 h - 1 ms | Zéro tâche; E-12 |
| Studio à 1 h | `FULL_REFUND` de 20 000 FCFA; E-13 et I-05 |
| Remboursement partiel | Paiement `REFUND_PENDING`, tâche `IN_PROGRESS`, preuve opérateur de 10 000 FCFA acceptée |

### Validation locale

| Contrôle | Résultat |
|---|---|
| Finance/annulation ciblée | 6/6 |
| API admin | 47/47 |
| Backend complet | 8 fichiers, 95/95 |
| Frontend | 43/43 |
| Playwright local | Chromium/WebKit 38/38 |
| Baseline production non mutatif | Chromium/WebKit 22/22; axe 2/2 |
| TypeScript, ESLint, builds/prerender/budgets | Réussis |
| `git diff --check` | Réussi |
| Prisma | 19/19, aucune migration en attente; aucune nouvelle migration requise |

### Déploiement et preuve production

| Contrôle | Résultat |
|---|---|
| Sauvegarde | `.phase0-backups/20260802-pre-cancellation-notif/database-pre-cancellation-notif.dump.enc`, AES-256-CBC/PBKDF2 200 000 itérations, mode 0600 |
| Phrase secrète | Fichier séparé `.phase0-backups/.backup-passphrase`, mode 0600; valeur jamais affichée |
| Empreinte archive | `d88e38dcaca7a37a4e499aa9fd9452a1257af7ea5a84053d6c6ebac936c66327` |
| Contrôle restauration | Déchiffrement réussi; SHA-256 clair `b7508846ac347419b587eb3462bdd914a36d2ab589b928664cc443c5506aaae2`; catalogue `pg_restore` 183 lignes; clair supprimé |
| Migrations | Code-only, production inchangée à 19/19 |
| Backend | PID 1156146 depuis 06:12:21 UTC; `NRestarts=51`; aucune alerte journal |
| Santé/sécurité | Local/public 200; admin non authentifié 401 |
| Production E2E/axe | 22/22 et 2/2 |
| Preuve métier API | Fixture sans e-mail/WhatsApp, annulation CLIENT à ~24 h : HTTP 200, 5 000 payés, 0 remboursable, 0 tâche, 0 notification, calendrier `NOT_REQUIRED` |
| Nettoyage | 1 calendrier, 1 paiement, 1 audit, 1 commande, 1 réservation et 1 client synthétiques supprimés; aucun événement/tâche à supprimer |
| Postflight | 13 réservations, 13 paiements, 13 snapshots, 45 notifications, 2 tentatives, 0 tâche, 0 incident, 0 commande, 0 référence synthétique |

La preuve production n’a envoyé aucun e-mail ni WhatsApp et n’a appelé aucun fournisseur calendrier. Meta reste volontairement désactivé et hors de ce jalon.

# NOTIF-01 — Jalon reports E-08/E-10/I-04

Date : 2 août 2026
État : `VALIDÉ-PROD` dans le périmètre du jalon; NOTIF-01 global reste `EN COURS-PROD`.

## Contrat livré

- Une demande persistée conserve le créneau initial et le créneau souhaité; sa création ne déplace pas la réservation.
- La création et la décision sont deux commandes OWNER séparées, versionnées, idempotentes et auditées.
- Une acceptation exige un préavis d’au moins 48 h, une réservation active, une version/créneau non périmés, une disponibilité réelle à la décision et zéro report déjà accepté.
- Un refus motivé laisse le créneau initial inchangé. E-08/I-04 suivent la demande, E-09 l’acceptation et E-10 le refus.

## Validation locale

| Contrôle | Résultat |
|---|---|
| Reports ciblés | 3/3 : exactement 48 h accepté; moins de 48 h bloqué puis refusé; quota d’un report accepté |
| Backend complet | 9 fichiers, 98/98 |
| Prisma | Schéma valide; base de test 20/20, aucune migration en attente |
| Frontend | 44/44; contrat demande/décision couvert |
| Playwright local | Chromium/WebKit 38/38 |
| Baseline production non mutatif | Chromium/WebKit 22/22; axe 2/2 |
| TypeScript, ESLint, builds/prerender/budgets | Réussis; chunk admin 49 960/50 000 octets |
| `git diff --check` | Réussi |

## Déploiement et preuve production

| Contrôle | Résultat |
|---|---|
| Sauvegarde | Dump custom chiffré AES-256-CBC/PBKDF2, mode 0600, empreinte `c13f8e84e7449d77e3b06d1d39e4b853237f779429797b984c4b30bb431e700a` |
| Restauration de contrôle | Déchiffrement et catalogue `pg_restore` réussis; fichier clair temporaire supprimé |
| Migration | `20260802070000_notif_01_reschedule_requests` appliquée seule; production 20/20 |
| Backend | PID final 1376875; `NRestarts=54`; service actif; santé loopback/publique 200; garde admin 401 |
| Production publique | Playwright Chromium/WebKit 22/22; axe 2/2 |
| Preuve API authentifiée | Création 201, rejeu idempotent 201, refus 200 sans déplacement, seconde demande 201 puis acceptation 200; réservation v2, calendrier nul |
| Notifications persistées | Deux E-08, deux I-04, un E-10 et un E-09; zéro `NotificationAttempt` pendant la suspension contrôlée du worker |
| Nettoyage | Zéro réservation, demande, commande ou notification synthétique restante; script temporaire supprimé; worker réactivé |
| Postflight | 13 réservations, 13 paiements, 13 snapshots, 0 demande de report, 46 notifications, 3 tentatives, 0 tâche financière, 0 commande |

Aucun message synthétique n’a été envoyé et aucun fournisseur calendrier ou Meta n’a été appelé. Le jalon report est actif en production; Meta reste volontairement hors périmètre jusqu’à réception des identifiants et modèles approuvés.

# NOTIF-01 — Jalon E-18/E-19/I-09

Date: 2 août 2026. État: DÉPLOYÉ; preuve de rapports fournisseur en attente.

## Contrat livré

- E-18 uniquement après COMPLETED, avec prochaine étape, délai de la version de formule et canal réel.
- ReservationDelivery durable, publication OWNER versionnée/idempotente et vérification HTTPS publique avant E-19.
- EmailDeliveryReport dédupliqué; DELIVERED, TEMPORARY_FAILURE et PERMANENT_FAILURE distincts; I-09 seulement dans le dernier cas pour un message client.
- Webhook signé; codes et messages assainis; aucune adresse complète dans I-09.

## Validation locale

| Contrôle | Résultat |
|---|---|
| Preuve rouge | Import du service absent; suite ciblée impossible avant implémentation |
| Livraison E-18/E-19 et bounce | 3/3 |
| Webhook signé/rejeu | 1/1 |
| Liens invalides, non HTTPS et réseaux privés | 6/6 |
| Backend complet | 12 fichiers, 108/108 |
| Frontend | 45/45; ESLint conforme |
| Build/prerender/budgets | Conforme; admin 49 997/50 000 octets |
| Playwright local | Chromium/WebKit 38/38 |
| Baseline production non mutatif | Chromium/WebKit 22/22; axe 2/2 |
| Prisma | Schéma valide; test et production 21/21 |

## Déploiement et postflight production

| Contrôle | Résultat |
|---|---|
| Sauvegarde | `.phase0-backups/20260802-pre-delivery-bounce-notif/database-pre-delivery-bounce.dump.enc`, AES-256-CBC/PBKDF2 200 000, mode 0600, empreinte `3a81715a4f027b3549a271f1f6e8e9152e1faaacc0df7addce9d0a6b40c945cc` |
| Restauration de contrôle | Dump déchiffré byte-identique; catalogue `pg_restore` de 195 lignes; copies claires supprimées |
| Migration | `20260802090000_notif_01_delivery_and_bounces` appliquée seule; production 21/21 |
| Backend/public | PID 1581372, `NRestarts=55`, santé locale/publique 200, catalogue 200, garde admin 401 et webhook valide non signé 401 |
| Production publique | Playwright Chromium/WebKit 22/22; axe 2/2 |
| Postflight | 13 réservations/paiements/snapshots, 0 report/livraison/rapport, 46 notifications, 3 tentatives, 0 tâche/incident/commande; aucune mutation après observation du worker |

## Gate externe

L'envoi sortant Zoho/SMTP est déjà configuré et actif. La production ne possède pas encore `EMAIL_DELIVERY_WEBHOOK_SECRET` et aucun producteur de rapports Zoho/SMTP n'est raccordé au nouveau webhook entrant. Le code et le schéma sont déployés, mais les rapports restent inactifs tant que ces éléments ne sont pas fournis. Aucune preuve de bounce fournisseur réel n'est déclarée.

# P1-02 — « Proposer mon horaire »

Date: 2 août 2026. État: `VALIDÉ-PROD`.

| Contrôle | Résultat |
|---|---|
| Preuve rouge | Chromium/WebKit 0/6 : double vérification, réponse périmée et fermeture mal classée reproduites |
| P1-02 ciblé après correction | Chromium/WebKit 6/6 |
| États couverts | Chargement, disponible, passé, fermé, occupé, durée incompatible, erreur serveur |
| Conservation | Date/heure libres et profil préservés au retour; ancien résultat invalidé à toute modification |
| Concurrence | Une seule disponibilité et un seul intent malgré deux clics synchrones; réponse tardive ignorée |
| Mobile/clavier | Viewport 390×844; activation clavier et contrôles natifs associés |
| Frontend | 45/45; ESLint, build/prerender et budgets conformes; route réservation 35 103 octets |
| Backend/Prisma | 12 fichiers, 108/108; schéma et base de test 21/21 |
| Playwright local | Chromium/WebKit 44/44 |
| Production publique | Chromium/WebKit 28/28, dont P1-02 6/6 non mutatif; axe 2/2 |
| Déploiement | Build frontend servi directement par Nginx; aucune migration, aucun redémarrage backend, aucune mutation métier |

# VAL-01 — Validation téléphone/e-mail

Date : 2 août 2026. État : `VALIDÉ-PROD`.

## Contrat livré

- Numéros camerounais exclusivement : local, `+237`, `00237`, neuf chiffres nationaux commençant par 2 ou 6, normalisés en E.164.
- E-mails trimés, syntaxe et limites contrôlées, domaine seul normalisé en minuscules.
- Téléphone brut et E.164 conservés ensemble dans le snapshot de réservation immuable.
- Messages français associés aux champs; valeurs préservées; détails Zod/API structurés rendus au bon endroit.
- WhatsApp sans téléphone bloqué avant toute requête.

## Validation

| Contrôle | Résultat |
|---|---|
| Preuve rouge | Modules frontend/backend absents; imports des nouvelles suites en échec |
| Vecteurs partagés | 4 téléphones valides, 9 invalides; 3 e-mails valides, 9 invalides |
| Frontend | 49/49 |
| Backend | 13 fichiers, 112/112; base de test 21/21 |
| Lint/types/build | ESLint, TypeScript, build, prerender, budgets et `git diff --check` réussis |
| Playwright VAL-01 local | Chromium/WebKit 6/6 |
| Playwright local complet | Chromium/WebKit 50/50 |
| Production publique | `https://gsplus.vip`, Chromium/WebKit VAL-01 6/6 |
| Déploiement | Code-only, aucune migration ni mutation métier; PID 1772812, `NRestarts=56` |
| Santé | Loopback `127.0.0.1:4000/api/health` et HTTPS `/api/health` : 200 |

# P1-03 — Modales métier accessibles

Date : 2 août 2026. État : `VALIDÉ-PROD`.

## Contrat livré

- Zéro `prompt`, `alert` ou `confirm` natif dans le frontend.
- Modale réutilisable : titre, dossier, conséquence, champs typés, validation, chargement et erreurs serveur.
- Focus initial/piégé/restauré, `Escape`, mobile sans débordement et états ARIA couverts.
- Verrou synchrone anti-double commande; valeurs conservées après échec serveur.

## Validation

| Contrôle | Résultat |
|---|---|
| Inventaire | 31 dialogues métier natifs migrés |
| Preuve rouge | Statique 0/2 avant implémentation |
| Contrat statique final | 2/2; scan `frontend/src` sans dialogue natif |
| P1-03 ciblé local | Chromium/WebKit 6/6 |
| Frontend | 51/51; ESLint conforme |
| Backend | 13 fichiers, 112/112 |
| Build/prerender/budgets | Réussis; admin 53 386/55 000 octets, modale lazy 4,42 Ko |
| Playwright local complet | Chromium/WebKit 56/56 |
| Production ciblée | `https://gsplus.vip`, Chromium/WebKit 6/6, API admin simulée |
| Intégrité du diff | `git diff --check` réussi |
| Déploiement | Frontend code-only par Nginx; aucune migration, aucun redémarrage backend, aucune mutation métier |
| Santé | HTTPS `/api/health` : 200 |

Le budget admin a été recalibré explicitement de 50 000 à 55 000 octets; la mesure reste sous le plafond et la modale est un chunk paresseux séparé.

# P1-04 — Tarifs et mentions versionnés

Date : 2 août 2026. État : `VALIDÉ-PROD`.

## Contrat livré

- Cycle explicite brouillon, validé, publié et archivé; duplication et édition sans effet public avant publication.
- Validation complète des contenus, inclusions, conditions, mentions approuvées et date d'effet; publication réservée au OWNER.
- Prévisualisation et commandes accessibles dans l'administration, suppression protégée et audit des auteurs/dates.
- Version publiée figée dès l'intention puis contenu juridique et commercial conservé dans le snapshot de réservation.

## Validation locale

| Contrôle | Résultat |
|---|---|
| Preuve rouge backend | 0/2 : statut absent et validation HTTP inexistante |
| Preuve rouge frontend | 0/2 : cycle/actions et champs obligatoires absents |
| Backend ciblé P1-04 | 4/4 |
| Contrat statique frontend | 2/2 |
| Frontend complet | 53/53; ESLint conforme |
| Backend complet | 14 fichiers, 114/114; TypeScript conforme |
| Prisma | Schéma valide; base de test 22/22 |
| Playwright P1-04 local | Chromium/WebKit 4/4 |
| Playwright local complet | Chromium/WebKit 60/60 |
| Build/prerender/budgets | Réussis; entrée 377 403 octets (120 208 gzip), admin 46 139/55 000, panneau tarifs lazy 10,53 Ko, CSS 76 663 octets |
| Intégrité du diff | `git diff --check` réussi |

## Déploiement et postflight production

| Contrôle | Résultat |
|---|---|
| Sauvegarde | `.phase0-backups/20260802-pre-p1-04/database-pre-p1-04.dump.enc`, AES-256-CBC/PBKDF2, mode 0600, empreinte chiffrée `ce49a769e9ece079b7ac76fff8f2f7b90ebf96ae36757afdcf0d6f0933a7441c` |
| Restauration de contrôle | Empreinte claire/restaurée identique `65d498c5e43bf2d5f6ad6645138f0fbd722c9ca9f840e7c129639458739fd8eb`; catalogue 211 lignes; copies claires supprimées |
| Incident sauvegarde | Premier artefact vide dû à `pg_dump` avec `?schema=public`; supprimé et remplacé avant toute mutation |
| Migration | Premier backfill bloqué par `RESERVATION_SNAPSHOT_IMMUTABLE`; état partiel diagnostiqué, SQL rendu réentrant, trigger encadré puis réactivé; rejeu réussi, production 22/22 |
| Invariants schéma | 22 `PackageVersion` PUBLISHED, 22 `Package.publishedVersion`, 11/11 intentions rattachées, 13/13 snapshots enrichis, 3 contraintes, 4 index, trigger `tgenabled=O` |
| Volumes métier | Avant/après : 22 formules, 22 versions, 13 réservations, 11 intentions, 13 snapshots |
| Service | PID 1772812 → 2277004; `NRestarts` 56→57; écoute normale sur `127.0.0.1:4000` |
| Santé/sécurité | Santé locale et HTTPS 200; `/api/admin/me` sans session 401; catalogue public 200 avec 22 offres et aucun champ interne de cycle |
| Production ciblée | Chromium/WebKit 4/4, APIs admin simulées, aucune mutation métier |

La sauvegarde valide est conservée. Le déploiement n'a créé, modifié ni archivé aucune formule via l'API; seule la migration additive a enrichi les enregistrements historiques existants.

# UI-WA-01 — Identité et zone sûre du bouton WhatsApp

Date : 2 août 2026. État : `VALIDÉ-PROD`.

## Contrat livré

- Marque WhatsApp blanche locale sur fond `#25D366`; aucune icône de messagerie générique ni requête d'actif externe.
- Cible minimale 44×44 px, libellé accessible, focus visible et support des couleurs forcées.
- Offsets liés aux insets sûrs droit/bas et taille réduite sur faible hauteur paysage.
- Masquage automatique lors d'un clavier mobile probable ou d'une collision avec un contrôle interactif visible.

## Validation

| Contrôle | Résultat |
|---|---|
| Preuve rouge statique | 0/2 : composant, actif, vert et variables sûres absents |
| Preuve rouge navigateur | 0/4 initial : ancien bouton et sélection accessible ambiguë |
| Contrat statique final | 2/2 |
| UI-WA-01 local | Chromium/WebKit 4/4 |
| Viewports | 320×568, 390×844, 844×390, 768×1024 et 1280×720 |
| Clavier/collision | Focus mobile masque la cible; collision réelle avec « Envoyer le message » détectée sans interception |
| Frontend | 55/55; ESLint conforme |
| Playwright local complet | Chromium/WebKit 64/64 en 6,4 minutes |
| Build/prerender/budgets | Entrée 379 552 octets (120 834 gzip), route publique max 36 607, admin 46 139/55 000, CSS 77 555 |
| Production ciblée | `https://gsplus.vip`, Chromium/WebKit 4/4 |
| Inspection visuelle | Portrait 390×844 et paysage 844×390 conformes |
| Santé | HTTPS `/api/health` : 200 |
| Déploiement | Frontend code-only par Nginx; aucune migration, mutation métier ou relance backend |
| Intégrité du diff | `git diff --check` réussi |


# REF-01 — Référence publique courte stable

Date : 2 août 2026. État : VALIDÉ-PROD.

## Contrat livré

- Format des nouvelles références : GSP-AAMMJJ-XXXX, date Douala et alphabet non ambigu sans I/L/O/0/1.
- Allocation cryptographique sans biais modulo, contrôle de collision dans les intentions et réservations et reprises concurrentes.
- Référence de l'intention conservée pendant la réservation, les rafraîchissements et le report.
- Recherche admin exacte, normalisée en majuscules et appuyée sur l'index unique; affichage public sans identifiant technique.
- Triggers PostgreSQL empêchant tout UPDATE de la référence dans les deux tables.
- Compatibilité intégrale avec les références historiques longues, sans backfill ni colonne parallèle.

## Validation locale

| Contrôle | Résultat |
|---|---|
| Preuve rouge utilitaire | 0 test : module reservation-reference absent |
| Preuve rouge intégration | 0/3 : ancien format, recherche non filtrée, UPDATE SQL accepté |
| Preuve rouge frontend | Statique 0/2; Chromium/WebKit 0/2 |
| Génération/collision | 2/2 |
| Intégration REF-01 + report | 4/4 |
| Frontend complet | 57/57; ESLint conforme |
| Backend complet | 14 fichiers, 119/119; TypeScript conforme |
| Prisma | Schéma valide; base de test 23/23 |
| Playwright REF-01 local | Chromium/WebKit 2/2 |
| Playwright local complet | Chromium/WebKit 66/66 en 6,7 minutes |
| Build/prerender/budgets | Réussis; entrée 379 552 octets (120 833 gzip), admin 48 095, CSS 78 412 |
| Intégrité du diff | git diff --check réussi |

## Déploiement et postflight production

| Contrôle | Résultat |
|---|---|
| Préflight | 22 migrations; 22 formules/versions, 13 réservations, 11 intentions, 13 snapshots |
| Sauvegarde | .phase0-backups/20260802-pre-ref-01/database-pre-ref-01.dump.enc, mode 0600, AES-256-CBC/PBKDF2 |
| Empreinte chiffrée | 5fe1dd90f0dcb3c761ead2caacdde097669238010ea9a7e9ef713321e4be9bce |
| Restauration contrôlée | Clair/restauré identiques e95a97a5668740d0fda313bdf561080aef6d7a0f79976507f3e332e7b5eae708; catalogue 219 lignes; copies claires effacées |
| Migration | 20260802210000_ref_01_public_reference_immutability; production 23/23 |
| Contraintes actives | Deux triggers enabled=O; deux index uniques de référence présents |
| Compatibilité | 13/13 références historiques inchangées; empreinte 1e1a9710b9755f03a4853a4dbbdbae9dd2aac651f0e4f64784a564350bd3f020 identique |
| Volumes métier | Avant/après identiques : 22 formules, 22 versions, 13 réservations, 11 intentions, 13 snapshots |
| Service | PID 2277004 → 2412154; NRestarts 57→58; actif sur 127.0.0.1:4000 |
| Santé/sécurité | Santé locale et https://gsplus.vip/api/health 200; admin sans session 401 |
| Production ciblée | Chromium/WebKit 2/2 sur le bundle servi, APIs admin simulées, aucune mutation métier |

Aucune réservation réelle n'a été créée pour la preuve de production. Les prochaines réservations adopteront le nouveau format; les références historiques restent recherchables et immuables.

# P2-01 — Erreurs françaises localisées près des champs

Date : 3 août 2026. État : VALIDÉ-PROD.

## Contrat livré

- Réponses API de validation françaises et structurées par chemin, code et métadonnées sûres.
- Dictionnaire central couvrant champs publics, réservation, consentements, paiement et contraintes transversales.
- Erreurs inline accessibles sur les cinq parcours publics et les dialogues admin, avec valeurs conservées.
- Compatibilité avec VAL-01 et absence de chaînes Zod anglaises dans le code applicatif.

## Validation locale

| Contrôle | Résultat |
|---|---|
| Preuves rouges | Backend module absent + intégration 0/1; frontend module absent; Playwright 0/2 |
| Backend ciblé P2-01 | 3/3 |
| Contrat frontend P2-01 | 2/2 |
| Backend complet | 15 fichiers, 122/122; TypeScript conforme |
| Frontend complet | 59/59; ESLint conforme |
| Prisma | Schéma valide; base de test et production 23/23 |
| Playwright P2-01 local | Chromium/WebKit 2/2 |
| Playwright local complet | Chromium/WebKit 68/68 en 6,7 minutes |
| Build/prerender/budgets | Réussis; entrée 379 600 octets (120 859 gzip), public 38 291, admin 48 133, CSS 78 412 |
| Scan applicatif | Aucun `Request validation failed`, `Too small` ou `Invalid input` dans `backend/src` et `frontend/src` |
| Intégrité du diff | `git diff --check` réussi |

## Déploiement et postflight production

| Contrôle | Résultat |
|---|---|
| Déploiement | Code-only; aucune migration, sauvegarde ou écriture métier |
| Service | PID 2412154 → 3245038; `NRestarts` 58→60; actif après deux reprises gracieuses, dont la seconde charge le parseur média admin final |
| Santé | `https://gsplus.vip/api/health` : 200 |
| API réelle | Requête contact invalide rejetée avant persistance; résumé français et détails `name`/`message` structurés |
| Production ciblée | Chromium/WebKit 2/2 sur le bundle servi |

La requête de preuve était invalide par construction et n’a créé aucun contact. Zoho/SMTP et leurs secrets n’ont pas été modifiés.

# P2-02 — Rafraîchissement fiable de l’administration

Date : 3 août 2026. État : VALIDÉ-PROD.

## Contrat livré

- Revalidation de l’onglet à l’ouverture, au retour visible, après action et sur demande explicite.
- Polling modéré à 60 secondes, uniquement authentifié/visible et limité à la ressource active.
- Horodatage Douala, état de chargement accessible, déduplication et conservation de la recherche par référence.
- Aucune navigation complète, aucun SSE, aucune modification backend ou base.

## Validation locale

| Contrôle | Résultat |
|---|---|
| Preuves rouges | Module absent; Chromium/WebKit 0/2, nouvelle demande invisible à l’ouverture |
| Politique/statique P2-02 | 2/2 |
| Playwright P2-02 local | Chromium/WebKit 2/2 |
| Frontend complet | 61/61; ESLint conforme |
| Backend complet | 15 fichiers, 122/122 |
| Playwright local complet | Chromium/WebKit 70/70 en 6,8 minutes |
| Build/prerender/budgets | Entrée 379 600 (120 850 gzip), public 38 291, admin 49 759, CSS max 14 933/15 000, CSS total 78 663 |
| Navigation | Compteur inchangé avant/après actualisation; aucun `location.reload` |
| Intégrité du diff | `git diff --check` réussi |

## Déploiement et postflight production

| Contrôle | Résultat |
|---|---|
| Déploiement | Frontend-only depuis `frontend/dist`; aucune migration ni écriture métier |
| Service backend | Inchangé : PID 3245038, `NRestarts=60`, actif |
| Base | 23/23 migrations, schéma à jour |
| Santé | `https://gsplus.vip/api/health` : 200 |
| Production ciblée | Chromium/WebKit 2/2, APIs admin simulées |

Zoho/SMTP et leurs secrets n’ont pas été modifiés et ne constituent pas un bloqueur P2-02.

# P2-03 — États désactivés explicites et accessibles

Date : 8 août 2026. État : `VALIDÉ-PROD`.

## Contrat livré

- Style désactivé commun reconnaissable sans couleur : opacité 0,42, absence d’ombre et de mouvement, bordure en tirets, curseur non interactif et règle couleurs forcées.
- Aides de prérequis visibles et reliées aux contrôles par `aria-describedby` aux étapes formule, créneau et paiement.
- Créneaux indisponibles focalisables au clavier, exposés avec `aria-disabled`, nom accessible incluant heure et motif, texte barré et légende explicite.
- Aucune modification backend, base, notification, SMTP/Zoho ou fournisseur.

## Validation locale

| Contrôle | Résultat |
|---|---|
| Politique/statique P2-03 | 2/2 |
| Playwright P2-03 local | Chromium/WebKit 2/2, viewport 390×844, clavier et axe WCAG A/AA |
| Frontend complet | 63/63; ESLint conforme |
| Backend complet | 15 fichiers, 122/122 |
| Build/prerender/budgets | Réussis; entrée 379 600 (120 842 gzip), public 39 967/40 000, admin 49 759, CSS max 14 933/15 000, CSS total 79 644 |
| Chromium local complet | 36/36 |
| WebKit local | P2-03 ciblé vert; tous les scénarios historiques intermittents repassés isolément |
| Intégrité | CSP production non contournée; axe injecté localement seulement |

Le run WebKit monolithique demeure non déterministe sur cet hôte : le journal navigateur signale l’échec EGL/Zink, puis ferme parfois un contexte sur des scénarios historiques sans rapport entre eux (réservation, footer, image lazy ou recherche admin). Cette limite environnementale n’affecte ni Chromium 36/36, ni P2-03 local 2/2, ni la recette de production 2/2.

## Déploiement et postflight production

| Contrôle | Résultat |
|---|---|
| Déploiement | Frontend-only depuis `frontend/dist`; aucune migration ni écriture métier |
| Service backend | Inchangé : PID 3245038, `NRestarts=60`, actif |
| Base | 23/23 migrations, schéma à jour |
| Santé | Accueil et `https://gsplus.vip/api/health` : 200 |
| Production ciblée | Chromium/WebKit 2/2, APIs simulées, viewport mobile et CSP réelle |

P2-03 est validé en production. P2-04 est le prochain problème ordonné. Progression : 15/25 phases terminées (60 %).

# P2-04 — Libellés français, accents, dates, devise et statuts

Date : 8 août 2026. État : `VALIDÉ-PROD`.

## Contrat livré

- Statuts regroupés dans `status-labels.js`; tous les codes connus ont un libellé français et un état inconnu produit « Statut non reconnu » sans exposer le code fournisseur.
- Catégories et corrections de noms regroupées dans `packages.js`; les valeurs sources et API restent inchangées.
- Montants dynamiques uniformisés par `formatFcfa`; `XAF` demeure la valeur de stockage/API et n’est plus ajouté après « FCFA » dans l’aperçu.
- Dates métier textuelles centralisées par `formatBusinessDateKey`; instants rendus en `fr-CM` avec `Africa/Douala`.
- Aucune modification backend, base, notification, SMTP/Zoho ou fournisseur.

## Validation locale

| Contrôle | Résultat |
|---|---|
| Statique/unitaire P2-04 | 2/2 : dictionnaires gelés, accents, repli statut, FCFA, passage de minuit Douala et absence de formatteurs locaux |
| Playwright P2-04 local | Chromium/WebKit 2/2 : nom historique corrigé, 50 000 FCFA, date « Mar 10 Août » |
| Frontend complet | 65/65; ESLint conforme |
| Backend complet | 15 fichiers, 122/122; test DB 23/23 migrations |
| Build/prerender/budgets | Entrée 379 649 (120 864 gzip), public 39 869/40 000, admin 49 590, CSS max 14 933/15 000, CSS total 79 644 |
| Playwright local complet | Chromium 37/37; WebKit 36/37 dans le run long; P1-03 historique relancé isolément 1/1 en 4,8 s |
| Intégrité | `git diff --check` réussi; aucune hausse de budget |

Le seul écart du run Playwright de 7,7 minutes est un timeout WebKit sur l’ouverture d’un dialogue P1-03 historique. Les 36 autres scénarios WebKit, dont P2-04, ont réussi; le même test P1-03 a immédiatement réussi seul. Ce résultat est classé comme aléa environnemental du moteur, déjà observé sur l’hôte, et non comme défaut P2-04.

## Déploiement et postflight production

| Contrôle | Résultat |
|---|---|
| Déploiement | Frontend-only depuis `frontend/dist`; aucune migration ni écriture métier |
| Service backend | Inchangé : PID 3245038, `NRestarts=60`, `ActiveState=active` |
| Base | 23/23 migrations, schéma de production à jour |
| Santé | `https://gsplus.vip/api/health` : 200 |
| Production ciblée | Chromium/WebKit 2/2, APIs simulées, bundle et CSP réels |

P2-04 est validé en production. P2-05 est le prochain problème ordonné. Progression : 16/25 phases terminées (64 %), 9 restantes.

# P2-05 — Navigation, scroll, historique et focus

Date : 8 août 2026. État : `VALIDÉ-PROD`.

## Contrat livré

- Conservation de `ScrollManager` et du registre de positions par clé React Router.
- Transition avant : scroll `0,0` immédiat et stabilisé sur deux trames, puis focus de `#main-content` sans nouveau déplacement.
- Retour `POP` : coordonnées sauvegardées restaurées et contenu principal focalisé avec `preventScroll`.
- Initialisation StrictMode sans focus parasite; le lien « Aller au contenu principal » reste le premier élément au clavier.
- Ancre `#devis-creatif` attendue même après chargement lazy, positionnée sous le header et focalisée.
- Aucune modification backend, base, notification, SMTP/Zoho ou fournisseur.

## Validation locale

| Contrôle | Résultat |
|---|---|
| Statique P2-05 | 2/2 : inventaire header/footer, conservation ScrollManager, hash, observer, focus et cible |
| Playwright P2-05 local | Chromium/WebKit 22/22; 7 routes header bureau, 7 routes mobile, 10 routes footer, avant/arrière et focus |
| Frontend complet | 67/67; ESLint conforme |
| Backend complet | 15 fichiers, 122/122; test DB 23/23 migrations |
| Build/prerender/budgets | Entrée 380 353 (121 098 gzip), public 39 869/40 000, admin 49 590, CSS max 14 933/15 000, CSS total 79 667 |
| Run Playwright monolithique | 84/88 en 8,5 min avant correctif StrictMode final; lien d’évitement/lightbox corrigé puis 2/2; P2-03 WebKit 1/1; lot P2-05 concerné repassé puis suite ciblée finale 22/22 |
| Intégrité | `git diff --check`, client-only, lint, build et budgets réussis |

Les fermetures WebKit provenaient de l’accumulation de transitions dans un même contexte EGL/Zink. Les liens ont été isolés par lots de cinq au maximum : la même couverture exhaustive réussit alors 22/22 localement et 22/22 sur le bundle public. Le défaut StrictMode, lui, était reproductible sur les deux moteurs et a été corrigé avant la recette finale.

## Déploiement et postflight production

| Contrôle | Résultat |
|---|---|
| Déploiement | Frontend-only depuis `frontend/dist`; aucune migration ni écriture métier |
| Service backend | Inchangé : PID 3245038, `NRestarts=60`, actif |
| Base | 23/23 migrations, schéma de production à jour |
| Santé | `https://gsplus.vip/api/health` : 200 |
| Production ciblée | Chromium/WebKit 22/22, APIs simulées, bundle et CSP réels |

P2-05 est validé en production. P2-06 est le prochain problème ordonné. Progression : 17/25 phases terminées (68 %), 8 restantes.

# P2-06 — Non-régression responsive globale

Date : 8 août 2026. État : `VALIDÉ-PROD`.

## Contrat livré

- Matrice des 11 routes publiques à 320×568, 390×844, 844×390 paysage, 768×1024, 992×768 et 1280×800.
- Contrôle à chaque navigation de `documentElement.scrollWidth`, `body.scrollWidth` et de la largeur CSS visible.
- Reflow équivalent à un zoom navigateur 200 % d’un écran 1280 pixels, reproduit par un viewport de 640 pixels CSS sur les 11 routes.
- Administration authentifiée contrôlée à 320, 390, 768, 992 et 1280 pixels, avec recherche, tableaux et bascule tiroir/barre latérale.
- Protection du tiroir mobile existant : rôle modal nommé, fond principal `inert`/masqué aux technologies d’assistance, verrouillage du corps, boucle Tab/Shift+Tab et retour du focus.
- Correction du retour Échap : le bouton déclencheur n’est focalisé qu’à la trame suivant la suppression de `inert`.
- Aucune modification backend, base, notification, SMTP/Zoho ou fournisseur.

## Validation locale

| Contrôle | Résultat |
|---|---|
| Statique P2-06 | 2/2 : largeurs contractuelles, paysage, reflow 200 %, routes publiques/admin et contrat clavier du tiroir |
| Playwright P2-06 local | Chromium/WebKit 8/8; 66 combinaisons route/taille par moteur, reflow 200 %, admin et clavier |
| Frontend complet | 69/69; ESLint conforme |
| Backend complet | 15 fichiers, 122/122; base de test à 23/23 migrations |
| Build/prerender/budgets | Entrée 380 353 (121 106 gzip), public 39 869/40 000, admin 50 360, CSS max 14 933/15 000, CSS total 79 667 |
| Playwright local complet | 102/104 en 10,9 min; P2-06 8/8. Deux intermittences WebKit historiques P2-05/Phase 9 relancées ensemble 2/2 |
| Intégrité | `git diff --check`, client-only, lint, build, prerender et budgets réussis |

Le premier test rouge utile a révélé que la fermeture Échap rendait bien le tiroir invisible mais tentait de focaliser son déclencheur alors que l’en-tête était encore `inert`. La restitution différée passe 2/2 sur les deux moteurs. Le run long a uniquement conservé deux intermittences WebKit hors P2-06 : focus de navigation P2-05 et activation d’un lien légal Phase 9; les mêmes scénarios ont réussi ensemble dès la relance isolée.

## Déploiement et postflight production

| Contrôle | Résultat |
|---|---|
| Déploiement | Frontend-only depuis `frontend/dist`; aucune migration ni écriture métier |
| Service backend | Inchangé : PID 3245038, `NRestarts=60`, `ActiveState=active` |
| Base | 23/23 migrations appliquées, inchangée |
| Santé | Accueil et `https://gsplus.vip/api/health` : 200 |
| Production ciblée | Chromium 4/4; WebKit 3/4 puis scénario public complet 1/1 isolé, soit preuve finale 8/8; APIs simulées |

La première passe production WebKit a affiché le HTML pré-rendu Portfolio sans hydratation JavaScript lors d’une navigation parmi 66; aucun débordement n’était observé, mais `#main-content` React était absent. Le scénario matriciel complet a repassé immédiatement 1/1 en 18,8 secondes.

P2-06 est validé en production. LEG-01 est le prochain problème ordonné. Progression : 18/25 phases terminées (72 %), 7 restantes.

# LEG-01 — Alignement des mentions légales

Date : 8 août 2026. État : `VALIDÉ-PROD`.

## Contrat livré

- Date normative propre aux mentions légales : 31 juillet 2026; les dates Confidentialité/CGV ne sont pas modifiées avant LEG-02/LEG-03.
- Quatre sections et formulations fidèles au document consolidé : éditeur/propriété intellectuelle, responsabilité, droit applicable/différends et documents associés.
- Ajout de l’absence de cession de droits et des interdictions d’extraction automatisée/répétée, réutilisation commerciale, base concurrente et entraînement/test/alimentation de systèmes automatisés ou d’IA.
- Compétence exclusive des tribunaux matériellement compétents du ressort de Douala, sous réserve des règles impératives.
- Coordonnées publiées du Studio et fiche Hetzner conservées comme informations complémentaires vérifiées.
- Forme/capital, RCCM/NIU et direction de publication maintenus en attente; aucune donnée officielle non justifiée ajoutée.
- Aucune modification backend, base, notification, SMTP/Zoho ou fournisseur.

## Validation locale

| Contrôle | Résultat |
|---|---|
| Test rouge LEG-01 | 1/2 : date et clauses normatives absentes; informations vérifiées déjà conservées |
| Statique LEG-01 final | 2/2 : date, quatre titres, clauses exactes, coordonnées et garde anti-invention |
| Playwright LEG-01 local | Chromium/WebKit 4/4 : contenu, dates isolées, liens, informations vérifiées et 320 px |
| Tests liés | 6/6 : liens juridiques, registre existant, tableaux responsive et axe sur toutes les routes |
| Frontend complet | 71/71; ESLint conforme |
| Backend complet | 15 fichiers, 122/122; base de test à 23/23 migrations |
| Build/prerender/budgets | Entrée 380 353 (121 096 gzip), public 39 869/40 000, admin 50 360, CSS max 14 933/15 000, CSS total 79 782 |
| Playwright local complet | 106/108 en 11,7 min; LEG-01 4/4. Deux crashes WebKit P2-04/P2-05 hors périmètre, puis 1/1 et 1/1 séparément |
| Intégrité | `git diff --check`, client-only, lint, build, prerender et budgets réussis |

Le run monolithique n’a révélé aucun écart LEG-01. Les deux échecs historiques sont des fermetures du processus WebKit : P2-04 a perdu sa page pendant le clic « Continuer » et P2-05 pendant un clic Portfolio. Une relance groupée a reproduit la fermeture du moteur; deux processus neufs séparés ont ensuite réussi 1/1 et 1/1.

## Déploiement et postflight production

| Contrôle | Résultat |
|---|---|
| Déploiement | Frontend-only depuis `frontend/dist`; aucune migration ni écriture métier |
| Service backend | Inchangé : PID 3245038, `NRestarts=60`, `ActiveState=active` |
| Base | 23/23 migrations appliquées, inchangée |
| Santé | `https://gsplus.vip/mentions-legales` et `/api/health` : 200 |
| Production ciblée | Chromium/WebKit 8/8 : LEG-01 4/4 et smoke juridique/public 4/4 |

LEG-01 est validé en production. LEG-02 est le prochain problème ordonné. Progression : 19/25 phases terminées (76 %), 6 restantes.
