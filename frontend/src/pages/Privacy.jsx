import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import LegalPageLayout from '../components/LegalPageLayout';
import {
  ACTIVE_PROCESSORS,
  DATA_RETENTION,
  PRIVACY_CONTACT,
  PRIVACY_LAST_UPDATED,
  PRIVACY_RIGHTS,
} from '../content/legal';

const Privacy = () => (
  <LegalPageLayout icon={ShieldCheck} title="Politique de confidentialité" lastUpdated={PRIVACY_LAST_UPDATED}>
    <div className="legal-notice">
      La présente politique complète les informations communiquées au moment de la réservation et s’applique aux demandes envoyées depuis le site, aux réservations, aux paiements, aux communications et au suivi des prestations.
    </div>

    <section className="legal-section">
      <h2>1. Responsable du traitement et contact</h2>
      <p>
        Golden Studio Plus détermine les finalités et les moyens des traitements décrits ci-dessous. Pour toute question ou demande relative à vos données, écrivez à{' '}
        <a href={`mailto:${PRIVACY_CONTACT.email}`}>{PRIVACY_CONTACT.email}</a>. Une vérification d’identité peut être demandée lorsqu’elle est nécessaire pour protéger les données concernées.
      </p>
      <p>
        Vous pouvez aussi appeler le <a href="tel:+237673026654">{PRIVACY_CONTACT.phone}</a> ou utiliser{' '}
        <a href={PRIVACY_CONTACT.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a> pour une prise de contact, sans envoyer de donnée sensible ou inutile.
      </p>
    </section>

    <section className="legal-section">
      <h2>2. Données collectées</h2>
      <p>Selon le service utilisé, la relation avec le Studio et les informations librement communiquées, Golden Studio Plus peut traiter notamment les catégories suivantes :</p>
      <ul>
        <li><strong>Identité et contact :</strong> nom, prénom, téléphone et adresse e-mail.</li>
        <li><strong>Préférences de séance :</strong> date de naissance facultative, genre, canal de découverte, formule, créneau, durée, notes, demandes particulières et statut de la réservation.</li>
        <li><strong>Choix et preuves :</strong> acceptation des conditions, autorisation relative au droit à l’image et consentement facultatif aux notifications WhatsApp, avec leurs dates.</li>
        <li><strong>Vérification manuelle du paiement :</strong> mode de paiement mobile sélectionné, numéro utilisé, référence de transaction, justificatif éventuellement transmis, montant, statut et éventuel remboursement. Le site ne collecte ni numéro de carte bancaire ni cryptogramme.</li>
        <li><strong>Demandes générales, créatives et B2B :</strong> objet, message, entreprise, RCCM ou NIU communiqué, type de prestation, source de la demande et informations saisies librement.</li>
        <li><strong>Images et fichiers de prestation :</strong> photographies et éléments nécessaires à la retouche, à la livraison et, uniquement avec l’autorisation requise, à la promotion du Studio.</li>
        <li><strong>Données techniques :</strong> adresse IP, date et heure, ressource demandée, navigateur, résultats anti-abus et journaux de sécurité, de synchronisation ou d’erreur.</li>
        <li><strong>Administration :</strong> comptes des personnes autorisées, actions, décisions, commentaires internes et historique des notifications ou synchronisations.</li>
      </ul>
      <p>Cette liste présente les principales catégories de données susceptibles d’être traitées. Elle peut être complétée lorsqu’une autre donnée s’avère nécessaire à la fourniture d’un service, au fonctionnement ou à la sécurité du site, au respect d’une obligation légale ou réglementaire, ou à la défense des droits du Studio. Toute donnée supplémentaire demeure traitée conformément aux finalités et aux principes exposés dans la présente politique.</p>
      <p>Évitez d’inscrire des données sensibles ou inutiles dans les zones de texte libre.</p>
    </section>

    <section className="legal-section">
      <h2>3. Finalités et fondements des traitements</h2>
      <p>Golden Studio Plus traite les données personnelles dans la mesure nécessaire à la fourniture de ses services, à l’administration de son activité et à la protection de ses intérêts, notamment afin de :</p>
      <ul>
        <li>recevoir, identifier, qualifier et traiter les demandes de renseignements, de devis, de réservation, de collaboration ou de prestation ;</li>
        <li>évaluer la faisabilité d’une demande, préparer une offre, recueillir les instructions du client et accomplir les démarches précontractuelles nécessaires ;</li>
        <li>créer, organiser, confirmer, exécuter, modifier, reporter, annuler, clôturer et suivre les réservations et les prestations ;</li>
        <li>gérer les disponibilités, les créneaux, les durées, les retards, les absences, les demandes particulières et les conséquences opérationnelles ou financières qui en résultent ;</li>
        <li>vérifier manuellement les paiements, rapprocher les références de transaction, détecter les erreurs, incohérences, doublons ou tentatives de fraude, suivre les montants dus et traiter les annulations, avoirs ou remboursements applicables ;</li>
        <li>gérer les communications avec le client, les confirmations, rappels, notifications, échanges par e-mail ou WhatsApp, synchronisations de calendrier et preuves de transmission ou de livraison ;</li>
        <li>préparer, produire, retoucher, conserver temporairement, sécuriser et livrer les photographies, fichiers ou autres éléments nécessaires à la réalisation et au suivi de la prestation ;</li>
        <li>administrer, maintenir et améliorer le site, les formulaires, les comptes, les outils de réservation et les services associés, ainsi qu’évaluer leur fonctionnement, leur fiabilité et leur utilisation ;</li>
        <li>protéger le site, les comptes, les systèmes, les données et les activités du Studio, prévenir les abus, fraudes, accès non autorisés et incidents, effectuer les vérifications nécessaires et conserver les journaux techniques, de sécurité ou d’erreur ;</li>
        <li>conserver la preuve des demandes, instructions, consentements, autorisations, conditions acceptées, communications, paiements, décisions administratives, notifications et opérations réalisées ;</li>
        <li>constater, exercer, préserver ou défendre les droits et intérêts du Studio, notamment en cas de réclamation, contestation, impayé, demande de remboursement, différend ou procédure judiciaire ou administrative ;</li>
        <li>satisfaire aux obligations comptables, fiscales, contractuelles, réglementaires et légales applicables, ainsi qu’aux demandes valablement formulées par une autorité compétente ;</li>
        <li>utiliser l’image du client à des fins de communication ou de promotion du Studio uniquement lorsque l’autorisation requise a été obtenue et dans les limites de celle-ci.</li>
      </ul>
      <p>Selon la finalité concernée et le stade de la relation, ces traitements reposent, dans les conditions reconnues par la réglementation applicable, sur les mesures précontractuelles demandées par la personne concernée, l’exécution d’un contrat ou d’une réservation, le respect d’une obligation légale ou réglementaire, la protection et l’administration du service, la constatation, l’exercice ou la défense de droits, ou le consentement lorsque celui-ci est requis.</p>
      <p>Les intérêts du Studio comprennent notamment l’organisation et la continuité de son activité, la gestion de ses relations avec les clients et partenaires, la sécurisation de ses services et de ses revenus, la prévention des fraudes et abus, l’amélioration de ses outils, la conservation des preuves ainsi que la constatation, l’exercice et la défense de ses droits.</p>
      <p>Une même catégorie de données peut être utilisée pour plusieurs finalités distinctes et compatibles. Toute utilisation ultérieure incompatible avec les finalités initialement annoncées fera, lorsque la réglementation l’exige, l’objet d’une information ou d’une autorisation complémentaire.</p>
      <p>Lorsque certaines données sont nécessaires à l’étude d’une demande, à la conclusion ou à l’exécution d’une réservation, à la vérification d’un paiement ou au respect d’une obligation, leur absence ou leur caractère manifestement inexact peut empêcher Golden Studio Plus de traiter la demande, de confirmer la réservation, d’exécuter la prestation ou d’assurer son suivi.</p>
      <p>Lorsqu’un traitement repose sur le consentement, son refus ou son retrait peut rendre indisponible la fonctionnalité ou l’utilisation concernée. Le retrait produit ses effets pour l’avenir et ne remet pas en cause les traitements antérieurement réalisés ni les conservations qui demeurent nécessaires sur un autre fondement autorisé.</p>
    </section>

    <section className="legal-section">
      <h2>4. Destinataires, prestataires et transferts</h2>
      <p>Les données sont accessibles, dans la limite de leurs attributions, aux personnes habilitées de Golden Studio Plus et aux prestataires, partenaires ou conseils dont l’intervention est nécessaire ou utile au fonctionnement du site, à la gestion des demandes, réservations, calendriers, formulaires, communications, notifications, paiements, sauvegardes, fichiers, traitements numériques, livraisons, opérations comptables, activités de sécurité ou défense des droits.</p>
      <p>Elles peuvent également être communiquées, lorsque cela est nécessaire, aux opérateurs de paiement, établissements financiers, assureurs, professionnels du droit ou du chiffre, prestataires de recouvrement, autorités administratives ou judiciaires et autres personnes habilitées, afin de respecter une obligation, répondre à une demande régulière, prévenir une fraude ou constater, exercer ou défendre un droit.</p>
      <h3>Prestataires et intégrations actuellement déclarés</h3>
      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead><tr><th>Destinataire</th><th>Situation</th><th>Finalité et données concernées</th></tr></thead>
          <tbody>
            {ACTIVE_PROCESSORS.map((processor) => (
              <tr key={processor.name}>
                <th scope="row">{processor.name}</th>
                <td>{processor.status}</td>
                <td>{processor.purpose} {processor.data}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>Golden Studio Plus peut choisir, remplacer, ajouter ou retirer un prestataire, une solution ou une intégration dès lors que la catégorie de service, les finalités poursuivies et les garanties attendues demeurent compatibles avec la présente politique. Une notice ou une liste séparée peut, lorsque cela est utile ou requis, fournir des informations techniques plus détaillées et régulièrement mises à jour.</p>
      <p>Certains prestataires peuvent traiter des données depuis un autre pays selon leur infrastructure. Dans ce cas, le Studio limite les données transmises à ce qui est nécessaire et accomplit, lorsque la loi l’exige, les formalités, autorisations ou garanties applicables. Les prestataires agissant pour leur propre compte restent responsables de leurs traitements. Les données ne sont pas vendues comme une activité commerciale autonome.</p>
      <p>Les liens vers WhatsApp ou les réseaux sociaux ouvrent un service tiers uniquement lorsque vous choisissez de les utiliser.</p>
    </section>

    <section className="legal-section">
      <h2>5. Traitement numérique des images</h2>
      <p>Les fichiers peuvent être traités avec des logiciels professionnels ou des services cloud dédiés à la retouche et à l’optimisation. L’accès est limité aux personnes et prestataires nécessaires à la réalisation de la prestation.</p>
      <p>Une autorisation de diffusion promotionnelle n’est pas une condition générale de traitement ou de livraison des images ; elle n’est obligatoire que pour une offre expressément présentée comme promotionnelle.</p>
    </section>

    <section className="legal-section">
      <h2>6. Durées de conservation et archivage</h2>
      <p>Les données sont conservées sous une forme active pendant la durée nécessaire à la finalité pour laquelle elles ont été recueillies. Elles peuvent ensuite être supprimées, anonymisées ou placées dans une archive intermédiaire à accès restreint lorsqu’elles restent nécessaires au respect d’une obligation, à la sécurité, à la continuité des opérations ou à la constatation, à l’exercice ou à la défense des droits du Studio ou de tiers.</p>
      <p>La durée applicable dépend notamment de la nature de la donnée, du stade de la demande, de l’existence d’une réservation, d’un paiement, d’une prestation, d’une livraison ou d’un litige, ainsi que des délais comptables, fiscaux, contractuels, réglementaires, probatoires ou de prescription en vigueur.</p>
      <ul>
        <li>les demandes, réservations, prestations, communications, confirmations et éléments de livraison peuvent être conservés pendant la relation puis archivés pendant la durée nécessaire à la preuve et à la défense des droits ;</li>
        <li>les données de paiement, de vérification, d’annulation et de remboursement sont conservées selon les obligations financières, comptables, fiscales et probatoires applicables ;</li>
        <li>les acceptations de conditions, consentements, autorisations, retraits et autres preuves peuvent être conservés aussi longtemps qu’une utilisation, une contestation ou une responsabilité demeure possible ;</li>
        <li>les images, fichiers de travail et livrables sont conservés selon les besoins de production, de livraison, de sécurité et d’archivage convenus ; leur conservation permanente ou leur restauration ne sont pas garanties, sauf engagement écrit contraire ;</li>
        <li>les journaux techniques, anti-abus et de sécurité sont conservés pendant une durée proportionnée aux besoins de détection, d’analyse, d’investigation et de preuve ;</li>
        <li>les sauvegardes peuvent conserver temporairement des copies résiduelles jusqu’à leur rotation normale, sans réutilisation active incompatible avec la finalité initiale.</li>
      </ul>
      <p>Une réclamation, un incident, un soupçon de fraude, une enquête, un impayé, une procédure ou un différend peut prolonger la conservation jusqu’à sa clôture définitive, augmentée des délais de recours ou de prescription applicables. Une demande d’effacement n’impose pas la suppression d’une donnée dont la conservation demeure nécessaire ou légalement autorisée ; le Studio peut alors en limiter l’accès et l’usage.</p>
      <p>Toute durée minimale ou maximale imposée à l’avenir par la loi, une autorité compétente ou un référentiel obligatoire se substitue automatiquement à la durée antérieurement appliquée, sans qu’il soit nécessaire de réécrire l’ensemble de la présente politique.</p>
      <h3>Précisions opérationnelles actuellement appliquées</h3>
      <p>Les durées ci-dessous sont appliquées sous réserve des exceptions, obligations et prolongations décrites ci-dessus.</p>
      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead><tr><th>Catégorie</th><th>Durée</th><th>Précision</th></tr></thead>
          <tbody>
            {DATA_RETENTION.map((item) => (
              <tr key={item.category}>
                <th scope="row">{item.category}</th>
                <td>{item.duration}</td>
                <td>{item.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>

    <section className="legal-section">
      <h2>7. Cookies, traceurs et mesure d’audience</h2>
      <p>Le site peut utiliser des cookies et technologies analogues, notamment des pixels, balises, identifiants, espaces de stockage local, journaux ou mécanismes similaires. Ces outils peuvent servir au fonctionnement, à la navigation, à la sécurité, à la gestion des préférences, à la prévention des abus, à la continuité des formulaires, à la preuve des sessions, à la mesure d’audience, à l’analyse des performances, des erreurs et des parcours, à l’évaluation des campagnes, à l’amélioration du site ou à l’intégration de fonctions fournies par des tiers.</p>
      <p>Les traceurs strictement nécessaires peuvent être utilisés sans consentement préalable lorsque la loi le permet. Les traceurs facultatifs sont soumis au choix de l’utilisateur lorsque ce choix est requis. Le refus ou le blocage de certains outils peut réduire la personnalisation, empêcher la mémorisation de préférences ou dégrader certaines fonctions.</p>
      <p>Les outils, fournisseurs, durées techniques et réglages peuvent évoluer. Les informations et choix à jour peuvent être présentés dans un module de préférences ou une notice séparée. Le retrait d’un consentement ne produit d’effet que pour l’avenir et n’efface ni les traitements antérieurs licites, ni les statistiques déjà agrégées ou anonymisées, ni les données dont la conservation demeure nécessaire à la sécurité ou à la preuve.</p>
      <div className="legal-notice">
        <strong>Situation actuelle :</strong> Le site public n’utilise actuellement ni cookie publicitaire ni outil de mesure d’audience. Un cookie strictement nécessaire, sécurisé et inaccessible au JavaScript est utilisé uniquement pour la session de l’espace d’administration ; sa durée maximale est de huit heures. L’activation future d’un outil non essentiel nécessiterait une information et, lorsque requis, un choix préalable.
      </div>
    </section>

    <section className="legal-section">
      <h2>8. Sécurité</h2>
      <p>Golden Studio Plus met en œuvre des mesures techniques et organisationnelles raisonnables et proportionnées afin de protéger la confidentialité, l’intégrité, la disponibilité et la traçabilité des données. Ces mesures peuvent inclure notamment HTTPS, des contrôles d’accès, des sessions d’administration protégées, une limitation des requêtes, une journalisation des actions sensibles et un stockage privé des fichiers maîtres.</p>
      <p>Aucun dispositif ne pouvant garantir une sécurité absolue, le Studio ne garantit pas l’absence de tout incident indépendant de sa volonté. L’utilisateur reste responsable de la sécurité de ses appareils, comptes et moyens de communication, et doit signaler rapidement toute erreur ou compromission susceptible d’affecter ses données ou la prestation.</p>
    </section>

    <section className="legal-section">
      <h2>9. Vos droits et modalités d’exercice</h2>
      <p>Conformément à la loi n° 2024/017 du 23 décembre 2024 relative à la protection des données à caractère personnel au Cameroun, vous pouvez notamment, dans les conditions et limites prévues par la réglementation applicable :</p>
      <ul>{PRIVACY_RIGHTS.map((right) => <li key={right}>{right}</li>)}</ul>
      <p>Adressez votre demande écrite à <a href={`mailto:${PRIVACY_CONTACT.email}`}>{PRIVACY_CONTACT.email}</a>{' '}en précisant son objet et les informations permettant d’identifier les données concernées. Une preuve d’identité proportionnée ou des précisions peuvent être demandées afin d’éviter une divulgation ou une suppression frauduleuse.</p>
      <p>L’étendue d’un droit est appréciée au regard de la nature des données, du fondement du traitement, des obligations légales, des droits de tiers et de la nécessité pour le Studio de constater, exercer ou défendre ses droits. Une demande peut être limitée, adaptée ou différée dans les conditions permises par la loi afin de protéger les droits d’autrui, la confidentialité, la sécurité, les secrets d’affaires, la propriété intellectuelle, les méthodes anti-abus ou les besoins de preuve.</p>
      <p>Le droit à l’effacement n’est pas absolu. Des données peuvent être conservées lorsqu’elles sont nécessaires à l’exécution ou à la preuve d’un contrat, à la comptabilité, à la fiscalité, au traitement d’un paiement ou d’un remboursement, à la prévention de la fraude, à la sécurité, au respect d’une obligation, à la protection de tiers ou à la défense du Studio. La suppression d’une donnée visible n’entraîne pas nécessairement la disparition immédiate des sauvegardes, journaux, preuves ou archives à accès restreint.</p>
      <p>Le retrait d’une autorisation relative au droit à l’image est traité séparément de toute demande de suppression des autres données personnelles. Ce retrait ne produit d’effet que pour l’avenir et ne remet pas en cause les utilisations antérieurement réalisées par le Studio conformément à l’autorisation initialement accordée. Il n’impose pas le rappel ou la destruction des supports déjà produits ou diffusés, n’annule pas les campagnes achevées et n’empêche pas la conservation de copies non publiques nécessaires à la preuve. Les nouvelles utilisations cessent après un délai techniquement raisonnable et après identification suffisamment précise des contenus concernés, sous réserve des obligations légales, des sauvegardes et des droits de tiers.</p>
    </section>

    <section className="legal-section">
      <h2>10. Documents associés</h2>
      <p>Consultez également les <Link to="/cgv">conditions générales de vente</Link> et les{' '}<Link to="/mentions-legales">mentions légales</Link>.</p>
    </section>
  </LegalPageLayout>
);

export default Privacy;
