# Matrice de récupération des contenus tarifaires — POST-03

État : `SOURCE-OFFICIELLE-CONFIRMÉE — PRÉPARATION-NON-MUTATIVE`; phase ouverte, aucune validation ou publication implicite

## Source catalogue officielle reçue le 9 août 2026

L'OWNER confirme que `docs/Golden_Studio_Plus_Catalogue.docx`, version consolidée du 4 août 2026, remplace le catalogue historique des 22 formules. Son SHA-256 est `002bd52c30c7e3fcef8aebc71f82111780320ba8c9500c4e55d746164cd54696`.

Le document a été extrait et lu intégralement : 190 paragraphes non vides et 45 lignes de tableaux. Il contient 34 packs avec prix et descriptions FR/EN ainsi que Happy Hours, l'avantage étudiant et le parrainage. La correspondance et les écarts techniques sont consignés dans `GOLDEN_STUDIO_PLUS_CATALOGUE_MIGRATION_PREVIEW.md`.

Cette source résout les descriptions, les inclusions principales, les prix et la plupart des durées. Elle invalide toutefois la reprise automatique de l'ancienne grille de livraison : les six délais explicitement documentés sont de 10, 15 ou 20 jours ouvrés, alors que le fallback affichait 72 h, 5 jours ou 7 jours. Les 28 autres packs et Happy Hours restent sans délai; la cible comporte donc 29 champs à compléter.

Ce document remplace l'hypothèse initiale selon laquelle 88 nouveaux contenus devaient être rédigés. La base comporte bien 88 champs obligatoires absents, mais plusieurs informations existent déjà hors des versions tarifaires et doivent être récupérées, reliées ou approuvées — pas réinventées.

## Sources relues intégralement le 9 août 2026

- `docs/Golden_Studio_Plus_Catalogue.docx` : 190 paragraphes non vides et 45 lignes de tableaux; source officielle confirmée par l'OWNER.
- `docs/Bibliotheque_emails_Golden_Studio_Plus_2026-07-30_v2.docx` : 1 064 paragraphes/lignes extraits et relus.
- `docs/Rapport_unifie_audit_Golden_Studio_Plus_2026-07-29.docx` : 509 paragraphes/lignes extraits et relus.
- `docs/Textes_juridiques_Golden_Studio_Plus_2026-07-31.docx` : 125 paragraphes/lignes extraits et relus.
- Dépôt courant, historique Git complet, seed, frontend et production : contrôlés en complément.

Constats normatifs :

- Le rapport d'audit, P1-04, constate explicitement que l'aperçu Flash Social affichait « Aucune description » et aucun bloc de mentions ou conditions applicables. Il exige description, inclusions, livraison et « Mentions et conditions applicables » versionnées.
- La bibliothèque d'e-mails, section 10, définit E-18/E-19 mais précise que « le délai réel de production ou de livraison des photographies doit néanmoins être défini selon les prestations proposées ».
- Le DOCX juridique fournit déjà les CGV communes datées du 31 juillet 2026. Elles n'ont pas à être réécrites 22 fois : elles complètent le récapitulatif propre à chaque formule.
- Le frontend contient déjà une grille de délais calculés et trois listes commerciales d'inclusions, mais ces valeurs ne sont pas stockées dans `PackageVersion` et ne portent pas à elles seules une approbation OWNER versionnée.

## Contenus existants récupérables

### Grille de livraison actuellement affichée

Source : `frontend/src/lib/packages.js`. Cette grille reste le fallback des versions historiques; le frontend a été corrigé pour qu'un futur `deliveryLabel` OWNER publié prenne désormais priorité.

| # | Formule | Délai actuellement affiché | Inclusions commerciales retrouvées dans le frontend |
|---:|---|---|---|
| 1 | `flash-social` | 24 h | Aucune source formule trouvée |
| 2 | `happy-hours` | 24 h | Aucune source formule trouvée |
| 3 | `pack-decouverte` | 48 h | Aucune source formule trouvée |
| 4 | `classic-propre` | 48 h | Portrait individuel; Retouche incluse; Idéal pour un profil professionnel |
| 5 | `pack-signature` | 72 h | Direction éditoriale; Rendu premium; Plus de variations |
| 6 | `corporate-linkedin` | 48 h | Aucune source formule trouvée |
| 7 | `duo-couple` | 48 h | Séance à deux; Guidage des poses; Ambiance naturelle |
| 8 | `famille` | 48 h | Aucune source formule trouvée |
| 9 | `groupe-fun` | 72 h | Aucune source formule trouvée |
| 10 | `enfant` | 48 h | Aucune source formule trouvée |
| 11 | `anniversaire` | 48 h | Aucune source formule trouvée |
| 12 | `maternite` | 72 h | Aucune source formule trouvée |
| 13 | `bebe-naissance` | 48 h | Aucune source formule trouvée |
| 14 | `fiancailles-decouverte` | 72 h | Aucune source formule trouvée |
| 15 | `fiancailles-classic` | 72 h | Aucune source formule trouvée |
| 16 | `fiancailles-premium` | 5 jours | Aucune source formule trouvée |
| 17 | `pre-mariage-decouverte` | 72 h | Aucune source formule trouvée |
| 18 | `pre-mariage-classic` | 5 jours | Aucune source formule trouvée |
| 19 | `pre-mariage-premium` | 7 jours | Aucune source formule trouvée |
| 20 | `event-lite` | 5 jours | Aucune source formule trouvée |
| 21 | `event-standard` | 7 jours | Aucune source formule trouvée |
| 22 | `event-premium` | 7 jours | Aucune source formule trouvée |

### Conditions et mentions déjà disponibles

- CGV communes : version publiée du 31 juillet 2026, sections Réservation/prix/paiement, Retards/annulations/report, Droit à l'image, Traitement numérique, Exécution/livraison/responsabilité et Réclamations/litiges.
- Règle d'articulation déjà approuvée dans le DOCX : « Le récapitulatif de la formule et le tarif affichés avant l'envoi de la demande complètent ces conditions. »
- Flash Social : l'audit confirme que l'autorisation d'image constitue une condition obligatoire de cette offre promotionnelle. Aucune généralisation aux autres formules ne sera faite sans source.

La version tarifaire doit conserver uniquement les mentions particulières de la formule et la référence/version des CGV communes; elle ne doit pas recopier arbitrairement tout le document juridique dans chaque formule.

## Écarts réels après récupération

| Élément | Situation après réception du catalogue | Suite |
|---|---|---|
| Résumé public / contenu | Descriptions FR/EN fournies pour 34 packs | Reprendre le FR sans amplification; conserver l'EN jusqu'à décision de localisation |
| Inclusions | Les éléments principaux sont présents dans chaque description | Les séparer en liste structurée sans modifier le sens |
| Livraison | Six délais explicites de 10/15/20 jours ouvrés; 28 packs et Happy Hours sans valeur | Compléter 29 enregistrements, ou confirmer que Happy Hours reprend Flash Social; ne pas employer le fallback historique |
| Durée | 33/34 packs renseignés; Identité Standard sans durée | Fournir une durée ou déclarer l'offre non réservable en ligne |
| Conditions communes | CGV publiées du 31 juillet 2026 | Référencer cette version dans chaque fiche |
| Conditions particulières | Happy Hours, étudiant, parrainage et engagements d'abonnement documentés | Implémenter les règles applicables et leur audit |
| Structure | 34 packs et trois promotions au lieu de 22 formules agrégées | Cible 35 offres + deux règles promotionnelles séparées |

## Réponse OWNER attendue

La question de source est résolue. Restent uniquement :

1. les délais de livraison de 28 packs et de Happy Hours;
2. la durée ou le caractère non réservable d'Identité Standard;
3. le mode de souscription des trois abonnements;
4. le choix de publier maintenant le français seul ou d'ajouter le bilingue.

Après ces réponses, l'aperçu définitif sera transformé en versions `DRAFT`. Aucune version ne sera validée ou publiée sans contrôle OWNER du rendu final.

## Baseline d'intégrité

Production avant toute écriture : 22 versions 1 `PUBLISHED`, zéro `DRAFT`, zéro `VALIDATED`, 13 réservations et 13 snapshots. Empreinte SHA-256 des liaisons et données tarifaires figées : `30c8b4efc31b89abe8081a1e1d7b33576bb5e4002afc025d4932bb824a968be1`.

Aucun UPDATE SQL direct, envoi fournisseur, réservation QA ou contenu commercial inventé n'est autorisé par ce document.
