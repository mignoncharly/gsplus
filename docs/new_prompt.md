# MISSION PRINCIPALE — GOLDEN STUDIO PLUS

Tu travailles directement sur le dépôt du projet Golden Studio Plus.

Ton objectif est de produire, puis d’exécuter, un plan d’implémentation complet permettant de résoudre intégralement tous les problèmes, incohérences, risques et exigences décrits dans les trois documents de référence suivants :

1. `Rapport_unifie_audit_Golden_Studio_Plus_2026-07-29.docx`
2. `Bibliotheque_emails_Golden_Studio_Plus_2026-07-30_v2.docx`
3. `Textes_juridiques_Golden_Studio_Plus_2026-07-31.docx`

Ces trois documents constituent ensemble la spécification fonctionnelle, métier, juridique, technique et éditoriale officielle du projet.

Tu dois commencer par les lire intégralement, jusqu’à leur dernière page, y compris :

- tous les paragraphes ;
- tous les tableaux ;
- toutes les notes de mise en œuvre ;
- tous les critères de sortie ;
- tous les critères d’acceptation ;
- tous les modèles d’e-mails E-01 à E-23 ;
- toutes les variantes, notamment E-04A et E-04B ;
- tous les modèles internes I-01 à I-12 ;
- toutes les règles de notification ;
- toutes les règles de déduplication ;
- toutes les règles temporelles ;
- toutes les exigences juridiques ;
- toutes les règles relatives aux consentements ;
- toutes les captures et observations d’audit ;
- tous les résultats conformes à préserver ;
- tous les scénarios de non-régression.

Ne commence aucune modification du code avant d’avoir terminé cette lecture et inspecté l’architecture réelle du dépôt.

---

# 1. RÈGLE ABSOLUE DE TRAVAIL SÉQUENTIEL

Tu dois traiter les problèmes strictement un par un.

Il est interdit de commencer l’implémentation d’un nouveau problème tant que le problème actuellement traité n’est pas :

1. entièrement analysé ;
2. entièrement implémenté ;
3. couvert par des tests automatisés ;
4. testé en prod ;
5. testé au niveau intégration lorsque cela s’applique ;
6. contrôlé contre les documents de référence ;
7. vérifié contre les critères de sortie ;
8. vérifié contre les risques de régression ;
9. documenté ;
10. présenté à l’utilisateur avec les preuves de réussite ;
11. explicitement approuvé par l’utilisateur.

Après chaque problème, tu dois t’arrêter.

Tu dois présenter le résultat du problème traité et demander explicitement :

« Le problème [identifiant et intitulé] est entièrement implémenté et testé. Approuvez-vous cette correction afin que je passe au problème suivant ? »

Sans approbation explicite, tu ne passes pas au problème suivant.

Ne regroupe jamais plusieurs problèmes dans une même étape d’approbation, même lorsqu’ils touchent les mêmes fichiers.

Une dépendance technique strictement indispensable peut être préparée, mais elle ne doit pas servir à implémenter à l’avance le problème suivant.

---

# 2. INTERDICTIONS

Il est interdit de :

- laisser des placeholders ;
- écrire du pseudo-code à la place d’une implémentation ;
- ajouter des TODO, FIXME ou commentaires indiquant un travail futur ;
- créer des fonctions vides ;
- créer des composants non connectés au système réel ;
- simuler une réussite dans l’interface lorsque l’opération réelle a échoué ;
- déclarer une correction terminée sans preuve ;
- ignorer un problème sous prétexte qu’il dépend d’un service externe ;
- remplacer une intégration réelle existante par une simulation ;
- inventer des identifiants, secrets, jetons ou résultats externes ;
- supprimer silencieusement une fonctionnalité pour éviter de la corriger ;
- modifier les règles métier sans justification issue des documents ;
- modifier les textes juridiques sans conserver leur sens ;
- confirmer une réservation automatiquement après validation du paiement ;
- annoncer un paiement, une réservation, un remboursement, une livraison ou une synchronisation qui n’est pas réellement enregistré dans l’état correspondant ;
- utiliser `window.prompt()`, `window.alert()` ou `window.confirm()` pour les opérations administratives métier ;
- envoyer de données sensibles, de références intégrales de paiement, de secrets ou de mots de passe dans les e-mails et journaux ;
- considérer un test unitaire isolé comme preuve suffisante d’un parcours de bout en bout ;
- exécuter des tests destructifs sur la production ;
- modifier les résultats déjà conformes sans test de non-régression.

Lorsque des secrets ou accès externes sont déjà configurés dans l’environnement, utilise-les sans jamais les afficher.

Lorsqu’une vérification externe nécessite une action humaine, implémente et teste entièrement tout ce qui peut l’être, fournis les preuves techniques disponibles, puis indique précisément l’unique contrôle externe restant à effectuer. Ne qualifie jamais une intégration externe de réussie sans preuve réelle du fournisseur.

---

# 3. INSPECTION INITIALE OBLIGATOIRE

Avant de rédiger le plan d’implémentation, inspecte le dépôt afin d’identifier précisément :

- le framework frontend ;
- le framework backend ;
- le système de routage ;
- la base de données ;
- l’ORM ou la couche d’accès aux données ;
- les migrations existantes ;
- les modèles Reservation, Customer, Payment, Notification, CalendarSync, Price, Lead, Contact, B2B ou équivalents ;
- le mécanisme d’authentification administrateur ;
- les rôles et permissions ;
- les services d’e-mail ;
- l’intégration Zoho ou SMTP ;
- l’intégration WhatsApp ;
- l’intégration Cal.com ;
- les tâches différées et files de messages ;
- les cron jobs et planificateurs ;
- les journaux applicatifs ;
- les journaux d’audit ;
- les composants de formulaire ;
- les composants de modale ;
- les règles de validation client et serveur ;
- les tests existants ;
- les fixtures ;
- les scripts de déploiement ;
- les variables d’environnement ;
- le fuseau horaire actuellement appliqué ;
- la gestion des dates en base ;
- le système de génération des références ;
- la gestion des consentements ;
- les pages juridiques ;
- les mécanismes de gestion des tarifs ;
- le comportement responsive ;
- la configuration de production.

Exécute ensuite les commandes existantes de :

- compilation ;
- lint ;
- vérification des types ;
- tests unitaires ;
- tests d’intégration ;
- tests end-to-end ;
- vérification des migrations.

Enregistre l’état initial afin de distinguer :

- les erreurs déjà présentes ;
- les erreurs introduites par une correction ;
- les tests qui passent avant intervention ;
- les tests qui échouent avant intervention.

Ne masque pas les erreurs préexistantes.

---

# 4. LIVRABLE INITIAL : PLAN D’IMPLÉMENTATION COMPLET

Avant toute modification du code, crée à la racine du dépôt :

`GOLDEN_STUDIO_PLUS_IMPLEMENTATION_PLAN.md`

Ce fichier doit être concret, spécifique au dépôt et immédiatement exécutable.

Il ne doit contenir aucun placeholder.

Il doit inclure :

## 4.1 Cartographie des exigences

Pour chaque exigence des trois documents, indique :

- identifiant ;
- document source ;
- page ou section ;
- problème ou règle ;
- priorité ;
- impact métier ;
- impact juridique éventuel ;
- composants actuels concernés ;
- tables et colonnes concernées ;
- routes API concernées ;
- écrans concernés ;
- services externes concernés ;
- migrations nécessaires ;
- tests nécessaires ;
- critère de réussite ;
- preuve attendue.

## 4.2 Matrice de traçabilité

Construis une matrice reliant :

`Exigence documentaire → Problème → Modification de code → Migration → Test → Preuve → Statut`

Aucune exigence ne doit rester sans action ou justification.

## 4.3 Ordre d’implémentation

Respecte en priorité l’ordre suivant, tout en tenant compte des dépendances réelles du dépôt :

### Phase P0 — Intégrité et sécurité métier

1. P0-01 — Immutabilité des coordonnées et consentements par réservation.
2. P0-04 — Interdiction de confirmer avant vérification manuelle du paiement.
3. P0-03 — Protection du cycle temporel et des créneaux futurs.
4. P0-02 — Synchronisation Cal.com fiable et fidèle.

### Phase P1 — Flux opérationnels

5. P1-01 — WhatsApp transactionnel et opérationnel.
6. Système complet des e-mails E-01 à E-23 et I-01 à I-12.
7. P1-02 — Réparation de « Proposer mon horaire ».
8. Validation téléphone et e-mail côté client et serveur.
9. P1-03 — Remplacement de tous les `prompt()`.
10. P1-04 — Versionnement et validation des mentions obligatoires des tarifs.
11. Identité, positionnement et accessibilité du bouton WhatsApp.
12. Référence publique courte et stable.

### Phase P2 — Qualité et ergonomie

13. Localisation des erreurs près des champs.
14. Rafraîchissement fiable de l’administration.
15. États désactivés clairement identifiables.
16. Uniformisation des libellés français.
17. Navigation et remise en haut sur toutes les transitions internes.
18. Non-régression responsive.

### Phase juridique et conformité transverse

19. Alignement fonctionnel avec les mentions légales.
20. Alignement avec la politique de confidentialité.
21. Alignement avec les CGV.
22. Consentements, preuve, retrait et versionnement.
23. Conservation, archivage et sécurité.
24. Cookies et traceurs selon les fonctions réellement utilisées.
25. Droit à l’image et données de prestation.

Le plan doit ensuite décomposer chaque élément en tâches atomiques.

---

# 5. PROBLÈME P0-01 — IMMUTABILITÉ DES DONNÉES PAR RÉSERVATION

Chaque réservation doit conserver un instantané immuable des informations au moment de la demande.

L’instantané doit au minimum contenir, selon les données réellement collectées :

- nom ;
- prénom ;
- téléphone brut saisi ;
- téléphone normalisé E.164 ;
- adresse e-mail ;
- adresse de notification ;
- formule ;
- créneau ;
- durée ;
- montant ;
- devise ;
- consentement aux CGV ;
- version des CGV acceptée ;
- date et heure d’acceptation ;
- consentement à la politique de confidentialité ;
- version de la politique acceptée ;
- date et heure d’acceptation ;
- consentement WhatsApp ;
- date et heure du consentement ;
- autorisation de droit à l’image ;
- version de l’autorisation ;
- date et heure ;
- source de la demande ;
- données nécessaires à la preuve.

Une fiche client partagée peut être actualisée, mais elle ne doit jamais réécrire :

- les données d’une réservation antérieure ;
- les destinataires historiques ;
- les consentements historiques ;
- le contenu d’une notification déjà envoyée ;
- les preuves associées à une réservation.

Prévoir :

- migration sans perte de données ;
- stratégie de remplissage des anciennes réservations ;
- distinction explicite entre profil courant et snapshot ;
- utilisation exclusive du snapshot pour les notifications d’une réservation ;
- journalisation des anomalies de cohérence ;
- tests avec plusieurs identités partageant le même téléphone ;
- test reproduisant les six réservations décrites dans l’audit ;
- test prouvant qu’une modification de profil n’affecte aucun ancien dossier ;
- test prouvant que les e-mails antérieurs et futurs utilisent le bon destinataire.

Critère obligatoire :

Six réservations utilisant le même numéro avec six identités distinctes doivent conserver six identités, six e-mails, six consentements et six destinataires indépendants.

---

# 6. PROBLÈME P0-04 — PAIEMENT ET RÉSERVATION DISTINCTS

Les statuts de paiement et de réservation sont deux machines à états indépendantes.

La validation d’un paiement ne confirme jamais automatiquement une réservation.

Une réservation ne peut devenir `CONFIRMED` que si son paiement est réellement dans un état autorisé, notamment `VERIFIED` ou `PAID`, selon le modèle existant.

États de paiement attendus ou équivalents :

- PAYMENT_PENDING ;
- PAYMENT_INFO_REQUIRED ;
- VERIFICATION_BLOCKED ;
- VERIFIED ;
- PAID ;
- REJECTED ;
- REFUND_PENDING ;
- REFUNDED.

États de réservation attendus ou équivalents :

- PENDING ;
- CONFIRMED ;
- REJECTED ;
- CANCELLED ;
- EXPIRED ;
- COMPLETED ;
- NO_SHOW.

Implémente une machine à états centralisée et validée côté serveur.

L’interface ne doit jamais être la seule protection.

Actions administratives distinctes :

- Vérifier le paiement ;
- Rejeter le paiement ;
- Demander une information de paiement ;
- Marquer la vérification comme temporairement bloquée ;
- Confirmer la réservation ;
- Refuser la réservation ;
- Vérifier et confirmer.

« Vérifier et confirmer » doit exécuter explicitement les deux décisions dans une opération atomique, sans transformer la vérification seule en confirmation automatique.

Prévoir :

- contrôle transactionnel côté serveur ;
- gestion de concurrence ;
- protection contre les doubles clics ;
- idempotence ;
- journal d’audit ;
- ancien état ;
- nouvel état ;
- auteur ;
- date ;
- raison ;
- identifiant de commande ;
- tests de toutes les combinaisons valides et invalides ;
- message métier français clair ;
- désactivation visuelle des actions impossibles ;
- refus serveur même si l’API est appelée directement.

Critère obligatoire :

`PAYMENT_PENDING + PENDING` ne peut jamais produire `CONFIRMED`.

Après passage à `VERIFIED`, la réservation reste `PENDING` jusqu’à une décision administrative explicite.

---

# 7. PROBLÈME P0-03 — CYCLE TEMPOREL ET DISPONIBILITÉ

Les états `COMPLETED` et `NO_SHOW` ne peuvent être appliqués qu’après l’heure de fin réelle du créneau, calculée selon le fuseau de Douala.

Le serveur constitue la source d’autorité.

Avant la fin du créneau :

- masquer ou désactiver les actions concernées ;
- refuser toute tentative API ;
- ne jamais libérer le créneau ;
- ne jamais modifier les statistiques comme si la séance avait eu lieu.

Après la fin :

- autoriser les actions selon les permissions ;
- conserver l’historique complet ;
- recalculer correctement la disponibilité.

Une dérogation exceptionnelle doit nécessiter :

- une permission spécifique ;
- une confirmation explicite ;
- un motif obligatoire ;
- une date ;
- un auteur ;
- l’ancien état ;
- le nouvel état ;
- une trace d’audit ;
- une indication visible de la dérogation.

La clôture anticipée ne doit jamais libérer silencieusement un créneau futur.

Teste au minimum :

- une minute avant la fin ;
- exactement à l’heure de fin ;
- une minute après la fin ;
- changement d’heure ou conversion UTC/Douala ;
- créneau traversant une limite de journée ;
- tentative via l’interface ;
- tentative directe via l’API ;
- double-booking après tentative de clôture anticipée ;
- dérogation autorisée ;
- dérogation sans motif ;
- utilisateur sans permission.

---

# 8. PROBLÈME P0-02 — CAL.COM

Corrige l’intégration Cal.com de bout en bout.

La confirmation d’une réservation doit créer exactement un événement externe.

Le report doit mettre à jour l’événement existant.

L’annulation doit annuler ou supprimer l’événement selon la règle de l’intégration.

Prévoir dans le modèle de données :

- identifiant distant Cal.com ;
- état de synchronisation ;
- type d’opération ;
- nombre de tentatives ;
- date de dernière tentative ;
- date de prochaine tentative ;
- dernière erreur utile et assainie ;
- date de synchronisation réussie ;
- version de la réservation synchronisée ;
- clé d’idempotence ;
- empreinte de la charge utile.

États recommandés ou équivalents :

- NOT_REQUIRED ;
- PENDING ;
- SYNCING ;
- SYNCED ;
- RETRYING ;
- FAILED.

Règles :

- ne jamais afficher `SYNCED` avant confirmation réelle du fournisseur ;
- ne jamais afficher un succès après HTTP 400 ;
- stocker l’identifiant distant ;
- corriger les conversions Douala/UTC ;
- utiliser un identifiant d’idempotence stable ;
- éviter tout doublon après reprise ;
- effectuer trois tentatives automatiques espacées ;
- envoyer I-07 seulement après les trois échecs ;
- journaliser sans exposer de données sensibles ;
- fournir une action manuelle de reprise idempotente ;
- afficher l’état réel dans l’administration.

Tests obligatoires :

- création réussie ;
- HTTP 400 ;
- timeout ;
- HTTP 500 ;
- reprise après erreur ;
- réponse fournisseur reçue mais réponse prod interrompue ;
- nouvelle tentative après succès distant ;
- report ;
- annulation ;
- aucune duplication ;
- fuseau Douala ;
- cohérence entre réservation et événement externe.

Ne déclare pas le problème terminé avant d’avoir une preuve réelle ou une preuve sandbox officielle de l’événement créé, de son identifiant et de son horaire.

---

# 9. WHATSAPP TRANSACTIONNEL

Implémente le parcours WhatsApp complet.

Pour chaque nouvelle réservation :

- créer une notification opérationnelle vers le compte de l’entreprise ;
- journaliser la notification ;
- ne contacter le client que lorsque la règle métier et son consentement le permettent ;
- afficher clairement le consentement dans le dossier ;
- proposer une action « Écrire au client sur WhatsApp » ;
- préremplir un message pertinent ;
- ne jamais envoyer automatiquement un message client non autorisé.

Chaque notification doit conserver :

- réservation ;
- destinataire figé ;
- canal ;
- modèle ;
- version du modèle ;
- contenu ou rendu reconstituable ;
- statut ;
- tentative ;
- date ;
- identifiant fournisseur ;
- résultat de livraison ;
- erreur assainie ;
- clé d’idempotence.

Prévoir trois tentatives automatiques espacées.

I-08 n’est envoyé qu’après les trois échecs.

Le bouton flottant public doit :

- utiliser l’identité officielle WhatsApp ;
- utiliser le logo blanc officiel ;
- utiliser le vert `#25D366` ;
- posséder un libellé accessible ;
- disposer d’une zone de sécurité ;
- ne recouvrir aucun champ, créneau ou action ;
- fonctionner à 390 × 844 ;
- fonctionner sur les autres largeurs prises en charge ;
- fonctionner en portrait et paysage ;
- rester correct lorsque le clavier mobile est ouvert.

---

# 10. SYSTÈME DES E-MAILS

La bibliothèque d’e-mails est normative.

Implémente tous les modèles externes :

- E-01 à E-23 ;
- E-04A ;
- E-04B.

Implémente tous les modèles internes :

- I-01 à I-12.

Ne réduis pas la bibliothèque aux seuls e-mails actuellement utilisés.

Pour chaque modèle, implémente :

- identifiant stable ;
- version ;
- déclencheur ;
- destinataire ;
- conditions d’envoi ;
- conditions de suppression ;
- objet ;
- pré-en-tête ;
- corps ;
- variables obligatoires ;
- action principale ;
- règle d’idempotence ;
- règles de reprise ;
- journalisation ;
- possibilité de reconstituer le texte réellement envoyé.

Règles obligatoires :

- un e-mail client confirme uniquement un fait réellement enregistré ;
- un e-mail interne est envoyé uniquement lorsqu’une intervention, une échéance ou une anomalie le justifie ;
- aucune notification administrative après chaque action réalisée par l’administrateur lui-même ;
- les événements purement informatifs vont dans l’historique ou le digest ;
- références de paiement et remboursement masquées ;
- aucun secret dans les messages ;
- statuts techniques remplacés par des libellés français ;
- dates en heure de Douala ;
- référence courte dans les objets et messages ;
- adresse d’expédition stable ;
- adresse de réponse surveillée ;
- destinataires figés par réservation ;
- modèle et version conservés ;
- rebonds permanents journalisés ;
- erreurs temporaires soumises aux reprises.

Clé d’idempotence minimale :

`id_evenement + id_modele + version_reservation`

La clé peut être renforcée si nécessaire, sans casser la règle métier.

## Règles particulières

### E-03

- planifié cinq minutes après `VERIFIED/PAID` ;
- envoyé uniquement si la réservation reste `PENDING` ;
- annulé si la réservation devient `CONFIRMED` pendant la fenêtre ;
- E-05 est alors le seul message envoyé.

### E-05

- impossible sans paiement `VERIFIED/PAID` ;
- impossible sans réservation `CONFIRMED` ;
- une seule fois par version confirmée du créneau.

### E-07

- refus après paiement vérifié ;
- création simultanée d’une tâche financière ;
- décision bloquée si aucun traitement financier n’est défini.

### E-09

- met à jour le créneau ;
- met à jour l’invitation calendrier ;
- ne crée aucun doublon.

### E-11 et E-12

- calcul serveur du seuil de 48 heures ;
- heure de Douala ;
- comportement exact à la limite.

### E-17 et E-18

- impossibles avant la fin du créneau.

### E-19

- uniquement lorsque les livrables sont réellement accessibles ;
- vérifier le lien avant envoi.

### E-20 et E-21

- distinguer remboursement engagé et remboursement finalisé ;
- ne jamais annoncer `REFUNDED` avant exécution réelle.

### I-01 et I-02

- ne jamais envoyer les deux pour la même information initiale.

### I-03

- envoyé une seule fois ;
- 30 minutes après paiement vérifié si aucune décision ;
- événements suivants regroupés dans I-11, sauf escalade.

### I-07 et I-08

- uniquement après trois tentatives automatiques échouées.

### I-11

- un seul digest par jour ;
- à 18 h, heure de Douala ;
- aucun envoi s’il ne contient aucun élément utile.

Teste chaque modèle, chaque déclencheur et chaque condition de non-envoi.

---

# 11. RÉFÉRENCE COURTE

Implémente une référence publique stable au format recommandé :

`GSP-AAMMJJ-XXXX`

Exemple :

`GSP-260728-K7M4`

La référence doit être :

- unique ;
- non séquentielle lorsqu’une séquence exposerait le volume d’activité ;
- stable ;
- indexée ;
- utilisable dans les recherches ;
- affichée au client ;
- présente dans les objets d’e-mail ;
- distincte de l’identifiant technique ;
- impossible à modifier après création.

Les identifiants internes restent disponibles dans les journaux techniques, mais ne doivent pas encombrer les communications client.

---

# 12. « PROPOSER MON HORAIRE »

Répare intégralement ce parcours.

Les données déjà saisies ne doivent jamais être effacées lorsqu’un utilisateur passe vers cette option ou revient à l’étape précédente.

Prévoir :

- conservation de l’état du formulaire ;
- validation côté client ;
- validation côté serveur ;
- date future ;
- horaires d’ouverture ;
- durée complète avant fermeture ;
- détection de conflit ;
- réponse métier explicite ;
- comportement en cas d’erreur serveur ;
- accessibilité ;
- navigation clavier ;
- absence de double soumission ;
- sélection persistante après réponse valide.

Tests obligatoires :

- horaire libre ;
- horaire occupé ;
- date passée ;
- horaire hors ouverture ;
- durée dépassant la fermeture ;
- erreur serveur ;
- retour arrière ;
- rafraîchissement contrôlé ;
- mobile ;
- valeurs préalablement saisies.

---

# 13. VALIDATION DU TÉLÉPHONE ET DE L’E-MAIL

Implémente une validation cohérente côté client et côté serveur.

Téléphone :

- formats camerounais acceptés selon les règles du projet ;
- normalisation E.164 ;
- exemple attendu : `+237640703249` ;
- rejet des longueurs impossibles ;
- rejet des caractères invalides ;
- conservation éventuelle de la valeur brute pour preuve ;
- stockage séparé de la valeur normalisée ;
- messages d’erreur français ;
- aucune simple validation par présence.

E-mail :

- validation syntaxique robuste ;
- trim ;
- normalisation prudente ;
- rejet des valeurs manifestement invalides ;
- message relié au champ ;
- contrôle serveur obligatoire.

Ajoute des tests de valeurs valides, invalides et limites.

---

# 14. REMPLACEMENT DES `window.prompt()`

Remplace tous les dialogues natifs associés à :

- annuler ;
- déplacer ;
- expirer ;
- refuser ;
- déclarer absent ;
- terminer ;
- vérifier un paiement ;
- rejeter un paiement ;
- créer un tarif ;
- modifier un tarif ;
- toute autre opération métier sensible.

Utilise des modales ou formulaires accessibles intégrés à l’application.

Chaque opération doit proposer selon le cas :

- titre explicite ;
- résumé du dossier ;
- conséquence de l’action ;
- champs structurés ;
- motif obligatoire ;
- validations ;
- bouton d’annulation ;
- bouton de confirmation ;
- état de chargement ;
- blocage du double clic ;
- résultat de réussite réel ;
- erreur métier ;
- focus trap ;
- navigation clavier ;
- retour du focus ;
- compatibilité mobile ;
- journal d’audit.

Aucune opération sensible ne doit dépendre d’une chaîne de texte libre non validée.

---

# 15. TARIFS ET MENTIONS OBLIGATOIRES

Versionne les tarifs et leurs mentions.

Un tarif ne peut être publié sans :

- nom ;
- montant ;
- devise ;
- durée ;
- contenu de la formule ;
- conditions applicables ;
- mentions obligatoires validées ;
- version ;
- date d’effet ;
- statut ;
- auteur de publication.

Une réservation doit conserver un snapshot du tarif accepté.

Une modification future du tarif ne doit jamais modifier une réservation historique.

Prévoir :

- brouillon ;
- validation ;
- publication ;
- archivage ;
- duplication ;
- suppression uniquement lorsqu’elle est légalement et techniquement possible ;
- blocage de suppression lorsqu’une réservation utilise la version ;
- journalisation ;
- aperçu avant publication.

Tests :

- créer ;
- modifier ;
- dupliquer ;
- publier ;
- archiver ;
- supprimer un tarif inutilisé ;
- refuser la suppression d’un tarif utilisé ;
- refuser la publication sans mentions ;
- préserver le prix historique.

---

# 16. EXIGENCES JURIDIQUES TRANSVERSES

Les fonctionnalités doivent être alignées avec les textes juridiques fournis.

## 16.1 Paiement et confirmation

- paiement intégral requis avant confirmation ;
- vérification manuelle ;
- décision de paiement distincte de la décision de réservation ;
- aucune référence transmise par le client ne vaut validation automatique.

## 16.2 Annulations

Calculer côté serveur, selon l’heure de Douala :

- plus de 48 heures avant la séance : remboursement de 50 % ;
- 48 heures ou moins : aucun remboursement, sous réserve des règles impératives ;
- absence non signalée : aucun remboursement, sous réserve des règles impératives.

Ne marque pas automatiquement un remboursement comme réalisé.

Créer une action financière distincte.

## 16.3 Reports

- un seul changement de date sans frais ;
- demande au moins 48 heures avant la date initiale ;
- selon les disponibilités ;
- deuxième changement traité selon la règle d’annulation, sauf accord écrit contraire ;
- compteur et historique obligatoires.

## 16.4 Retards

- au-delà de cinq minutes imputables au client, réduction du temps restant ;
- aucune prolongation automatique ;
- aucune compensation automatique.

## 16.5 Rétractation

Prévoir une gestion compatible avec les textes fournis :

- demande explicite ;
- référence de réservation ;
- date de réception ;
- état du service ;
- début d’exécution ;
- décision motivée ;
- preuve conservée.

Ne remplace pas une analyse juridique humaine par une décision automatisée non vérifiable.

## 16.6 Droit à l’image

Conserver séparément :

- autorisation ;
- refus ;
- retrait ;
- date ;
- version ;
- finalité ;
- portée ;
- preuve.

Le retrait produit effet pour l’avenir et ne doit pas effacer indistinctement les autres données nécessaires.

## 16.7 Confidentialité et preuve

Prévoir :

- contrôle d’accès ;
- HTTPS selon l’environnement ;
- journalisation des actions sensibles ;
- limitation des données exposées ;
- protection des fichiers ;
- conservation différenciée ;
- archivage restreint ;
- suppression ou anonymisation lorsque justifiée ;
- protection des sauvegardes ;
- traitement des demandes d’accès, rectification, limitation, opposition, portabilité, retrait et effacement ;
- traçabilité de la réponse administrative.

## 16.8 Cookies et traceurs

Inspecte les traceurs réellement utilisés.

Classe-les en :

- strictement nécessaires ;
- facultatifs.

Ne charge pas un traceur facultatif avant consentement lorsque celui-ci est requis.

Le refus doit être aussi accessible que l’acceptation.

Prévoir modification et retrait des préférences.

---

# 17. ADMINISTRATION ET JOURNAL D’AUDIT

Toute action sensible doit enregistrer :

- identifiant de l’événement ;
- identifiant de réservation ;
- référence courte ;
- auteur ;
- rôle ;
- action ;
- ancien état ;
- nouvel état ;
- motif ;
- date serveur ;
- fuseau ;
- identifiant de corrélation ;
- adresse IP si légalement et techniquement justifiée ;
- résultat ;
- erreur assainie ;
- métadonnées strictement nécessaires.

Le journal ne doit pas contenir :

- mot de passe ;
- secret ;
- jeton ;
- référence de paiement intégrale ;
- contenu de fichier privé ;
- données personnelles inutiles.

Le tableau d’administration doit afficher les nouvelles demandes sans rechargement complet, par un mécanisme fiable adapté à l’architecture existante.

Ne mets pas en place un rafraîchissement agressif inutile.

---

# 18. QUALITÉ DES INTERFACES

Toutes les erreurs doivent :

- être en français ;
- être compréhensibles ;
- être reliées au champ ou à l’action concernée ;
- préserver les valeurs déjà saisies ;
- indiquer la marche à suivre ;
- ne pas exposer de stack trace ou message fournisseur brut.

Les états désactivés doivent :

- être visuellement distincts ;
- rester accessibles ;
- expliquer pourquoi l’action est impossible ;
- ne pas reposer uniquement sur une différence de couleur.

Uniformise :

- accents ;
- casse ;
- termes de réservation ;
- termes de paiement ;
- dates ;
- heures ;
- devise FCFA ;
- fuseau Douala ;
- références ;
- statuts affichés.

---

# 19. RÉSULTATS CONFORMES À PRÉSERVER

Ajoute des tests de non-régression pour préserver les fonctions déjà validées :

- connexion administrateur ;
- réservation standard ;
- durée des packs ;
- indisponibilité d’un créneau actif ;
- blocage temporaire créé puis supprimé ;
- enregistrement des références fictives sans débit ;
- formulaire B2B ;
- présence d’une demande après rechargement ;
- changement de statut B2B ;
- portfolio ;
- chargement progressif ;
- filtres ;
- aperçu agrandi ;
- pages légales ;
- liens Instagram et Facebook existants ;
- suppression d’un tarif inutilisé ;
- blocage de suppression d’un tarif utilisé ;
- consentements obligatoires ;
- navigation interne ;
- remise en haut ;
- responsive.

Ne supprime pas les pictogrammes déjà présents lorsqu’ils ont une fonction propre.

Instagram, Facebook et LinkedIn sont des éléments distincts, avec :

- logos officiels ;
- URL valides ;
- libellés accessibles.

---

# 20. STRATÉGIE DE TEST OBLIGATOIRE

Pour chaque problème, applique le cycle suivant :

1. écrire ou mettre à jour un test reproduisant le défaut ;
2. vérifier que le test échoue avant correction lorsque cela est possible ;
3. implémenter la correction ;
4. exécuter le test ciblé ;
5. exécuter les tests liés ;
6. exécuter toute la suite ;
7. exécuter lint ;
8. exécuter la vérification des types ;
9. exécuter la compilation de production ;
10. exécuter les migrations sur une base de test ;
11. vérifier la migration descendante si le projet la supporte ;
12. effectuer un test manuel guidé ;
13. conserver les preuves.

Tests minimaux à couvrir :

- tests unitaires des machines à états ;
- tests d’intégration de base de données ;
- tests des transactions ;
- tests de concurrence ;
- tests d’idempotence ;
- tests des tâches différées ;
- tests des reprises ;
- tests des e-mails ;
- tests WhatsApp ;
- tests Cal.com ;
- tests des fuseaux horaires ;
- tests à la limite exacte des 48 heures ;
- tests responsive ;
- tests clavier ;
- tests d’accessibilité ;
- tests API non autorisés ;
- tests de permissions ;
- tests de non-régression.

Utilise une horloge injectable ou contrôlable dans les tests temporels.

Ne dépends pas de l’heure réelle du système pour les tests des échéances.

---

# 21. SCÉNARIOS END-TO-END OBLIGATOIRES

Implémente notamment les scénarios suivants :

## Scénario A — Réservation standard

1. création ;
2. snapshot enregistré ;
3. E-01 envoyé ;
4. I-01 envoyé ;
5. paiement encore en attente ;
6. confirmation impossible ;
7. paiement vérifié ;
8. réservation toujours en attente ;
9. E-03 planifié ;
10. confirmation dans les cinq minutes ;
11. E-03 annulé ;
12. E-05 envoyé une fois ;
13. événement Cal.com unique ;
14. WhatsApp entreprise journalisé.

## Scénario B — Paiement vérifié sans décision

1. paiement vérifié ;
2. réservation en attente ;
3. E-03 après cinq minutes ;
4. I-03 après trente minutes ;
5. aucune duplication ;
6. intégration ultérieure dans I-11.

## Scénario C — Paiement rejeté

1. motif définitif obligatoire ;
2. statut REJECTED ;
3. E-04 ;
4. réservation non confirmée ;
5. aucune fausse annonce.

## Scénario D — Information manquante

1. PAYMENT_INFO_REQUIRED ;
2. motif ou information obligatoire ;
3. E-04A ;
4. reprise de vérification après complément.

## Scénario E — Blocage temporaire

1. VERIFICATION_BLOCKED ;
2. délai interne ;
3. E-04B seulement en cas d’impact ;
4. I-03 selon les règles ;
5. aucune confusion avec un rejet.

## Scénario F — Refus après paiement vérifié

1. paiement VERIFIED ;
2. refus ;
3. tâche financière créée ;
4. E-07 ;
5. remboursement non marqué comme réalisé ;
6. E-20 au démarrage réel ;
7. E-21 après finalisation réelle.

## Scénario G — Report

1. demande reçue ;
2. règle des 48 heures ;
3. disponibilité ;
4. compteur de reports ;
5. mise à jour Cal.com ;
6. aucune duplication ;
7. E-08 puis E-09 ou E-10.

## Scénario H — Annulation

Tester :

- plus de 48 heures ;
- exactement 48 heures ;
- moins de 48 heures ;
- annulation par le Studio ;
- action financière ;
- E-11, E-12 ou E-13 ;
- calendrier ;
- disponibilité.

## Scénario I — Fin de séance

1. action impossible avant la fin ;
2. possible après la fin ;
3. NO_SHOW ;
4. COMPLETED ;
5. E-17 ou E-18 selon le cas ;
6. créneau et statistiques cohérents.

## Scénario J — Livrables

1. lien absent ;
2. lien invalide ;
3. lien inaccessible ;
4. lien valide ;
5. E-19 seulement dans le dernier cas.

## Scénario K — Identité partagée

Créer six réservations avec le même téléphone et six noms/e-mails différents.

Vérifier l’immutabilité complète.

---

# 22. PREUVES ATTENDUES APRÈS CHAQUE PROBLÈME

À la fin de chaque problème, fournis :

- identifiant du problème ;
- résumé du défaut initial ;
- cause racine ;
- fichiers modifiés ;
- migrations ajoutées ;
- schéma avant/après ;
- API avant/après ;
- interface avant/après ;
- tests ajoutés ;
- commandes exécutées ;
- résultat exact des commandes ;
- preuve du test ciblé ;
- preuve de la suite complète ;
- preuve du lint ;
- preuve du typage ;
- preuve du build ;
- captures pertinentes ;
- état de la base de test ;
- risques résiduels ;
- vérification de chaque critère de sortie ;
- vérification de la matrice de traçabilité ;
- liste explicite des éléments non modifiés ;
- proposition de message de commit.

Présente une checklist finale :

- [ ] Implémentation complète
- [ ] Aucun placeholder
- [ ] Aucun TODO ou FIXME ajouté
- [ ] Test reproduisant le défaut
- [ ] Test ciblé réussi
- [ ] Tests d’intégration réussis
- [ ] Tests end-to-end réussis
- [ ] Suite complète réussie
- [ ] Lint réussi
- [ ] Types vérifiés
- [ ] Build réussi
- [ ] Critères documentaires respectés
- [ ] Non-régression vérifiée
- [ ] Documentation mise à jour
- [ ] Preuves fournies

Une case ne peut être cochée que si elle est réellement vérifiée.

---

# 23. DOCUMENTATION À MAINTENIR

Mets à jour après chaque correction :

- `GOLDEN_STUDIO_PLUS_IMPLEMENTATION_PLAN.md`
- `GOLDEN_STUDIO_PLUS_TRACEABILITY_MATRIX.md`
- `GOLDEN_STUDIO_PLUS_TEST_REPORT.md`
- `GOLDEN_STUDIO_PLUS_CHANGELOG.md`
- documentation des variables d’environnement ;
- documentation des migrations ;
- documentation des statuts ;
- documentation des notifications ;
- documentation des procédures de reprise ;
- documentation du déploiement ;
- procédure de rollback.

La matrice de traçabilité doit rester synchronisée avec le code.

---

# 24. DÉPLOIEMENT ET ROLLBACK

Pour chaque correction, précise :

- ordre de déploiement ;
- migration nécessaire ;
- compatibilité ascendante ;
- compatibilité avec les données existantes ;
- sauvegarde préalable ;
- contrôle post-déploiement ;
- métriques ou journaux à surveiller ;
- procédure de rollback ;
- conséquence d’un rollback sur les données ;
- éventuel feature flag réellement implémenté.

Ne déploie pas directement en production sans approbation explicite.

Ne détruis aucune donnée existante.

Toute migration risquée doit être précédée d’une sauvegarde et d’un contrôle d’intégrité.

---

# 25. PREMIÈRE RÉPONSE ATTENDUE

Pour ta première réponse, tu dois uniquement :

1. confirmer que les trois documents ont été lus intégralement ;
2. résumer l’architecture réelle découverte dans le dépôt ;
3. présenter les commandes de vérification initiale exécutées ;
4. signaler les erreurs initiales observées ;
5. créer le plan complet ;
6. créer la matrice de traçabilité ;
7. afficher la liste ordonnée de tous les problèmes ;
8. identifier précisément le premier problème à traiter ;
9. expliquer les tests qui reproduiront ce premier problème ;
10. attendre mon autorisation avant de modifier le code.

Tu ne dois encore implémenter aucune correction dans cette première étape.

Après mon autorisation, commence uniquement par P0-01.

Après l’implémentation complète et les tests de P0-01, arrête-toi et demande mon approbation.

Le même processus doit être répété pour chaque problème jusqu’à la résolution complète de toutes les exigences contenues dans les trois documents.