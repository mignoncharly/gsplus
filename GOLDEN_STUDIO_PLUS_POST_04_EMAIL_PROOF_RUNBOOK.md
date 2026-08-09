# Runbook supervisé POST-04 — preuves réelles E-17/E-18/E-19

État : `BLOQUÉ-GATES-OWNER` au 9 août 2026

Ce protocole prépare une preuve fournisseur réelle sans toucher aux 13 dossiers existants. Il n'autorise à lui seul aucun envoi, aucune réservation et aucune publication de livrable.

## Pourquoi deux dossiers QA

- Dossier QA-A : transition normale vers `NO_SHOW`, qui crée E-17.
- Dossier QA-B : transition normale vers `COMPLETED`, qui crée E-18 si sa version de formule possède un `deliveryLabel`; publication ultérieure du livrable vérifié, qui crée E-19.
- `NO_SHOW` et `COMPLETED` sont deux états terminaux distincts. Une seule réservation ne peut pas fournir honnêtement les trois preuves.

## Autorisation minimale attendue

L'OWNER doit confirmer explicitement, dans un même message :

1. « J'autorise deux réservations QA et les envois réels E-17, E-18 et E-19 vers [boîte contrôlée]. »
2. « J'autorise l'emploi de [formule/version] avec le délai versionné [libellé approuvé] pour le dossier QA-B. »
3. « J'autorise la publication du livrable QA non sensible disponible à [URL HTTPS publique], avec expiration le [date]. »
4. « Je confirme qu'aucun des 13 dossiers existants ne doit être utilisé. »

Si l'OWNER désigne au contraire un dossier existant, sa référence exacte et les actions permises doivent être écrites explicitement. Une ancienne adresse mentionnée dans un DOCX ou un historique ne constitue pas une autorisation actuelle.

## Préflight obligatoire

- Sauvegarder la base et relever les compteurs réservations, livraisons, notifications et tentatives.
- Vérifier que la boîte cible est contrôlée par le demandeur et que l'adresse n'apparaîtra jamais en clair dans Git.
- Vérifier que la version choisie est `PUBLISHED` et possède le délai approuvé. Aucun SQL direct ni modification d'une version historique.
- Vérifier le livrable : contenu factice/non sensible, URL HTTPS publique, résolution vers une adresse publique, réponse HTTP 2xx, instruction d'accès et date future.
- Préparer deux références identifiables comme QA et des `commandId` uniques; utiliser exclusivement l'API et les commandes métier normales.

## Exécution supervisée

### QA-A — E-17

1. Créer et confirmer la réservation QA-A avec une fin de séance effectivement passée.
2. La passer à `NO_SHOW` par la commande admin normale, avec motif QA explicite.
3. Attendre la stabilisation du worker et vérifier exactement un E-17 `SENT`.
4. Dans la boîte QA, contrôler sujet, référence, Message-ID, contenu et horaires UTC/Douala.

### QA-B — E-18 puis E-19

1. Créer et confirmer QA-B sur la version publiée contenant le `deliveryLabel` approuvé.
2. La passer à `COMPLETED` après sa fin réelle; vérifier exactement un E-18 et la présence exacte du délai versionné.
3. Tester d'abord qu'une URL invalide ou inaccessible ne crée ni livraison ni E-19.
4. Publier ensuite le livrable approuvé via la commande OWNER `ReservationDelivery`; vérifier le contrôle HTTPS public 2xx et exactement un E-19.
5. Ouvrir le lien depuis E-19 et confirmer l'accès au seul contenu QA prévu. Aucun master privé, chemin interne ou contenu client réel ne doit être exposé.

## Postflight et preuve

- Rejouer les mêmes commandes avec les mêmes identifiants et confirmer l'absence de doublon.
- Attendre une file stable; comparer tous les compteurs avec le préflight et expliquer uniquement le delta QA attendu.
- Confirmer que les 13 dossiers initiaux et leurs snapshots sont inchangés.
- Consigner des captures expurgées ou empreintes : jamais l'adresse complète, un secret, une URL privée ou un contenu client.
- Requalifier E-17/E-18/E-19 en `VALIDÉ-PROD` uniquement lorsque la réception réelle et l'ouverture du lien sont prouvées.

## État technique observé le 9 août 2026

- Tests ciblés : 2 fichiers, 18/18 tests verts.
- Production : 13 réservations; aucune livraison, aucun E-17/E-18/E-19 et aucune tentative associée.
- Catalogue : 22 versions `PUBLISHED`, aucune avec `deliveryLabel`; aucune réservation actuelle ne peut donc produire E-18.
- SMTP sortant : canal, worker, hôte, expéditeur et authentification configurés. Le secret webhook des rapports fournisseur manque encore et relève de POST-05.
