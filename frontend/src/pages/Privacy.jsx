import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import LegalPageLayout from '../components/LegalPageLayout';
import { ACTIVE_PROCESSORS, DATA_RETENTION, PRIVACY_CONTACT, PRIVACY_RIGHTS } from '../content/legal';

const Privacy = () => (
  <LegalPageLayout icon={ShieldCheck} title="Politique de confidentialité">
    <div className="legal-notice">
      Cette politique complète les informations présentées au moment de la réservation et s’applique aux demandes envoyées depuis le site, aux réservations et au suivi des prestations.
    </div>

    <section className="legal-section">
      <h2>1. Responsable du traitement et contact</h2>
      <p>
        Golden Studio Plus détermine les finalités et les moyens des traitements décrits ci-dessous. Pour toute question ou demande relative à vos données, écrivez à{' '}
        <a href={`mailto:${PRIVACY_CONTACT.email}`}>{PRIVACY_CONTACT.email}</a>, appelez le{' '}
        <a href="tel:+237673026654">{PRIVACY_CONTACT.phone}</a> ou utilisez{' '}
        <a href={PRIVACY_CONTACT.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a>. Une vérification d’identité peut être demandée lorsqu’elle est nécessaire pour protéger les données concernées.
      </p>
    </section>

    <section className="legal-section">
      <h2>2. Données collectées</h2>
      <p>Selon le service utilisé, nous pouvons traiter les catégories suivantes :</p>
      <ul>
        <li><strong>Identité et contact :</strong> nom, prénom, téléphone et adresse e-mail.</li>
        <li><strong>Préférences de séance :</strong> date de naissance facultative, genre, canal de découverte, formule, créneau, durée, notes, demandes particulières et statut de la réservation.</li>
        <li><strong>Choix et preuves :</strong> acceptation des conditions, autorisation relative au droit à l’image et consentement facultatif aux notifications WhatsApp, avec leurs dates.</li>
        <li><strong>Vérification manuelle du paiement :</strong> mode de paiement mobile sélectionné, numéro utilisé, référence de transaction, montant, statut et éventuel remboursement. Le site ne collecte ni numéro de carte bancaire ni cryptogramme.</li>
        <li><strong>Demandes générales, créatives et B2B :</strong> objet, message, entreprise, RCCM ou NIU communiqué, type de prestation, source de la demande et informations saisies librement.</li>
        <li><strong>Images et fichiers de prestation :</strong> photographies et éléments nécessaires à la retouche, à la livraison et, uniquement avec l’autorisation requise, à la promotion du Studio.</li>
        <li><strong>Données techniques :</strong> adresse IP, date et heure, ressource demandée, navigateur, résultats anti-abus et journaux de sécurité ou d’erreur.</li>
        <li><strong>Administration :</strong> comptes des personnes autorisées, actions, décisions, commentaires internes et historique des notifications ou synchronisations.</li>
      </ul>
      <p>Les champs facultatifs sont signalés comme tels. Évitez d’inscrire des données sensibles ou inutiles dans les zones de texte libre.</p>
    </section>

    <section className="legal-section">
      <h2>3. Finalités et fondements</h2>
      <ul>
        <li>répondre aux demandes et préparer, exécuter puis suivre une prestation ou une réservation ;</li>
        <li>vérifier manuellement un paiement et traiter une annulation ou un remboursement ;</li>
        <li>gérer les créneaux, le calendrier, les notifications et la livraison ;</li>
        <li>respecter les obligations comptables, fiscales et légales applicables ;</li>
        <li>sécuriser le site, prévenir les abus et conserver la preuve des actions ;</li>
        <li>utiliser une image à des fins promotionnelles uniquement sur la base de l’autorisation requise.</li>
      </ul>
      <p>Ces traitements reposent, selon le cas, sur les mesures précontractuelles demandées, l’exécution du contrat, une obligation légale, l’intérêt légitime de sécuriser et administrer le service, ou votre consentement lorsqu’il est requis.</p>
    </section>

    <section className="legal-section">
      <h2>4. Destinataires et prestataires</h2>
      <p>Les données sont accessibles aux personnes habilitées de Golden Studio Plus et aux prestataires strictement nécessaires. Elles ne sont ni vendues ni utilisées pour de la publicité étrangère à nos services.</p>
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
      <p>Les liens vers WhatsApp ou les réseaux sociaux ouvrent un service tiers uniquement lorsque vous choisissez de les utiliser. Certains prestataires peuvent traiter des données hors du Cameroun selon leur infrastructure ; Golden Studio Plus limite alors les données transmises à ce qui est nécessaire au service concerné.</p>
    </section>

    <section className="legal-section">
      <h2>5. Traitement numérique des images</h2>
      <p>Les fichiers peuvent être traités avec des logiciels professionnels ou des services cloud dédiés à la retouche et à l’optimisation. L’accès est limité aux personnes et prestataires nécessaires à la réalisation de la prestation. Une autorisation de diffusion promotionnelle n’est pas une condition générale de traitement ou de livraison des images ; elle n’est obligatoire que pour une offre expressément présentée comme promotionnelle.</p>
    </section>

    <section className="legal-section">
      <h2>6. Durées de conservation</h2>
      <p>Les durées ci-dessous constituent les règles opérationnelles appliquées, sous réserve d’une obligation légale, d’un litige ou d’une demande justifiée imposant une conservation différente.</p>
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
      <h2>7. Cookies et mesure d’audience</h2>
      <p>Le site public n’utilise actuellement ni cookie publicitaire ni outil de mesure d’audience. Un cookie strictement nécessaire, sécurisé et inaccessible au JavaScript est utilisé uniquement pour la session de l’espace d’administration ; sa durée maximale est de huit heures. L’activation future d’un outil non essentiel nécessiterait une information et, lorsque requis, un choix préalable.</p>
    </section>

    <section className="legal-section">
      <h2>8. Sécurité</h2>
      <p>Le site utilise HTTPS, des contrôles d’accès, des sessions d’administration protégées, une limitation des requêtes, une journalisation des actions sensibles et un stockage privé des fichiers maîtres. Aucun dispositif ne peut toutefois garantir une sécurité absolue.</p>
    </section>

    <section className="legal-section">
      <h2>9. Vos droits</h2>
      <p>Conformément à la loi n° 2024/017 du 23 décembre 2024 relative à la protection des données à caractère personnel au Cameroun, vous pouvez notamment :</p>
      <ul>{PRIVACY_RIGHTS.map((right) => <li key={right}>{right}</li>)}</ul>
      <p>Adressez votre demande à <a href={`mailto:${PRIVACY_CONTACT.email}`}>{PRIVACY_CONTACT.email}</a>{' '}en précisant son objet. Le retrait d’une autorisation relative au droit à l’image est traité séparément d’une demande d’effacement et produit effet pour l’avenir.</p>
    </section>

    <section className="legal-section">
      <h2>10. Documents associés et mises à jour</h2>
      <p>Consultez également les <Link to="/cgv">conditions générales de vente</Link> et les{' '}<Link to="/mentions-legales">mentions légales</Link>. Toute évolution importante de cette politique sera publiée sur cette page avec une nouvelle date de mise à jour.</p>
    </section>
  </LegalPageLayout>
);

export default Privacy;
