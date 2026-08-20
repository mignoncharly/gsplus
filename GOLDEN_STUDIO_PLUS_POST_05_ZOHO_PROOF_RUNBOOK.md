# Runbook supervisé POST-05 — Zoho et preuves I-09/I-11/I-12

> **ÉTAT COURANT — 11 août 2026** — E-22 et I-12 ont été créés une seule fois, livrés par le fournisseur et confirmés reçus humainement par l’OWNER. I-11 est livré 9/9 côté fournisseur et sa réception humaine, son contenu et son horaire ont été confirmés. Ne rejouer aucun de ces messages et ne créer aucun lead. Conserver `I-09 TECHNICALLY OBSERVED` et `I-09 CONTROLLED TEST DEFERRED`; aucun nouveau hard bounce n’est requis. Les sections ci-dessous décrivent l’historique de préparation.

État : `ACTIVÉ-PROD — PREUVES PARTIELLES` au 9 août 2026. Le poller EU est actif et I-11 est rapproché côté fournisseur; I-09 et I-12 restent à prouver par leurs scénarios QA.

Ce document n'autorise aucun envoi. Il sépare la preuve immédiate des messages internes et le choix d'intégration nécessaire pour les rapports de livraison.

## État vérifié

- Fournisseur actif : Zoho Mail SMTP, pas ZeptoMail.
- I-11 : sept événements `SENT` du 2 au 8 août à 17:00 UTC, soit 18 h Douala; sept tentatives acceptées par SMTP, aucun `deliveredAt`.
- I-09 : zéro événement, zéro rapport fournisseur.
- I-12 : zéro événement; huit leads historiques non touchés.
- Webhook interne : secret absent et validation fermée par défaut.
- Tests ciblés : quatre fichiers, 21/21 tests verts.

## Écart d'intégration fournisseur

Le point d'entrée actuel accepte un rapport normalisé contenant `providerEventId`, `providerMessageId`, `status`, `smtpCode` et `occurredAt`, signé par `x-gsplus-signature-256`.

Zoho Mail documente :

- les statuts de livraison dans les messages envoyés : https://www.zoho.com/mail/help/email-status.html ;
- les Delivery Logs filtrables par Message-ID et exportables : https://www.zoho.com/mail/help/adminconsole/log-reports.html ;
- une API SMTP Logs en lecture, avec organisation Zoho et portée OAuth `ZohoMail.partner.organization.READ` : https://www.zoho.com/mail/help/api/get-smtp-logs.html .

ZeptoMail documente des webhooks de bounce pour les envois SMTP, mais son payload `event_name`/`event_message` et sa signature `producer-signature` nécessitent un adaptateur dédié : https://www.zoho.com/zeptomail/help/webhooks.html .

## Choix OWNER enregistré

La voie A est sélectionnée le 9 août 2026 : Zoho Mail est conservé. La voie B reste documentée uniquement comme solution de repli.

### Voie A — conserver Zoho Mail — SÉLECTIONNÉE

1. Confirmer que le compte permet l'API SMTP Logs et la portée OAuth en lecture seule.
2. Fournir hors Git l'identifiant d'organisation et les éléments OAuth minimaux.
3. Autoriser l'implémentation d'un poller borné recherchant uniquement les Message-ID Golden Studio Plus.
4. À défaut d'accès API, accepter une preuve manuelle exportée des Delivery Logs; cette preuve ne rendra toutefois pas I-09 automatique.

### Voie B — ZeptoMail transactionnel — NON SÉLECTIONNÉE

1. Créer/approuver un Agent ZeptoMail et ses domaines expéditeurs.
2. Fournir hors Git les identifiants SMTP et la clé d'authentification webhook.
3. Autoriser la bascule SMTP et l'adaptateur `producer-signature`/payload Zoho.
4. Tester d'abord le webhook officiel soft/hard bounce avant tout envoi QA réel.

Aucune voie ne sera sélectionnée implicitement et aucun secret ne sera committé.

## Autorisation de preuve attendue

L'OWNER doit confirmer :

1. la boîte QA client contrôlée et la boîte opérationnelle où I-11/I-12 seront vérifiés;
2. l'autorisation d'une soumission CONTACT ou B2B QA produisant l'accusé client et I-12;
3. l'autorisation d'un hard bounce contrôlé pour I-09, soit via le test officiel du fournisseur, soit vers une adresse inexistante d'un domaine possédé et prévu pour ce test;
4. la voie fournisseur A ou B ci-dessus et les accès associés fournis hors dépôt.

## Exécution après levée des gates

- I-11 : rapprocher un événement existant de son Message-ID dans la boîte opérationnelle et dans les Delivery Logs; aucune nouvelle génération forcée n'est nécessaire.
- I-12 : soumettre un seul lead QA avec une clé idempotente, vérifier l'accusé client et exactement une alerte interne, puis rejouer la même requête et confirmer zéro doublon.
- I-09 : provoquer uniquement le hard bounce contrôlé, rattacher le rapport au Message-ID, vérifier exactement un `EmailDeliveryReport` et un I-09 malgré rejeu; vérifier zéro I-09 sur succès et échec temporaire.
- Postflight : laisser la file stable, expliquer le seul delta QA attendu, préserver les événements/leads historiques et archiver uniquement des preuves expurgées.

## Probe OAuth disponible

Commande : `cd backend && npm run email:zoho-smtp-logs:check`.

Préparer hors Git :

- `ZOHO_MAIL_ORG_ID` : identifiant numérique de l'organisation;
- `ZOHO_MAIL_OAUTH_ACCESS_TOKEN` : token d'une heure avec la portée exacte `ZohoMail.partner.organization.READ`;
- `ZOHO_MAIL_API_BASE_URL` seulement si le compte n'est pas dans le datacenter US;
- `ZOHO_MAIL_SMTP_LOGS_PROBE_MESSAGE_ID` est facultatif : le dernier I-11 est sélectionné en lecture seule par défaut.

Le probe interroge un seul Message-ID sur 14 jours, limite la réponse à un enregistrement et ne restitue que `accessConfirmed`, les codes HTTP/fournisseur, le nombre de correspondances et l'indicateur de pagination. Il n'affiche jamais le token, le destinataire, le sujet ou le contenu du journal.

État vérifié avant accès : tests dédiés 4/4, backend 156/156, build vert; sans Organization ID, arrêt avant appel réseau. L'accès réel n'est confirmé que si le probe renvoie `accessConfirmed: true`.
## OAuth EU validé et poller disponible — 9 août 2026

Le probe réel et expurgé a confirmé toute la chaîne : refresh OAuth, organisation correspondante et requête SMTP Logs HTTP 200. Cette organisation Zoho Mail Free dispose empiriquement de l'API. Deux transactions `delivered` / `MAILBOX DELIVERY` ont été observées sur 24 heures; aucune adresse ni aucun identifiant complet n'a été affiché ou archivé.

Le poller implémenté :

- renouvelle le token via `https://accounts.zoho.eu` et ne le conserve qu'en mémoire;
- revalide le `zoid` avant utilisation d'un nouveau token;
- interroge `https://mail.zoho.eu` avec timestamps Unix en millisecondes et pagination bornée;
- ne rapproche que les Message-ID et destinataires déjà présents dans `NotificationEvent`;
- hache l'identité de transaction avant stockage comme `providerEventId`;
- laisse Zoho gérer les reprises 4xx, sans nouvel envoi applicatif ni I-09;
- produit I-09 uniquement par le gestionnaire existant lors d'un échec permanent E-xx;
- ignore pour l'état courant tout rapport plus ancien que `lastWebhookAt`.

Configuration nouvelle, toujours hors Git pour les valeurs sensibles : `ZOHO_MAIL_CLIENT_ID`, `ZOHO_MAIL_CLIENT_SECRET`, `ZOHO_MAIL_REFRESH_TOKEN`, `ZOHO_MAIL_ORG_ID`, les deux bases EU et les bornes du poller. L'activation exige explicitement `ZOHO_MAIL_SMTP_LOGS_SYNC_ENABLED=true`. La valeur d'exemple et le défaut restent `false`.

### Activation supervisée restante

1. Capturer les compteurs production et une sauvegarde restaurable avant le premier cycle.
2. Déployer le build avec le flag encore à `false`.
3. Choisir temporairement une fenêtre couvrant les événements I-11 à rapprocher, dans la limite de rétention Zoho.
4. Activer le flag et redémarrer le service; vérifier un seul cycle, les rapports créés, les statuts et l'absence de réémission e-mail.
5. Rejouer le cycle pour prouver zéro doublon, puis exécuter séparément les preuves QA autorisées I-09 et I-12.

État actuel : code et tests prêts, worker non activé, aucune mutation de rapport production, aucun e-mail réel envoyé. POST-05 reste ouvert jusqu'aux preuves supervisées.
## Activation production exécutée — 9 août 2026

- Sauvegarde PostgreSQL chiffrée et restaurable vérifiée avant écriture; copie de l'environnement pré-activation conservée en mode 0600.
- Dry-run 14 jours : 51 transactions, 18 livraisons rapprochables, aucun échec permanent rapproché.
- Premier cycle : 18 `EmailDeliveryReport DELIVERED`; les 8 I-11 existants ont reçu `deliveredAt`.
- Rejeu immédiat : zéro rapport supplémentaire et compteurs inchangés.
- Poller actif toutes les cinq minutes sur une fenêtre de 14 jours, API et Accounts EU, pagination 100 × 10 pages maximum.
- Backend relancé proprement, santé 200, aucun échec Zoho journalisé.
- Invariants : 55 notifications avant/après, zéro I-09/I-12, zéro e-mail prêt ou en traitement; aucun e-mail de test envoyé.
- Écart restant : un Message-ID suivi sans confirmation et 16 libellés fournisseur `failure` non classés faute de code SMTP/statut terminal fiable.

La preuve I-11 côté fournisseur est acquise. POST-05 ne sera clos qu'après le hard bounce QA I-09, la soumission QA I-12 et les contrôles de réception/déduplication correspondants.
