# Aperçu de migration du catalogue officiel — 4 août 2026

État : `SOURCE-OFFICIELLE-CONFIRMÉE — PRÉPARATION-NON-MUTATIVE`

Source : `docs/Golden_Studio_Plus_Catalogue.docx`
SHA-256 : `002bd52c30c7e3fcef8aebc71f82111780320ba8c9500c4e55d746164cd54696`

L'OWNER a confirmé le 9 août 2026 que ce DOCX remplace officiellement le catalogue historique des 22 formules. Cet aperçu ne crée aucune version, ne publie rien et ne modifie aucune réservation.

## Structure cible

Le document contient 34 packs et trois promotions. La cible comporte 35 enregistrements commerciaux : les 34 packs, plus Happy Hours conservé comme offre promotionnelle réservable liée à Flash Social. L'avantage étudiant et le parrainage deviennent des règles promotionnelles séparées.

- 17 formules actuelles correspondent directement à un pack source.
- Quatre formules agrégées actuelles deviennent douze packs distincts : Enfant, Anniversaire, Maternité et Bébé.
- Cinq packs sont entièrement nouveaux : Identité Standard, Pack Fratrie et trois abonnements.
- Happy Hours reste un enregistrement distinct pour porter son créneau et son prix, mais dépend commercialement de Flash Social.
- Les anciennes versions et les snapshots des 13 réservations restent immuables.

## Correspondance des 22 formules existantes

| Slug conservé | Nom cible | Prix | Durée source | Livraison source | Action |
|---|---|---:|---:|---|---|
| `flash-social` | Flash Social | 5 000 | 15 min | à fournir | version 2; durée 30→15 |
| `happy-hours` | Happy Hours — Flash Social | 4 000 | 15 min | à fournir | version 2 promotionnelle; durée 30→15 |
| `pack-decouverte` | Portrait Découverte | 10 000 | 30 min | à fournir | version 2; renommage; durée 45→30 |
| `classic-propre` | Classic Propre | 18 000 | 60 min | à fournir | version 2 |
| `pack-signature` | Signature | 32 000 | 90 min | à fournir | version 2; renommage |
| `corporate-linkedin` | Corporate LinkedIn | 25 000 | 45 min | à fournir | version 2 |
| `duo-couple` | Duo & Couple | 22 000 | 60 min | à fournir | version 2 |
| `famille` | Famille — jusqu'à 5 personnes | 28 000 | 60 min | à fournir | version 2 |
| `groupe-fun` | Groupe Fun — 6 à 8 personnes | 35 000 | 90 min | à fournir | version 2 |
| `enfant` | Enfant Découverte | 8 000 | 30 min | à fournir | version 2; fin du tarif agrégé |
| `anniversaire` | Anniversaire Enfant Découverte | 8 000 | 30 min | à fournir | version 2; fin du tarif agrégé |
| `maternite` | Maternité Découverte | 10 000 | 30 min | à fournir | version 2; fin du tarif agrégé |
| `bebe-naissance` | Bébé Découverte | 12 000 | 30 min max. | à fournir | version 2; fin du tarif agrégé |
| `fiancailles-decouverte` | Fiançailles Découverte | 25 000 | 60 min | 10 jours ouvrés après sélection | version 2; durée 90→60 |
| `fiancailles-classic` | Fiançailles Classic | 35 000 | 90 min | 10 jours ouvrés après sélection | version 2; durée 120→90 |
| `fiancailles-premium` | Fiançailles Premium | 50 000 | 120 min | 15 jours ouvrés après sélection | version 2; durée 180→120 |
| `pre-mariage-decouverte` | Pré-mariage Découverte | 40 000 | 90 min | 15 jours ouvrés après sélection | version 2; durée 120→90 |
| `pre-mariage-classic` | Pré-mariage Classic | 60 000 | 120 min | 15 jours ouvrés après sélection | version 2; durée 180→120 |
| `pre-mariage-premium` | Pré-mariage Premium | 100 000 | 180 min | 20 jours ouvrés | version 2; durée 480→180 |
| `event-lite` | Événement Lite | 80 000 | 120 min | à fournir | version 2; durée 240→120 |
| `event-standard` | Événement Standard | 140 000 | 240 min | à fournir | version 2; durée 360→240 |
| `event-premium` | Événement Premium | 220 000 | 480 min | à fournir | version 2 |

Les prix des 22 enregistrements correspondent au DOCX. Quinze durées actuelles ne peuvent en revanche pas être conservées si la source officielle est appliquée.

## Treize nouveaux packs

| Slug proposé | Pack | Prix | Durée source | Mode cible | Livraison |
|---|---|---:|---:|---|---|
| `identite-standard` | Identité Standard | 3 000 | absente | à déterminer | à fournir |
| `pack-fratrie` | Pack Fratrie — 2 à 4 enfants | 28 000 | 60 min | réservation directe | à fournir |
| `maternite-douce` | Maternité Douce | 18 000 | 60 min | réservation directe | à fournir |
| `maternite-elegance` | Maternité Élégance | 35 000 | 90 min | réservation directe | à fournir |
| `bebe-premiere-magie` | Bébé Première Magie | 16 000 | 40 min max. | réservation directe | à fournir |
| `enfant-star` | Enfant Star | 12 000 | 45 min | réservation directe | à fournir |
| `ado-swag` | Ado Swag | 18 000 | 60 min | réservation directe | à fournir |
| `anniversaire-enfant-star` | Anniversaire Enfant Star | 12 000 | 45 min | réservation directe | à fournir |
| `anniversaire-adulte-classic` | Anniversaire Adulte Classic | 15 000 | 60 min | réservation directe | à fournir |
| `anniversaire-adulte-premium` | Anniversaire Adulte Premium | 32 000 | 90 min | réservation directe | à fournir |
| `abonnement-createur-starter` | Abonnement Créateur Starter | 15 000/mois | 1 × 30 min/mois | abonnement/contact | à fournir |
| `abonnement-createur-pro` | Abonnement Créateur Pro | 35 000/mois | 2 séances Classic/mois | abonnement/contact | à fournir |
| `abonnement-influenceur-vip` | Abonnement Influenceur VIP | 50 000/mois | 3 séances Classic Propre/mois | abonnement/contact | à fournir |

## Promotions à implémenter

| Règle | Exigence source | Capacité actuelle | Travail requis |
|---|---|---|---|
| Happy Hours | mercredi/jeudi 10 h–14 h; 15 min; 1 personne; 1 fond; 1 tenue; 1 photo HD retouchée; six créneaux/jour; paiement intégral; non cumulable | prix et consentement promotionnel seulement | restriction de créneaux, quota quotidien, paiement intégral et non-cumul |
| Avantage étudiant | −15 % sur Portrait Découverte, Classic Propre, Ado Swag et Corporate LinkedIn; carte valide; lundi–vendredi; paiement intégral; non cumulable | aucune règle de remise | justificatif, éligibilité, calcul serveur, audit et non-cumul |
| Parrainage Golden | 3 000 au filleul; crédit 5 000 au parrain après paiement et séance; minimum 18 000; validité 30 jours; non cumulable | aucun registre de parrainage | code parrainage, ledger de crédit, déclenchement différé, expiration et audit |

## Politique de reprise du contenu

- `description` : texte FR exact du DOCX.
- `content` : même texte source tant qu'aucun texte long distinct n'est fourni; aucune amplification marketing automatique.
- `inclusions` : éléments factuels séparés depuis la description FR.
- `conditions` : conditions particulières exactes du DOCX et référence aux CGV communes du 31 juillet 2026.
- `legalText` : référence versionnée aux CGV publiées; aucune réécriture arbitraire des CGV dans chaque pack.
- Texte EN : conservé dans la source canonique; publication différée tant que le site et le schéma n'ont pas de variante linguistique explicite.

## Données encore indispensables

1. Délai de livraison de 29 enregistrements cibles : 28 packs sans valeur et Happy Hours; Happy Hours peut reprendre celui de Flash Social si cela est explicitement confirmé.
2. Durée ou caractère non réservable en ligne d'Identité Standard.
3. Mode public des abonnements : souscription en ligne ou demande de contact.
4. Publication bilingue immédiate ou conservation du français seul pour cette version.

Aucun délai historique calculé par le frontend ne sera copié : les six valeurs explicites du DOCX contredisent déjà cette grille. Aucun DRAFT ne sera créé en production avant résolution des champs indispensables et aperçu final.
