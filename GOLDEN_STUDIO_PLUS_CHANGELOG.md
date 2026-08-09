# Changelog — Golden Studio Plus

## 9 août 2026 — Catalogue français préparé en production

### Déployé

- Mode versionné `DIRECT`/`CONTACT`, durées nullables uniquement sur contact et gardes serveur anti-contournement.
- Source canonique de 35 offres françaises, délais exacts Fiançailles/Pré-mariage et fallback WhatsApp pour les 29 autres offres.
- Règles Happy Hours côté serveur; affichage manuel explicite de l'avantage étudiant et du parrainage.
- Migration 29/29, backend redémarré et frontend français construit.

### Préparé sans publication

- 35/35 DRAFT conformes : 22 nouvelles versions et 13 nouvelles offres inactives.
- Les 22 versions historiques restent publiées; zéro version validée et zéro publication déclenchée.
- Sauvegarde restaurable vérifiée avant migration; 13 réservations/snapshots/paiements et 54 notifications inchangés.
- POST-03 attend désormais la validation et l'ordre de publication OWNER.

## 9 août 2026 — Source officielle du nouveau catalogue

### Confirmé et préparé

- `docs/Golden_Studio_Plus_Catalogue.docx` devient la source OWNER officielle : 34 packs et trois promotions.
- Aperçu non mutatif de la cible 35 offres, correspondance des 22 formules, treize créations, durées, livraisons et capacités techniques.
- Ancienne grille de livraison écartée comme source de publication car les six délais documentés la contredisent.
- Production inchangée; aucune version DRAFT ou publication créée.

## 9 août 2026 — POST-06 revalidation exhaustive, non close

### Vérifié

- Trois DOCX réextraits intégralement, empreintes stables et inventaire de 61 identifiants recalculé.
- Prisma, TypeScript, backend 156/156, frontend 92/92, lint, build/prerender/budgets et audit traceurs conformes.
- E2E local initial 132/134 puis ciblé 2/2; production initiale 117/118 puis scénarios WebKit isolés verts; axe production 2/2. Les résultats initiaux sont conservés comme flakes de crash WebKit.
- Service actif, 28 migrations à jour, HTTPS 200 et compteurs production inchangés; aucun e-mail ni aucune donnée QA créés.

### Différé sans faux succès

- OAuth SMTP Logs POST-05 différé à la demande de l'OWNER; Zoho Mail ordinaire reste inchangé.
- Verdict : 53/59 actives et 53/61 globales `VALIDÉ-PROD`. P1-01/I-08 restent `DIFFÉRÉ-META`; E-17/E-18/E-19 restent bloquées par leurs gates; I-09/I-11/I-12 restent différées faute de preuves externes.
- POST-03 reste `DIFFÉRÉ-OWNER` pour le contenu catalogue; aucune valeur n'a été inventée.

## 9 août 2026 — Voie A Zoho Mail et probe OAuth SMTP Logs

### Ajouté

- Choix OWNER enregistré : conservation de Zoho Mail; ZeptoMail n'est pas retenu.
- Service et commande `email:zoho-smtp-logs:check` pour confirmer l'accès lecture sur un seul Message-ID I-11.
- Liste blanche des neuf datacenters Zoho documentés, fenêtre/volume bornés et sortie sans donnée de journal.
- Variables d'exemple sans valeur secrète pour l'Organization ID, le token OAuth, le datacenter et l'override Message-ID.

### Prouvé

- Tests dédiés 4/4, backend complet 156/156 et build TypeScript conformes.
- Sans identifiants, arrêt avant réseau sur la première variable absente; aucune fuite de token dans les erreurs testées.
- Aucune modification de configuration ou donnée production. État `BLOQUÉ-ACCÈS-OAUTH-ET-AUTORISATION` jusqu'au probe réel.

## 9 août 2026 — Préflight POST-05 Zoho/I-09/I-11/I-12

### Constaté

- Le SMTP actif est Zoho Mail, pas ZeptoMail; aucun secret de webhook e-mail n'est configuré et aucun `EmailDeliveryReport` n'existe.
- I-11 fonctionne à 18 h Douala : sept événements du 2 au 8 août, tous `SENT` et acceptés par SMTP, sans preuve fournisseur `deliveredAt`.
- I-09 et I-12 n'ont aucune preuve production. Les huit leads et quatorze échecs e-mail historiques restent inchangés.
- Le contrat webhook interne n'est compatible directement ni avec les journaux Zoho Mail ni avec le payload/signature ZeptoMail documenté.

### Prouvé

- Quatre fichiers de tests ciblés, 21/21 tests verts : I-09, webhook signé, I-11 et I-12.
- Documentation officielle rapprochée : journaux/API SMTP de Zoho Mail et webhooks bounce signés de ZeptoMail.
- Aucun e-mail, lead, rapport ou autre donnée de production créé ou modifié. POST-05 reste `BLOQUÉ-ACCÈS-OAUTH-ET-AUTORISATION`.

## 9 août 2026 — POST-03 différé et préflight POST-04

### Documenté

- POST-03 devient `DIFFÉRÉ-OWNER` pendant l'attente des réponses catalogue, sans être déclaré terminé et sans modification tarifaire.
- POST-04 exige deux dossiers QA distincts : un `NO_SHOW` pour E-17 et un `COMPLETED` pour E-18/E-19.
- Un runbook supervisé fixe les gates : autorisation d'envoi, boîte QA contrôlée, deux réservations QA, délai versionné approuvé et livrable HTTPS non sensible.

### Prouvé

- Tests e-mail/livraison ciblés : 2 fichiers, 18/18 tests verts.
- Production en lecture seule : 13 réservations, zéro E-17/E-18/E-19, zéro tentative associée, zéro livraison et 0/22 version publiée avec un délai.
- SMTP sortant et worker configurés; secret de rapport fournisseur absent et maintenu dans le périmètre POST-05.
- Aucune écriture production et aucun e-mail réel. POST-04 reste `BLOQUÉ-GATES-OWNER`.

## 9 août 2026 — POST-03 relecture exhaustive et inventaire corrigé

### Corrigé

- Les trois DOCX ont été relus intégralement : 1 064 lignes e-mails, 509 lignes audit et 125 lignes juridiques. L'inventaire initial assimilait à tort 88 champs vides en base à 88 nouveaux textes à rédiger.
- `GOLDEN_STUDIO_PLUS_OWNER_PACKAGE_CONTENT_INVENTORY.md` est remplacé par une matrice de récupération : CGV communes, grille de délais existante et trois listes d'inclusions récupérées; descriptions/contenus et 19 listes restent sans source locale.
- Le frontend respecte désormais le futur `deliveryLabel` versionné OWNER au lieu de l'écraser systématiquement par le fallback calculé; les versions historiques conservent leur affichage actuel.

### Prouvé

- Test rouge 4/5 sur la priorité du délai, puis ciblé 5/5 et frontend complet 92/92.
- ESLint, build, prerender, budgets et audit traceurs conformes; P1-04 local Chromium/WebKit 4/4 et production interceptée non mutative 4/4.
- Production : chunk frontend corrigé effectivement servi, santé/admin 200; 22 versions `PUBLISHED`, 13 réservations/snapshots et empreinte historique inchangés.
- Aucune version tarifaire, réservation, notification ou donnée de production modifiée. POST-03 a ensuite été placé en `DIFFÉRÉ-OWNER` pendant l'attente des réponses.

## 9 août 2026 — POST-03 inventaire initial, corrigé par la relecture exhaustive

Cette entrée conserve la trace du premier préflight; ses conclusions « 88 textes » et son état ont été remplacés par l'entrée corrective ci-dessus.

### Constaté

- Extraction production en lecture seule : 22 formules actives, 22 versions publiées, aucune DRAFT/VALIDATED; les 22 résumés publics, 22 délais de livraison, 22 listes d'inclusions et 22 mentions juridiques tarifaires sont absents. `content`/`conditions` reprennent uniquement le nom et attendent confirmation OWNER.
- Aucune mention OWNER approuvée formule par formule n'est présente dans le dépôt. Le fallback frontend et le texte marketing générique « 48 h » ne sont pas assimilés à une approbation métier.

### Ajouté

- Version initiale de `GOLDEN_STUDIO_PLUS_OWNER_PACKAGE_CONTENT_INVENTORY.md`, remplacée le même jour par la matrice de récupération après lecture intégrale des DOCX.
- Baseline non personnelle des 13 snapshots/liaisons tarifaires, empreinte SHA-256 `30c8b4efc31b89abe8081a1e1d7b33576bb5e4002afc025d4932bb824a968be1`.

### En attente

- Aucune version DRAFT créée et aucune donnée de production modifiée; cet état initial a ensuite été affiné en `EN-ATTENTE-SOURCE-CATALOGUE-OWNER`.

## 9 août 2026 — POST-02 anti-saturation administrative

### Ajouté

- Politique centrale acteur/audience/destination pour les alertes internes, sans migration : destinations `SHARED_OPERATIONAL` ou `NOMINATIVE`, sources `ADMIN`, `SYSTEM`, `CUSTOMER` ou `EXTERNAL`.
- Une alerte nominative réellement adressée à son auteur est enregistrée `CANCELLED`/`SUPPRESSED` avec la raison minimale `SELF_NOMINATIVE_REDUNDANT`; aucune tentative fournisseur n'est créée.
- Les métadonnées d'audit contiennent uniquement des types et identifiants internes, jamais une copie de l'adresse complète.

### Préservé

- Les alertes vers la boîte opérationnelle partagée, vers un autre admin, depuis un worker, vers un client et les messages E-xx restent inchangées.
- I-07/I-08/I-09/I-10 restent non supprimables pour préserver les alertes terminales fournisseur, sécurité et intégrité.
- Les 54 événements historiques restent intacts; aucune suppression rétroactive.

### Validé et déployé

- Test rouge : module absent, suite non chargeable; final POST-02 6/6, suites liées 43/43, backend complet 152/152 sur 18 fichiers.
- Prisma format/validate/generate, TypeScript et `git diff --check` conformes; aucune migration.
- Production : service actif PID 1224482, `NRestarts=67`, schéma 28/28, santé/admin 200. Compteurs inchangés et aucun envoi fournisseur.
- Progression : 2/6 phases actives; 53/61 exigences atomiques `VALIDÉ-PROD` (POST-02 clôt un critère transverse).

## 9 août 2026 — POST-01 cycles et déduplication I-03 à I-06

### Corrigé

- **I-03** : remplacement de la clé unique par réservation, qui supprimait un second cycle paiement→attente légitime, par une identité de cycle `payment:{id}:v{version}:{status}:I-03:email`.
- La version du paiement attendue est désormais figée dans les métadonnées; une alerte différée d'un ancien cycle devient obsolète avec `PAYMENT_CYCLE_CHANGED`. Les événements historiques restent intacts.

### Prouvé

- Nouveau lot d'intégration `post-audit-notification-cycles.test.ts` : I-03 à I-06, premier cycle, rejeu, producteurs et workers concurrents, nouvelle demande/cycle, annulations client/Studio aux limites ±48 h, version périmée, tâche financière avant I-06, engagement et finalisation.
- Test rouge confirmé 7/8 sur l'ancienne clé, puis POST-01 9/9, suites liées 33/33 et backend complet 146/146 sur 17 fichiers.
- Prisma format/validate/generate, TypeScript et `git diff --check` conformes; aucune migration.

### Déployé

- Backend compilé et repris proprement par systemd (`PID 1172481`, `NRestarts=66`); `/api/health` et `/admin` répondent 200; production à 28/28 migrations.
- Postflight sans écriture ni envoi fournisseur : 13 réservations, 13 paiements, 54 notifications, zéro tâche financière et zéro demande de report; dernier envoi horodaté avant le déploiement.
- Matrice portée à 53/61 `VALIDÉ-PROD`; POST-01 terminé, POST-02 devient la prochaine phase active. WhatsApp/Meta reste explicitement différé.

## 9 août 2026 — Audit indépendant exhaustif des trois DOCX sources

Le registre ordonné annoncé « 25/25 » ne couvrait qu'un sous-ensemble ordonné des exigences des trois documents sources (bibliothèque d'e-mails, rapport d'audit unifié, textes juridiques). Un audit indépendant, reparti des DOCX originaux sans se fier à la matrice existante, a été conduit pour contrôler chaque exigence atomique contre le code, la base, les tests et la production.

### Constaté

- Le registre classait `PLANIFIÉ` la quasi-totalité de la bibliothèque d'e-mails (E-03 à E-23, I-03 à I-12) : constat erroné. Cinq audits indépendants du code (lecture seule, preuve fichier:ligne) ont établi que ces 35 modèles étaient déjà implémentés dans `backend/src/emails/notifications.ts` (1947 lignes), `templates.ts` (383 lignes), couverts par des tests d'intégration HTTP réels, et déployés en production (workers actifs, SMTP Zoho réel configuré).
- P0-01 à P0-04, P1-02, P1-03, UI-WA-01, REF-01, VAL-01, P2-01 à P2-06 et LEG-01 à LEG-07 confirmés conformes au code réel et aux tests réellement exécutés (pas de simple lecture du registre).

### Corrigé

- **P1-04** : `assertPublishable` (`backend/src/services/packages.ts`) ne bloquait pas la publication d'un tarif sans résumé public (`description`) ni délai de livraison (`deliveryLabel`), contrairement au critère de sortie de l'audit. Les 22 formules déjà publiées en étaient dépourvues. Garde backend et champs requis frontend ajoutés ; test rouge puis vert (`backend/test/integration/api.test.ts`).
- **NOTIF-01** : fenêtre de regroupement E-03 (5 min) et délai d'escalade I-03 (30 min) codés en dur, contrairement à l'exigence « fenêtre configurable ». Rendus configurables via `PAYMENT_VERIFIED_NOTICE_DELAY_MS`/`PAYMENT_DECISION_OVERDUE_DELAY_MS` (`backend/src/config/env.ts`), valeurs par défaut inchangées. Test dédié `backend/test/notification-delay-config.test.ts`.
- **LEG-02** : écart textuel avec le DOCX normatif du 31 juillet 2026 — « retirer un consentement pour l'avenir » devenu à tort « retirer à tout moment un consentement » (change le sens : effet prospectif vs moment de la demande). Corrigé mot pour mot dans `frontend/src/content/legal.js`.
- Nettoyage mineur : constante `LEGAL_LAST_UPDATED` orpheline portant une date obsolète (24 juillet), mise à jour au 31 juillet 2026 par cohérence (jamais réellement affichée sur les pages).

### Resté bloqué (preuve externe requise, non fabriquée)

- **P1-01/I-08 — WhatsApp** : code complet et testé, mais `backend/.env` production ne contient aucune variable `WHATSAPP_*` ; `WHATSAPP_DELIVERY_ENABLED=false` par défaut. Aucun message WhatsApp n'a jamais été livré en production. Nécessite des identifiants Meta Business/WhatsApp Cloud API réels fournis par le client.
- **E-17/E-18/E-19 et I-09/I-11** : code, schéma et tests réels (SMTP Zoho configuré, vérification live du lien de livraison), mais aucune capture fraîche de réception par un destinataire réel n'a été produite (l'audit interdit d'envoyer un vrai e-mail sans autorisation explicite, non demandée ici).

### Validé

- Sauvegarde PostgreSQL chiffrée (AES-256-CBC/PBKDF2) vérifiée par restauration de contrôle avant déploiement (`'.phase0-backups/20260809-audit-fixes/'`).
- Backend 137/137 (16 fichiers), frontend 91/91, TypeScript strict, lint, Prisma format/validate/generate, build/budgets tous réussis.
- Playwright local Chromium+WebKit 134/134, Playwright production ciblé 118/118 + axe production 2/2 (échecs intermittents rencontrés lors des runs complets confirmés non reproductibles en isolation — charge d'un hôte partagé, pas régression).
- Compteurs métier identiques avant/après déploiement : 13 réservations/snapshots/paiements, 22 formules, 54 notifications, 11 synchronisations calendrier, 0 incident, 0 retrait, 0 demande de droits, 17/18 médias publiés.
- Service redémarré (SIGTERM propre, `Restart=always`), santé et catalogue public HTTP 200 après redémarrage.
- Aucun remote Git configuré : commit local uniquement, aucun push possible.

## 8 août 2026 — LEG-07 droits effectifs des médias validés en production

### Ajouté

- Base de droits explicite sur chaque média et registre d’usage reliant contenu exact, réservation, accord, finalité, portée et état prospectif.
- Création des médias clients en brouillon, publication réservée au propriétaire et bloquée sans accord d’image courant; STAFF conserve une consultation sans commandes de publication.
- Contraintes et triggers SQL empêchant toute publication sans base valide et dépubliant/dé-épinglant automatiquement les médias concernés lors d’un retrait.
- Filtre public centralisé limitant le portfolio aux médias du catalogue propriétaire autorisé ou aux usages clients actifs, sans exposer les preuves internes.
- Panneau admin accessible chargé paresseusement : base de droits, statut et référence de réservation visibles; publication directe décochée.
- Reprise contrôlée des 17 médias `owner-approved-*` selon le manifeste privé; zéro usage client ou livraison artificiels.
- Migration additive 28/28, sauvegarde PostgreSQL de 155 163 octets vérifiée et invariants de production inchangés : 13 réservations, 13 paiements, 9 accords, 4 refus.
- Frontend 91/91, backend 134/134, statique 4/4, backend ciblé 3/3, LEG-07 local 4/4 et production Chromium/WebKit 4/4.
- Playwright complet 132/134, LEG-07 4/4; les deux intermittences WebKit historiques LEG-03/Phase 9 ont repassé ensemble 6/6.
- Build/prerender/budgets conformes : entrée 380 353 octets (121 106 gzip), route publique maximale 37 272/40 000, admin 50 170 et CSS total 80 958.
- Production : backend PID 570395, `NRestarts=64`, santé/admin 200; API publique à 17 médias et zéro fuite de preuve interne.

LEG-07 est terminé et `VALIDÉ-PROD`. Le registre ordonné est complet : 25/25 phases (100 %), aucune restante.

## 8 août 2026 — LEG-06 inventaire des traceurs validé en production

### Ajouté

- Inventaire central versionné du cookie administrateur strictement nécessaire et de Google Fonts, ressource typographique externe sans finalité de traçage.
- Audit bloquant au build des signatures analytics/publicitaires, APIs de stockage navigateur et origines externes auto-chargées non inventoriées.
- Rapport public `tracker-audit-report.json` : deux entrées, deux origines attendues, zéro traceur facultatif, zéro stockage navigateur et zéro signature interdite.
- Section Confidentialité §7 enrichie avec portée, finalité, stockage et durée réels; aucune fausse bannière CMP tant qu’aucun choix facultatif n’existe.
- Contrat prospectif imposant à tout futur traceur facultatif un état désactivé avant accord, un refus aussi accessible que l’acceptation et un mécanisme de retrait.
- Frontend 87/87, backend 131/131, statique 4/4, LEG-06 local 4/4 et production Chromium/WebKit 4/4.
- Playwright complet 129/130, LEG-06 4/4; l’unique fermeture WebKit P2-05 hors périmètre a repassé 1/1 isolément.
- Build/prerender/budgets conformes : entrée 380 356 octets (121 101 gzip), route publique maximale 37 272/40 000, admin 54 946/55 000 et CSS total 80 958.
- Production frontend-only : rapport, confidentialité, admin et santé 200; backend inchangé PID 374587, `NRestarts=63`; base inchangée 27/27.

LEG-06 est terminé et `VALIDÉ-PROD`. LEG-07 « Respect effectif du droit à l’image sur les médias » devient le prochain problème ordonné; progression 24/25 (96 %), 1 phase restante.

## 8 août 2026 — LEG-05 gouvernance des données et demandes de droits validées en production

### Ajouté

- Sept politiques de conservation publiées et versionnées pour réservations, paiements, consentements, médias/fichiers, journaux techniques, sauvegardes et demandes de droits.
- Registre propriétaire des demandes d’accès, rectification, limitation, opposition, portabilité, retrait et effacement, avec échéance opérationnelle, identité référencée sans copie brute, restriction de traitement, décision et preuve de réponse.
- Commandes idempotentes, contrôle de version, audit minimisé et historique événementiel append-only; accès API et interface refusé à STAFF.
- Décisions explicites de maintien, archivage restreint, anonymisation/effacement à exécuter ou gel juridique; aucune suppression automatique et aucun délai légal inventé.
- Deux migrations additives avec contraintes d’états et triggers protégeant politiques publiées et événements contre les mutations SQL directes; production 27/27, sept politiques, zéro dossier artificiel.
- Frontend 83/83, backend 131/131, statique 4/4, backend ciblé 3/3, LEG-05 local 4/4 et production 4/4 sans écriture métier réelle.
- Playwright complet 125/126, LEG-05 4/4; l’unique intermittence WebKit historique de réservation hors périmètre a repassé 1/1 isolément.
- Build/prerender/budgets conformes : entrée 380 356 octets (121 110 gzip), route publique maximale 37 272/40 000, admin 54 946/55 000, CSS maximal 14 933/15 000 et CSS total 80 958.
- Production : backend PID 374587, `NRestarts=63`, santé/admin 200; sauvegarde de 137 436 octets vérifiée; 13 réservations/13 paiements inchangés.

LEG-05 est terminé et `VALIDÉ-PROD`. LEG-06 « Inventaire des traceurs et préférences si nécessaire » devient le prochain problème ordonné; progression 23/25 (92 %), 2 phases restantes.

## 8 août 2026 — LEG-04 consentements versionnés et retrait prospectif validés en production

### Ajouté

- Registre publié des versions CGV, confidentialité et autorisation d’image du 31 juillet 2026, reliées à l’empreinte de la source juridique consolidée.
- Cases CGV et confidentialité séparées; autorisation d’image et WhatsApp distinctes et décochées par défaut; finalité et portée promotionnelle visibles avant le choix.
- Événements immuables d’accord ou de refus créés atomiquement avec chaque réservation, avec version, texte présenté, source, date, finalité, portée et preuve.
- Workflow propriétaire idempotent de retrait ou de nouvelle autorisation, chaîné à l’état précédent, audité et protégé contre les conflits; retrait uniquement prospectif sans mutation du snapshot.
- Migration additive 25/25 : deux registres, trois versions publiées et reprise contrôlée de 13 preuves historiques — 9 accords, 4 refus et aucun retrait artificiel.
- Frontend 79/79, backend 128/128, LEG-04 local 4/4, parcours liés 26/26 et production Chromium/WebKit 8/8 sans écriture réelle.
- Playwright global 120/122, LEG-04 4/4; les deux instabilités WebKit historiques hors périmètre ont repassé séparément 1/1 et 1/1.
- Build/prerender/budgets conformes : entrée 380 353 octets (121 107 gzip), route publique maximale 37 272/40 000, admin 54 921/55 000 et CSS total 79 782.
- Production : réservation/API 200; backend actif PID 276996 avec `NRestarts=62`; sauvegarde PostgreSQL validée avant migration.

LEG-04 est terminé et `VALIDÉ-PROD`. LEG-05 « Conservation, archivage, sécurité et demandes de droits » devient le prochain problème ordonné; progression 22/25 (88 %), 3 phases restantes.

## 8 août 2026 — LEG-03 CGV et rétractation traçable validées en production

### Ajouté

- Publication des CGV consolidées du 31 juillet 2026 en huit sections, avec règles de paiement, seuil d’annulation/report de 48 heures à Douala, remboursement effectif, rétractation sous 15 jours et conditions d’exécution anticipée.
- Registre persistant des demandes de rétractation : date/canal/texte/preuve, état du service, échéance légale figée, commande idempotente et audit propriétaire.
- Décision humaine motivée distincte, acceptée ou rejetée, sans annulation, remboursement ni mutation de paiement automatique.
- Migration additive 24/24 avec sept contraintes et sept index; sauvegarde PostgreSQL vérifiée avant déploiement; 13 réservations et 13 paiements inchangés, zéro demande réelle créée en production.
- Frontend 76/76, backend 125/125, LEG-03 local 6/6, tests liés 6/6 et production ciblée Chromium/WebKit 10/10 sans écriture métier réelle.
- Run Playwright complet : 116/118, LEG-03 6/6; deux fermetures WebKit historiques hors périmètre ont repassé séparément 1/1 et 1/1 dans des processus neufs.
- Build/prerender/budgets conformes : entrée 380 353 octets (121 099 gzip), route publique maximale 39 869/40 000, admin 53 632, CSS maximal 14 933/15 000 et CSS total 79 782.
- Production : CGV/API 200; backend actif PID 4153872 avec `NRestarts=61`.

LEG-03 est terminé et `VALIDÉ-PROD`. LEG-04 « Consentement distinct au droit à l’image » devient le prochain problème ordonné; progression 21/25 (84 %), 4 phases restantes.

## 8 août 2026 — LEG-02 politique de confidentialité du 31 juillet validée en production

### Ajouté

- Publication de la politique consolidée en dix sections, datée du 31 juillet 2026, couvrant responsable, données, finalités/fondements, destinataires/transferts, traitement numérique des images, conservation/archivage, traceurs, sécurité, droits et documents associés.
- Alignement détaillé des catégories collectées, usages, bases légales, conséquences d’un refus, destinataires professionnels, transferts internationaux et garanties associées.
- Clarification de l’archivage restreint, des sauvegardes résiduelles, des mesures de confidentialité/intégrité/disponibilité/traçabilité et des limites légales à l’effacement.
- Modalités d’exercice des droits complétées : justificatif d’identité uniquement proportionné au risque et retrait du droit à l’image distinct, sans effet rétroactif automatique.
- Conservation des tableaux opérationnels vérifiés sur les prestataires, durées et droits, ainsi que de la situation réelle des traceurs : aucun outil public publicitaire ou analytique actif.
- Frontend 73/73, backend 122/122, tests liés 6/6, Playwright local complet 112/112 et production ciblée Chromium/WebKit 8/8.
- Build/prerender/budgets conformes : entrée 380 353 octets (121 098 gzip), route publique maximale 39 869/40 000, admin 50 360, CSS maximal 14 933/15 000 et CSS total 79 782.
- Production frontend-only : confidentialité/API 200; backend inchangé PID 3245038 avec `NRestarts=60`, base inchangée 23/23.

LEG-02 est terminé et `VALIDÉ-PROD`. LEG-03 « Alignement des conditions générales de vente » devient le prochain et seul problème ordonné; progression 20/25 (80 %), 5 phases restantes.

## 8 août 2026 — LEG-01 mentions légales du 31 juillet validées en production

### Ajouté

- Publication des quatre sections normatives consolidées : éditeur/propriété intellectuelle, responsabilité, droit applicable/différends et documents associés.
- Clauses manquantes sur l’absence de cession, l’extraction automatisée, la réutilisation commerciale, la base concurrente et l’entraînement/test de systèmes automatisés ou d’IA.
- Formulation fidèle de la compétence exclusive des tribunaux matériellement compétents du ressort de Douala.
- Conservation des coordonnées vérifiées de Golden Studio Plus et de l’hébergeur Hetzner, distinctes du texte normatif.
- Maintien visible des mentions officielles en attente — forme/capital, RCCM/NIU et direction de publication — sans inventer de donnée.
- Date LEG-01 isolée au 31 juillet 2026; Confidentialité/CGV restent au 24 juillet jusqu’à leurs phases dédiées.
- LEG-01 statique 2/2, local Chromium/WebKit 4/4, tests liés 6/6 et production 8/8.
- Frontend 71/71, backend 122/122, Playwright complet 106/108 puis les deux crashes WebKit historiques relancés séparément 1/1 et 1/1.
- Build/prerender/budgets conformes : entrée 380 353 octets, route publique maximale 39 869/40 000, admin 50 360 et CSS total 79 782.
- Production frontend-only : page/API 200; backend inchangé PID 3245038 avec `NRestarts=60`, base inchangée 23/23.

LEG-01 est terminé et `VALIDÉ-PROD`. LEG-02 « Alignement de la politique de confidentialité » devient le prochain et seul problème ordonné; progression 19/25 (76 %), 6 phases restantes.

## 8 août 2026 — P2-06 non-régression responsive globale validée en production

### Ajouté

- Matrice automatisée des 11 routes publiques à 320×568, 390×844, 844×390 paysage, 768×1024, 992×768 et 1280×800, avec contrôle du document et du corps.
- Reflow équivalent au zoom navigateur 200 % d’un écran 1280 pixels, validé à 640 pixels CSS sur toutes les routes publiques.
- Couverture de l’administration authentifiée de 320 à 1280 pixels, incluant le tiroir, les tableaux, la recherche et le basculement bureau/mobile.
- Protection du menu admin existant : fond `inert`, verrouillage du scroll, rôle modal nommé, boucle Tab/Shift+Tab et restitution fiable du focus après Échap ou navigation.
- Correction de la restitution Échap qui ciblait auparavant le bouton encore `inert`; focus différé après le nettoyage React.
- P2-06 statique 2/2, local Chromium/WebKit 8/8 et production finale 8/8 sans écriture métier.
- Frontend 69/69, backend 122/122, Playwright complet 102/104 puis deux intermittences WebKit historiques relancées ensemble 2/2; P2-06 8/8 dans le run complet.
- Build/prerender/budgets conformes : entrée 380 353 octets, route publique maximale 39 869/40 000, admin 50 360 et CSS total 79 667.
- Production frontend-only : accueil/API 200; backend inchangé PID 3245038 avec `NRestarts=60`, base inchangée 23/23.

P2-06 est terminé et `VALIDÉ-PROD`. LEG-01 « Alignement des mentions légales » devient le prochain et seul problème ordonné; progression 18/25 (72 %), 7 phases restantes.

## 8 août 2026 — P2-05 navigation, historique et focus validés en production

### Ajouté

- `ScrollManager` conservé et renforcé : remise en haut synchronisée avec le rendu lazy, restauration des coordonnées par clé d’historique et focus du contenu principal sur chaque transition.
- Détection StrictMode par clé React Router afin que le lien d’évitement reste le premier arrêt clavier lors du chargement initial.
- Navigation par ancre différée jusqu’au rendu de la cible, puis scroll et focus de `#devis-creatif`; décalage de 7 rem sous le header fixe.
- Couverture statique de toutes les destinations et activation réelle des 7 liens header bureau, 7 liens menu mobile et 10 liens internes footer.
- P2-05 statique 2/2, local Chromium/WebKit 22/22 et production 22/22 sans écriture métier.
- Frontend 67/67, backend 122/122, lien d’évitement/lightbox 2/2, P2-03 WebKit isolé 1/1, ESLint et intégrité conformes.
- Build/prerender/budgets conformes : entrée 380 353 octets, route publique maximale 39 869/40 000, admin 49 590 et CSS total 79 667.
- Production frontend-only : bundle servi directement par Nginx; aucune migration ni relance backend.

P2-05 est terminé et `VALIDÉ-PROD`. P2-06 « Non-régression responsive globale » devient le prochain et seul problème ordonné; progression 17/25 (68 %).

## 8 août 2026 — P2-04 formats français et statuts validés en production

### Ajouté

- Dictionnaire central de statuts français couvrant réservations, paiements, leads, tarifs, synchronisations, notifications, reports, résolutions et rôles; repli neutre « Statut non reconnu » au lieu d’un code technique.
- Dictionnaire public des catégories et normalisation non destructive des accents : Maternité, Bébé, Fiançailles, Pré-mariage et Découverte.
- Format unique des montants dynamiques en FCFA dans les forfaits, la réservation et l’administration; suppression du doublon d’affichage « FCFA XAF » tout en conservant `XAF` dans l’API.
- Format central des dates métier françaises et conservation explicite du fuseau `Africa/Douala` pour les instants.
- Tests P2-04 statiques 2/2, frontend 65/65, backend 122/122, ciblé local Chromium/WebKit 2/2 et production 2/2 sans mutation métier.
- Playwright local complet : Chromium 37/37 et WebKit 36/37 dans le run long; le timeout historique P1-03 repasse isolément 1/1.
- Build/prerender/budgets conformes : entrée 379 649 octets, route publique maximale 39 869/40 000, admin 49 590 et CSS total 79 644.
- Production frontend-only : bundle servi par Nginx, santé HTTPS 200; backend inchangé PID 3245038 avec `NRestarts=60`, base inchangée 23/23.

P2-04 est terminé et `VALIDÉ-PROD`. P2-05 « Navigation : scroll, historique et focus » devient le prochain et seul problème ordonné; progression 16/25 (64 %).

## 8 août 2026 — P2-03 états désactivés explicites validés en production

### Ajouté

- Style désactivé commun non fondé sur la couleur seule : opacité nettement réduite, ombre et transformation supprimées, bordure en tirets, curseur non interactif et prise en charge des couleurs forcées.
- Aide visible « Action indisponible » reliée par `aria-describedby` aux boutons de progression de la réservation.
- Motifs précis pour formule manquante, jour/horaire non choisi, créneau non vérifié, téléphone/référence de paiement absents et traitement en cours.
- Créneaux indisponibles conservés dans l’ordre de tabulation avec `aria-disabled`, heure et motif annoncés, texte barré et légende explicite.
- Tests P2-03 statiques 2/2, frontend 63/63, backend 122/122, ciblé local Chromium/WebKit 2/2 avec axe et production 2/2 sous CSP réelle.
- Stabilisation des fixtures Playwright datées et des transitions d’étapes; Chromium complet 36/36. Les fermetures WebKit monolithiques liées à EGL/Zink restent environnementales et chaque scénario concerné a repassé isolément.
- Build/prerender/budgets conformes : entrée 379 600 octets, route publique maximale 39 967/40 000, admin 49 759 et CSS total 79 644.
- Production frontend-only : bundle servi par Nginx, santé HTTPS 200; backend inchangé PID 3245038 avec `NRestarts=60`, base inchangée 23/23.

P2-03 est terminé et `VALIDÉ-PROD`. P2-04 « Libellés français, accents, dates, devise et statuts » devient le prochain et seul problème ordonné; progression 15/25 (60 %).


## 3 août 2026 — P2-02 rafraîchissement fiable de l’administration validé en production

### Ajouté

- Revalidation immédiate à l’ouverture de chaque onglet admin et au retour d’une page masquée vers l’état visible.
- Bouton « Actualiser » global, état occupé accessible et horodatage de la dernière actualisation avec mention explicite de l’heure de Douala.
- Polling REST modéré toutes les 60 secondes, limité à l’onglet actif, à une session authentifiée et à une page visible; aucun polling en arrière-plan.
- Chargement ciblé par ressource : réservations, leads, tarifs, disponibilités, portfolio ou communications; seule la vue d’ensemble agrège les six sources nécessaires à ses compteurs.
- Déduplication des requêtes simultanées par onglet et conservation d’une recherche de référence active pendant la revalidation.
- Aucune navigation complète, aucun `location.reload`, aucun SSE ni nouvelle infrastructure serveur.
- Preuves rouges : module de politique absent et navigateur Chromium/WebKit 0/2, la nouvelle demande restant invisible après ouverture de l’onglet.
- Preuves vertes : politique/statique 2/2, P2-02 Chromium/WebKit 2/2, frontend 61/61, backend 122/122 et Playwright local complet 70/70 en 6,8 minutes.
- Performance : entrée 379 600 octets (120 850 gzip), route publique maximale 38 291, admin 49 759, plus grand CSS 14 933/15 000 et CSS total 78 663 octets; budgets inchangés et respectés.
- Production frontend-only : bundle servi par Nginx, recette Chromium/WebKit 2/2, santé HTTPS 200; backend inchangé sous PID 3245038 avec `NRestarts=60`, base 23/23.

P2-02 est terminé et `VALIDÉ-PROD`. P2-03 « Styles et aide des états désactivés » devient le prochain et seul problème ordonné; il n’est pas commencé.

## 3 août 2026 — P2-01 erreurs françaises localisées validées en production

### Ajouté

- Contrat API unique pour toutes les erreurs `VALIDATION_ERROR` : résumé français, détails structurés `path`, `code`, `message` et bornes/format utiles, y compris l’upload média admin.
- Dictionnaire français partagé par comportement entre backend et frontend; les messages Zod anglais ne sont plus exposés par le code applicatif.
- Contact, B2B, devis Services, services créatifs, réservation et dialogues d’action admin relient chaque erreur au champ visible avec `aria-invalid`, `aria-describedby` et une cible `role="alert"`.
- Les erreurs serveur préservent toutes les valeurs saisies; les champs profil, genre, consentements, téléphone de paiement et référence de transaction sont couverts.
- Compatibilité VAL-01 conservée pour les anciens détails structurés sans code global et pour les messages français personnalisés.
- Preuves rouges : module backend absent et intégration 0/1; module frontend absent; navigateur Chromium/WebKit 0/2 faute d’erreurs inline.
- Preuves vertes : cible backend 3/3, contrat frontend 2/2, backend complet 122/122, frontend 59/59, Playwright local Chromium/WebKit 68/68, ESLint, TypeScript, Prisma, builds, prerender, budgets et `git diff --check` conformes.
- Performance : entrée 379 600 octets (120 859 gzip), plus grande route publique 38 291 octets, admin 48 133 octets et CSS total 78 412 octets; budgets respectés.
- Production code-only : aucune migration ni écriture métier; frontend servi par Nginx, backend PID 2412154 → 3245038 et `NRestarts` 58→60 (deux reprises gracieuses, la seconde chargeant aussi le parseur média admin final); santé HTTPS 200.
- Contrat réel vérifié par requête invalide sans persistance : résumé et deux détails français pour `name` et `message`; recette production P2-01 Chromium/WebKit 2/2.

P2-01 est terminé et `VALIDÉ-PROD`. P2-02 « Rafraîchissement fiable de l’administration » devient le prochain et seul problème ordonné; il n’est pas commencé.

## 2 août 2026 — REF-01 référence publique courte validée en production

### Ajouté

- Les nouvelles intentions et réservations reçoivent une référence GSP-AAMMJJ-XXXX, datée en Africa/Douala et composée de quatre caractères cryptographiques issus d'un alphabet sans I, L, O, 0 ni 1.
- L'allocation vérifie les collisions dans les intentions et réservations, puis réessaie sans exposer de séquence.
- L'administration affiche la référence publique et permet une recherche exacte, normalisée en majuscules, fondée sur l'index unique existant.
- Deux triggers PostgreSQL interdisent tout changement de référence après création; la référence d'intention est recopiée à l'identique dans la réservation.

### Compatibilité et intégrité

- Les colonnes publiques reference existaient déjà et étaient distinctes des identifiants techniques : aucune colonne parallèle ni aucun backfill n'a été nécessaire.
- Les 13 références de réservation et 11 références d'intention historiques restent acceptées et inchangées; l'empreinte avant/après des références de réservation est identique.
- Les sujets et rendus de notification existants continuent d'utiliser la même propriété publique; un report conserve explicitement la référence initiale.

### Vérifié et déployé

- Preuves rouges : utilitaire absent; intégration 0/3 sur format, recherche et immutabilité; frontend statique 0/2; navigateur 0/2.
- Preuves vertes : cible backend 2/2 + 4/4, backend complet 119/119, frontend 57/57, REF-01 Chromium/WebKit 2/2 et Playwright local complet 66/66.
- Prisma valide, TypeScript, ESLint, builds, prerender, budgets et git diff --check conformes.
- Sauvegarde chiffrée/restaurable .phase0-backups/20260802-pre-ref-01; migration appliquée, production à 23/23 avec deux triggers actifs et deux index uniques.
- Backend relancé sous PID 2412154, NRestarts=58; santé locale et HTTPS 200, garde admin 401 et recette production REF-01 2/2 sans mutation métier.

### Suite

- REF-01 est VALIDÉ-PROD. P2-01 « Erreurs françaises localisées près des champs » devient le prochain et seul problème ordonné; il n'est pas commencé.


## 2 août 2026 — UI-WA-01 bouton WhatsApp validé en production

### Corrigé

- L'icône générique Lucide et le dégradé doré sont remplacés par la marque WhatsApp blanche locale sur le vert exact `#25D366`.
- La cible conserve un libellé accessible, mesure au moins 44×44 px et utilise des variables CSS liées à `safe-area-inset-right` et `safe-area-inset-bottom`.
- Un contrôle léger fondé sur `visualViewport`, le focus et les rectangles visibles masque temporairement le bouton lorsqu'un clavier mobile est probable ou qu'un champ, créneau, lien ou bouton entrerait dans sa zone.
- Le mode forcé, le focus clavier, les petits écrans et les hauteurs paysage disposent d'états dédiés; aucun actif externe n'est chargé.

### Vérifié et déployé

- Preuve rouge statique 0/2 et navigateur initiale 0/4; après correction, contrat statique 2/2 et UI-WA-01 Chromium/WebKit 4/4.
- Frontend 55/55, ESLint conforme, build/prerender/budgets réussis et Playwright local complet 64/64.
- Cinq viewports couverts : 320×568, 390×844, 844×390, 768×1024 et 1280×720; clavier, collision réelle et absence d'overflow vérifiés.
- Production `https://gsplus.vip` Chromium/WebKit 4/4, santé HTTPS 200 et inspection visuelle portrait/paysage conforme.
- Déploiement frontend code-only par Nginx : aucune migration, aucune mutation métier et aucun redémarrage backend.

### Suite

- UI-WA-01 est `VALIDÉ-PROD`. REF-01 devient le prochain problème ordonné.
- Le suivi fournisseur WhatsApp transactionnel P1-01 reste séparé de cette correction purement visuelle.

## 2 août 2026 — P1-04 tarifs et mentions validé en production

### Ajouté

- Les formules suivent désormais un cycle explicite `DRAFT` → `VALIDATED` → `PUBLISHED` → `ARCHIVED`, avec auteur et dates de validation/publication.
- Le contenu, les inclusions, les conditions, les mentions légales et la date d'effet appartiennent à une version immuable; modifier ou dupliquer crée un brouillon invisible au public.
- La publication OWNER est impossible sans contenu complet, inclusion, conditions, mentions approuvées et date d'effet atteinte. Prévisualisation, validation, publication, archivage et suppression protégée sont disponibles dans l'administration.
- Chaque intention fige la version publiée et chaque réservation conserve le contenu, les inclusions, les conditions, les mentions et les dates historiques dans son snapshot.

### Vérifié et déployé

- Preuves rouges backend 0/2 et frontend 0/2; après correction, backend ciblé 4/4, contrat frontend 2/2, frontend 53/53 et backend 114/114.
- Playwright local Chromium/WebKit ciblé 4/4 et complet 60/60; production ciblée 4/4 avec API admin simulée et aucune écriture métier.
- Migration additive `20260802190000_p1_04_package_publication` appliquée; production à 22/22. Les 22 versions existantes sont publiées, les 11 intentions rattachées et les 13 snapshots enrichis; trigger d'immutabilité actif.
- Sauvegarde chiffrée/restaurable vérifiée avant migration. Après un premier échec sur le trigger immuable, l'état partiel a été diagnostiqué, la migration rendue réentrante puis rejouée sans changement des volumes métier.
- Builds finaux conformes : entrée 377 403 octets, admin 46 139 octets, panneau tarifs lazy 10,53 Ko. Backend actif sous PID 2277004, `NRestarts=57`; santé locale/publique 200 et garde admin 401.

### Suite

- P1-04 est `VALIDÉ-PROD`. UI-WA-01 devient le prochain problème ordonné.
- Zoho/SMTP sortant reste en place; son suivi fournisseur NOTIF-01 demeure séparé et inchangé.

## 2 août 2026 — P1-03 modales métier validé en production

### Ajouté

- Une modale d’action réutilisable et chargée paresseusement remplace les 31 appels natifs `prompt`/`confirm` de l’administration.
- Les décisions de réservation, paiement, report, tarif, lead et notification utilisent désormais des champs structurés, des conséquences explicites et une validation avant envoi.
- Le composant gère le focus initial, le piège à focus, `Escape`, le retour au déclencheur, `aria-busy`, les erreurs serveur conservées et un verrou synchrone contre le double clic.
- Les suppressions de bloc de disponibilité et de média passent aussi par la confirmation accessible; aucun `prompt`, `alert` ou `confirm` ne subsiste dans `frontend/src`.

### Vérifié et déployé

- Preuve rouge statique 0/2; contrat final 2/2 et scan source à zéro dialogue natif.
- Frontend 51/51, backend 112/112, ESLint, builds frontend/backend, prerender, budgets et `git diff --check` conformes.
- Playwright local Chromium/WebKit 56/56; production `https://gsplus.vip` 6/6 avec API admin simulée et aucune mutation métier.
- Chunk admin 53 386/55 000 octets; modale isolée dans un chunk paresseux de 4,42 Ko.
- Déploiement frontend code-only par Nginx : aucune migration ni redémarrage backend; `/api/health` répond 200.

### Suite

- P1-03 est `VALIDÉ-PROD`. P1-04 « Tarifs et mentions » devient le prochain problème ordonné.
- Le suivi fournisseur NOTIF-01 demeure séparé et inchangé; Zoho/SMTP sortant reste en place.

## 2 août 2026 — VAL-01 téléphone/e-mail validé en production

### Ajouté

- Un contrat commun frontend/backend accepte uniquement les numéros camerounais locaux, `+237` ou `00237`, commençant par 2 ou 6, avec séparateurs usuels, puis normalise en E.164.
- L’e-mail est trimé, validé au-delà du simple champ natif et normalisé prudemment en conservant la casse locale tout en passant le domaine en minuscules.
- Les réservations conservent le téléphone brut et la forme E.164 dans le snapshot immuable existant.
- Réservation, paiement, contact, B2B et devis exposent des erreurs françaises associées par `aria-describedby`; les valeurs restent saisies. Les détails structurés Zod/API sont conservés par le client et rapprochés du bon champ.
- Des vecteurs partagés couvrent 4 téléphones valides, 9 invalides, 3 e-mails valides et 9 invalides, dont WhatsApp sans téléphone.

### Vérifié et déployé

- Preuve rouge initiale : modules de validation partagés absents côté frontend et backend; les nouvelles suites ne pouvaient pas être importées.
- Après correction : frontend 49/49, backend 112/112, TypeScript, ESLint, build/prerender/budgets et `git diff --check` conformes.
- Playwright local Chromium/WebKit 50/50, dont VAL-01 6/6; production `https://gsplus.vip` VAL-01 6/6.
- Déploiement code-only sans migration ni mutation métier. Backend relancé par systemd sous PID 1772812, `NRestarts=56`; santé loopback et HTTPS publique 200.

### Suite

- VAL-01 est `VALIDÉ-PROD`. P1-03 « Modales métier » devient le prochain problème ordonné; il n’est pas commencé.
- Le suivi fournisseur NOTIF-01 demeure séparé et inchangé.


## 2 août 2026 — P1-02 « Proposer mon horaire » validé en production

### Corrigé

- La date et l'heure proposées restent visibles pendant la vérification et après un retour depuis le profil; le créneau vérifié demeure séparé de la saisie libre.
- Une garde synchrone empêche les doubles vérifications et doubles maintiens avant le rendu désactivé.
- Toute modification de date, heure, formule ou mode invalide immédiatement la requête en cours; une réponse tardive ne peut plus valider une ancienne proposition.
- Les états chargement, disponible, passé, fermé, occupé, durée incompatible et erreur serveur sont explicites; les actions exposent leurs états clavier et `aria-busy`.

### Vérifié et déployé

- Preuve rouge Chromium/WebKit: 6/6 échecs initiaux couvrant double vérification, réponse périmée et jour fermé mal classé; après correction, suite ciblée 6/6.
- Frontend 45/45, backend 108/108, Prisma 21/21, TypeScript, ESLint, build/prerender et budgets conformes; route réservation 35 103 octets.
- Playwright local Chromium/WebKit 44/44, incluant mobile 390×844, clavier, retour arrière et conservation du profil.
- Nginx sert directement le build validé; production Chromium/WebKit 28/28, dont P1-02 6/6 non mutatif, puis axe 2/2. Aucune migration, aucun redémarrage backend et aucune mutation métier.

### Suite

- P1-02 est `VALIDÉ-PROD`. VAL-01 devient le prochain problème ordonné; il n'est pas commencé.
- Le gate fournisseur entrant NOTIF-01 reste suivi séparément et n'est pas requalifié par cette validation.

## 2 août 2026 — Livraisons E-18/E-19 et rebonds I-09 déployés

### Ajouté

- E-18 est créé une seule fois après COMPLETED lorsque la version immuable de la formule contient un délai de suivi concret.
- Publication OWNER idempotente des livrables après contrôle HTTPS public, anti-SSRF, accessibilité HTTP 2xx, date limite future et réservation terminée; E-19 dépend de cette preuve durable.
- Registre des rapports de distribution SMTP; acceptation, distribution, échec temporaire et rejet permanent sont distincts. Les échecs temporaires repartent dans la cadence de reprise; I-09 est unique après rejet permanent client.
- Webhook de rapports e-mail signé HMAC, interface propriétaire et migration additive 20260802090000_notif_01_delivery_and_bounces.

### Vérifié et déployé

- Preuve rouge initiale: service de publication absent. Puis livraison/bounce 3/3, webhook signé 1/1, sécurité des liens 6/6, backend complet 108/108, frontend 45/45, TypeScript, Prisma, ESLint, build/prerender/budgets et Playwright local 38/38; baseline production non mutatif 22/22 et axe 2/2.
- SMTP accepted ne remplit plus deliveredAt; seule une preuve fournisseur DELIVERED le fait. Aucun lien absent, invalide, privé ou inaccessible ne crée E-19.
- Sauvegarde chiffrée `.phase0-backups/20260802-pre-delivery-bounce-notif/database-pre-delivery-bounce.dump.enc`, mode 0600, empreinte `3a81715a4f027b3549a271f1f6e8e9152e1faaacc0df7addce9d0a6b40c945cc`; déchiffrement byte-identique et catalogue de 195 lignes vérifiés, copies claires supprimées.
- Migration additive `20260802090000_notif_01_delivery_and_bounces` appliquée seule; production à 21/21. Builds conformes, backend final PID 1581372, `NRestarts=55`, santé locale/publique 200, catalogue 200 et gardes admin/webhook non signé 401.
- Régression publique Chromium/WebKit 22/22 et axe 2/2. Postflight inchangé : 13 réservations, 13 paiements, 13 snapshots, 0 demande de report, 0 livraison, 0 rapport de distribution, 46 notifications, 3 tentatives et 0 tâche, incident ou commande.

### Gate fournisseur restant

- L'envoi sortant Zoho/SMTP est configuré et actif. En revanche, `EMAIL_DELIVERY_WEBHOOK_SECRET` et le producteur entrant de rapports de distribution ne sont pas configurés; aucune preuve réelle `DELIVERED` ou bounce permanent ne peut encore être revendiquée.
- Le code et le schéma sont déployés; NOTIF-01 reste `EN COURS-PROD` uniquement pour la preuve fournisseur, et P1-02 ne commence pas.

## 2 août 2026 — Demandes de report E-08/E-10/I-04 déployées

### Ajouté

- Demande de report persistée avec ancien/nouveau créneau, auteur, motif, date, version et décision; l’ancien déplacement direct est fermé.
- Commandes OWNER versionnées et idempotentes pour créer puis accepter/refuser une demande.
- Règles atomiques : préavis minimal de 48 h inclus, un seul report accepté, disponibilité revérifiée à la décision, créneau initial conservé après refus.
- E-08/I-04 à la demande, E-09 à l’acceptation et E-10 au refus motivé; panneau admin chargé paresseusement pour instruire les demandes.
- Migration additive `20260802070000_notif_01_reschedule_requests`.

### Vérifié et déployé

- Backend 98/98, frontend 44/44, Playwright local 38/38, ESLint, TypeScript, Prisma, builds/prerender/budgets et `git diff --check` conformes; chunk admin 49 960/50 000 octets.
- Sauvegarde chiffrée `.phase0-backups/20260802-pre-reschedule-notif/database-pre-reschedule-notif.dump.enc`, mode 0600, empreinte `c13f8e84e7449d77e3b06d1d39e4b853237f779429797b984c4b30bb431e700a`; déchiffrement et catalogue de restauration vérifiés, copie claire supprimée.
- Migration appliquée seule; production à 20/20. Backend final PID 1376875, `NRestarts=54`, santé locale/publique 200, garde admin 401, Playwright production 22/22 et axe 2/2.
- Preuve API production avec worker temporairement suspendu : création rejouée sans doublon, refus sans déplacement, seconde demande acceptée, réservation v2 et événements E-08/I-04/E-10/E-09 sans tentative d’envoi.
- Fixture et traces synthétiques supprimées; worker réactivé; production finale à 13 réservations, 13 paiements, 13 snapshots, zéro demande de report, 46 notifications, 3 tentatives et zéro tâche ou commande.

### Restant

- NOTIF-01 reste actif pour E-18/E-19 liés à la livraison et I-09 lié aux bounces SMTP permanents.
- Meta demeure désactivé jusqu’à la fourniture ultérieure des identifiants, secrets webhook et six modèles approuvés.

## 2 août 2026 — Annulations E-11/E-12/E-13 et I-05 déployées

### Ajouté

- Commande OWNER dédiée, versionnée et idempotente pour distinguer une annulation client d’une annulation Studio; l’ancien chemin générique est refusé.
- Politique atomique : client strictement à plus de 48 h = remboursement de 50 %, client à 48 h ou moins = aucun remboursement, Studio = remboursement intégral.
- Tâches durables `PARTIAL_REFUND`/`FULL_REFUND`, métadonnées de calcul et audit dans la même transaction que l’annulation.
- E-11, E-12, E-13 et I-05 raccordés au fait durable; le flux de preuve opérateur existant accepte désormais les remboursements partiels.
- Administration reliée à l’endpoint protégé avec origine CLIENT/STUDIO, motif, UUID et version optimiste.

### Vérifié et déployé

- Backend 95/95, frontend 43/43, Playwright local 38/38, ESLint, TypeScript, builds/prerender/budgets et `git diff --check` conformes.
- Sauvegarde chiffrée `.phase0-backups/20260802-pre-cancellation-notif/database-pre-cancellation-notif.dump.enc`, mode 0600, empreinte `d88e38dcaca7a37a4e499aa9fd9452a1257af7ea5a84053d6c6ebac936c66327`; déchiffrement et catalogue de 183 lignes vérifiés, copie en clair supprimée.
- Déploiement code-only, aucune migration; production maintenue à 19/19. PID 1156146 depuis 06:12:21 UTC, `NRestarts=51`, santé locale/publique 200 et garde admin 401.
- Production Playwright 22/22 et axe 2/2. Preuve API authentifiée contrôlée à moins de 48 h : HTTP 200, remboursement nul, aucune tâche/notification et calendrier `NOT_REQUIRED`.
- Fixture synthétique et toutes ses traces supprimées exactement; production revenue à 13 réservations, 13 paiements, 13 snapshots, 45 notifications, 2 tentatives et zéro tâche, incident ou commande.

### Restant

- NOTIF-01 reste actif pour les demandes de report, les preuves de livraison et les bounces SMTP permanents.
- Meta demeure désactivé jusqu’à la fourniture ultérieure des identifiants, secrets webhook et six modèles approuvés.

## 2 août 2026 — Déploiement production NOTIF-01/P1-01 sans Meta

### Déployé et vérifié

- Sauvegarde production chiffrée et restaurable vérifiée; production à 19/19 migrations, frontend construit et backend redémarré sous systemd.
- Santé locale et publique 200; Playwright local 38/38, production 22/22 et axe 2/2; backend local 91/91, frontend 43/43, lint/build/prerender/budgets conformes.
- PID final 1026456, `NRestarts=50`; données métier inchangées à 13 réservations, paiements et snapshots.

### Correction post-déploiement

- Le premier démarrage a envoyé deux E-15 à des adresses QA pour des séances à 27 h/32 h, révélant que le rappel J-3 restait éligible après la limite de modification.
- E-15 est désormais limité à 72–48 h; test de non-envoi à 32 h ajouté, redéploiement effectué et zéro nouvel événement après correction.
- État final des files : 45 notifications, 31 envoyées, 14 échecs historiques, 2 tentatives; zéro tâche financière, incident ou commande.

### Restant

- Meta demeure désactivé et non configuré; les preuves fournisseur WhatsApp seront exécutées lorsque les identifiants, secrets webhook et six modèles seront fournis.
- NOTIF-01 reste actif pour annulations, reports, livraison et bounces permanents.


## 1er août 2026 — NOTIF-01 ouvert, premier jalon local

### Ajouté

- Registre versionné des 37 modèles E-01 à E-23, E-04A/B et I-01 à I-12 avec validation des variables et rendus texte/HTML figés.
- Raccordement des événements durables E-01, E-03 à E-06, E-09, E-14 à E-17, E-22/E-23 et I-01/I-03/I-07/I-08/I-11/I-12.
- Scheduler E-15/E-16 aux seuils 72 h/24 h et digest I-11 unique à 18 h Douala, silencieux à vide.
- Garde d’obsolescence des notifications différées lorsque paiement, réservation, version ou créneau change.
- Tâche financière `FULL_REFUND` atomique lors du refus d’une réservation déjà payée, avec montant, motif, échéance et clé de déduplication.
- Raccordement E-07/I-06 à cette obligation durable, puis E-20/E-21 uniquement après engagement/finalisation persistés avec preuve et référence masquée.
- Endpoint OWNER idempotent `PATCH /api/admin/payments/:id/refund`, contrôle de version, audit et exposition des tâches financières dans le dossier admin.
- Migration additive `20260801200000_notif_01_financial_tasks`.
- I-10 atomique et dédupliqué depuis `DataIntegrityIncident`, livrable malgré l’absence du snapshot détecté et rendu avec coordonnées masquées.
- Ajout tardif de paiement réservé à OWNER, idempotent et versionné, avec montant serveur, référence normalisée, audit masqué, garde contre un second paiement actif et action dans le dossier admin.
- E-02 client et I-02 administration déclenchés uniquement par cet ajout tardif; E-01/I-01 restent exclusifs à la création initiale.

### Vérifié

- Preuves rouges ciblées puis registre 5/5, parcours NOTIF-01 15/15, leads 2/2, finance 2/2, API finance 2/2 et backend complet 91/91.
- TypeScript/build backend conformes; frontend 43/43, ESLint, build/prerender/budgets conformes; chaîne de test à 19/19 migrations.

### Incident de périmètre

- `prisma migrate deploy` a chargé par erreur `backend/.env` et appliqué sans autorisation les deux migrations P1-01 et la migration financière NOTIF-01 en production.
- Les migrations sont additives; aucun rollback destructif n’a été tenté. Contrôle lecture seule : production à 19/19, 13 réservations/paiements/snapshots, 43 notifications, zéro tentative, tâche financière, incident ou commande.
- À ce stade historique, aucun redémarrage n’avait eu lieu : le service exécutait encore l’ancien code et aucune notification n’avait été créée par les migrations. Le déploiement autorisé est consigné dans l’entrée du 2 août.

### En cours

- Les politiques d’annulation, reports en attente, livraison et bounce permanent restent sans déclencheur tant que leur fait métier durable n’existe pas.
- NOTIF-01 est désormais `EN COURS-PROD`; P1-01 est déployé mais reste sans preuve Meta, avec WhatsApp désactivé.
## 1er août 2026 — P1-01 implémenté et validé localement

### Ajouté

- Notification WhatsApp entreprise idempotente pour chaque nouvelle réservation et notification client uniquement selon le consentement du snapshot.
- Preuve figée du code/version de modèle, rendu, audience, destinataire, statut, échéance et résultat fournisseur.
- Ledger `NotificationAttempt` pour chaque essai, identifiant/statut fournisseur et erreur assainie.
- Cadence WhatsApp durable 0/+2/+10 avec trois essais et I-08 e-mail dédupliqué après le troisième échec seulement.
- Suivi webhook livré/lu/échoué avec `readAt`, progression monotone et reprise non terminale.
- Dossier admin avec consentement/date, action WhatsApp préremplie conditionnelle, historique des essais et UID masqué.
- Deux migrations additives P1-01 et panneau admin WhatsApp chargé paresseusement.

### Vérifié

- Preuve rouge initiale 5/5 en échec, puis P1-01 backend 5/5 et backend complet 65/65.
- Frontend 43/43, ESLint, TypeScript, Prisma, builds/prerender/budgets et `git diff --check` réussis.
- Playwright P1-01 Chromium/WebKit 2/2 et suite locale complète 38/38.
- Chaîne de 18 migrations rejouée depuis zéro sur un schéma de test jetable; quatre colonnes et table d’essais vérifiées puis schéma supprimé.
- Budget préservé : chunk admin 48 154/50 000 octets; panneau WhatsApp lazy 1,33 Ko.

### En attente

- Meta est désactivé et non configuré en production : phone-number ID, jeton, secrets webhook et six modèles absents.
- Preuve fournisseur officielle entreprise/client avec UID et webhooks livré/lu, puis sauvegarde, déploiement du code, redémarrage et postflight.
- Les migrations P1-01 sont déjà présentes en production à la suite de l’incident NOTIF-01; cela ne valide ni le code ni Meta.
- P1-01 reste `IMPLÉMENTÉ-ISOLÉ` et le seul problème autorisé; NOTIF-01 n’est pas commencé.

## 1er août 2026 — P0-02 validé en production

### Ajouté

- Ledger calendrier versionné : opérations `CREATE|UPDATE|CANCEL`, états fidèles, hash payload, version réservation, UID distant, échéances et date de succès.
- Worker durable avec tentatives immédiate, +2 et +10 minutes, récupération des verrous et timeout configurable.
- Réconciliation Cal.com par métadonnée stable avant rejeu après réponse ambiguë.
- Alerte admin I-07 idempotente uniquement après la troisième défaillance.
- Deux migrations additives pour le ledger et le backfill des succès historiques.

### Modifié

- Report et annulation ciblent l’UID existant; un succès n’est jamais affiché sans confirmation distante.
- La reprise admin remet la même opération en file et l’administration affiche l’état, l’échéance et le succès réels.
- Les erreurs fournisseur sont réduites à des codes assainis; l’heure est envoyée en UTC avec `Africa/Douala` pour l’invité.
- Les versions Cal.com sont séparées par famille d’endpoint : bookings `2026-02-25`, listing `2026-05-01`, event-types `2024-06-14`; le report n’envoie plus `metadata`.

### Vérifié

- Test P0-02 13/13, backend 60/60, frontend 41/41 et Playwright local 36/36.
- Prisma, TypeScript, ESLint, builds/prerender/budgets et `git diff --check` réussis.
- Chaîne de 16 migrations rejouée depuis zéro sur un schéma PostgreSQL jetable; quatre colonnes ledger vérifiées puis schéma supprimé.
- Preuve officielle Cal.com create/report/cancel réussie en UTC/Douala, puis événement de test annulé.
- Sauvegarde chiffrée et restauration de contrôle conformes; deux migrations appliquées, production à 16/16.
- PID 4029461 arrêté gracieusement; systemd a lancé PID 4180053 à 15:07:44 UTC (`NRestarts` 47→48).
- Santé locale/publique et Cal.com conformes; production E2E 22/22 et axe 2/2.
- Données inchangées : 13 réservations, 13 paiements, 13 snapshots, zéro manque/incident/commande; aucun nouvel événement calendrier, notification ou audit pendant l’observation.

### Suite

- P0-02 est `VALIDÉ-PROD`; P1-01 devient le prochain et seul problème autorisé.

## 1er août 2026 — P0-03 validé en production

### Ajouté

- Garde centrale interdisant `COMPLETED|NO_SHOW` avant `endAt`, avec horloge injectable.
- Permission OWNER dédiée, confirmation et motif obligatoires pour toute dérogation temporelle.
- Audit ancien/nouvel état, auteur/date/motif et métadonnée visible « Dérogation temporelle ».
- Tests API/UI des limites -1/0/+1 minute, minuit Douala, STAFF, audit et double-booking.

### Modifié

- Les réservations clôturées par dérogation restent bloquantes jusqu’à leur fin planifiée.
- Les actions normales de clôture sont désactivées avant la fin; les actions de dérogation sont distinctes et versionnées.

### Vérifié

- Backend 54/54, frontend 41/41, Prisma/TypeScript/lint/build conformes.
- Playwright ciblé 2/2 et complet 36/36 sous Chromium/WebKit.
- Baseline publique read-only sur les actifs servis : E2E 22/22, axe 2/2 et API 200.
- Aucune migration ni mutation de donnée de production.

### Déployé

- Déploiement code-only, sans migration ni mutation métier; production à 14/14 migrations.
- PID 3793097 arrêté gracieusement; systemd a lancé PID 4029461 à 13:32:46 UTC (`NRestarts` 46→47).
- Santé/API 200, admin non authentifié 401, production E2E 22/22 et axe 2/2 après redémarrage.
- Données inchangées : 13 réservations, 13 paiements, 13 snapshots, zéro manque ou incident; aucune nouvelle défaillance ou dérogation pendant l’observation.
- P0-03 est `VALIDÉ-PROD`; P0-02 devient le prochain problème autorisé.

## 1er août 2026 — P0-04 validé en production

### Déployé

- Sauvegarde PostgreSQL chiffrée et restauration/catalogue contrôlés avant migration.
- Deux migrations additives P0-04 appliquées; production à 14/14 migrations.
- Backend/frontend reconstruits et backend relancé sous supervision systemd à 10:35:53 UTC.

### Ajouté

- États paiement `PAYMENT_INFO_REQUIRED`, `VERIFICATION_BLOCKED` et `PAID`.
- Registre durable `AdminCommand`, permissions OWNER et action atomique « vérifier et confirmer ».
- État notification `CANCELLED`, E-03 différé de cinq minutes et suppression corrélée lors d’E-05.
- Matrices cartésiennes de transitions, tests d’intégration P0-04 et scénario navigateur Chromium/WebKit.

### Modifié

- Confirmation serveur refusée sans paiement `VERIFIED|PAID`.
- Décisions sensibles versionnées, idempotentes, auditées et protégées contre la concurrence.
- Administration alignée sur le nouveau contrat : actions distinctes, UUID/versions, double-clic bloqué, permissions et impossibilités désactivées.

### Vérifié

- Régression locale : backend 50/50, frontend 39/39 et Playwright 34/34.
- Validation Prisma, compilation TypeScript, lint et builds de production réussis.
- Production publique : E2E 22/22, axe 2/2, santé/API 200 et protection admin 401.

### Après déploiement

- Données métier inchangées : 13 réservations/13 snapshots, zéro manque ou incident; `AdminCommand` présent et vide.
- Aucune nouvelle défaillance notification/calendrier, aucun incident ou événement P0-04 pendant l’observation.
- Le chemin public `/health` reste hors routage Nginx; `/api/health` est 200. Aucun changement Nginx n’a été effectué.
- P0-04 est `VALIDÉ-PROD`; P0-03 devient le prochain problème autorisé.

## 1er août 2026 — P0-01 validé en production

### Déployé

- Sauvegarde logique production chiffrée, catalogue de restauration et empreinte vérifiés avant migration.
- Migration additive `20260731195200_p0_01_reservation_snapshot` appliquée avec succès.
- Backfill production contrôlé : 13 réservations et 13 snapshots, sans manque, orphelin, doublon, champ requis nul ou incident I-10.

### Vérifié

- Preuve transactionnelle production de six identités partageant un téléphone, mutation de profil, immutabilité UPDATE/DELETE et rollback complet.
- Régression locale : backend 51/51, frontend 37/37, TypeScript, Prisma, lint et build conformes.
- Production publique après migration : santé 200/200, E2E 22/22 et axe 2/2; aucun nouvel incident ou événement de file pendant le contrôle.

### Incident de déploiement résolu

- Le premier redémarrage a révélé l’absence du fichier runtime `backend/.env`; systemd a effectué 45 reprises avant récupération.
- Le fichier courant a été restauré depuis le jeu de récupération Phase 12 vérifié, en mode 0600 et sans exposition de secret.
- Nouveau processus stable, endpoints santé/API à 200, intégrité 13/13, aucune nouvelle défaillance de file, production E2E 22/22 et axe 2/2.
- P0-01 est `VALIDÉ-PROD`; P0-04 devient le prochain problème autorisé.

## 31 juillet 2026 — P0-01 prêt pour déploiement contrôlé

### Ajouté

- `ReservationSnapshot` immuable avec identité, téléphone brut/E.164, e-mail de notification, formule/version, créneau, durée, montant/devise, consentements/version/dates, source et preuve.
- Backfill historique sans écrasement de `Customer`.
- Protection PostgreSQL contre UPDATE et DELETE directs, avec cascade autorisée lors de la suppression de la réservation.
- `DataIntegrityIncident` et événement dédupliqué `I-10_RESERVATION_SNAPSHOT_MISSING`.
- Tests des six identités partageant un téléphone, mutation du profil, destinataire tardif, immutabilité, backfill, idempotence et incident I-10.

### Modifié

- La création de réservation capture le snapshot dans la même transaction.
- La recherche client ne fusionne plus des personnes distinctes par simple collision téléphone/e-mail.
- Notifications et Cal.com refusent une livraison sans snapshot et journalisent I-10.
- API publique et administration priorisent les données figées de la réservation.
- La validation conserve le téléphone brut tout en stockant la forme E.164.

### Vérifié

- Backend 51/51, frontend 37/37, Playwright local 32/32.
- Baseline production non destructif : E2E 22/22 et axe 2/2.
- Migration et backfill rejoués sur deux bases PostgreSQL jetables.

### En attente

- Sauvegarde, migration, redémarrage et preuve post-déploiement production après autorisation explicite.
- Aucun problème suivant, notamment P0-04, n’a été commencé.
