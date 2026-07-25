import { groupServiceMedia } from '../content/service-media';

const ServiceGallery = ({ section, title, description }) => {
  const groups = groupServiceMedia(section);
  const headingId = `${section}-realisations-title`;

  return (
    <section className="service-realizations" aria-labelledby={headingId}>
      <div className="service-realizations__header">
        <p className="home-section-label">Réalisations</p>
        <h2 id={headingId}>{title}</h2>
        <p>{description}</p>
      </div>

      <div className="service-realizations__groups">
        {groups.map((group) => (
          <section key={group.category} className="service-realizations__group" aria-labelledby={`${section}-${group.category.toLowerCase().replaceAll(' ', '-')}`}>
            <h3 id={`${section}-${group.category.toLowerCase().replaceAll(' ', '-')}`}>{group.category}</h3>
            <div className="service-realizations__grid">
              {group.items.map((item) => (
                <figure key={item.slug} className="service-realizations__item">
                  <img
                    src={item.src}
                    srcSet={item.srcSet}
                    sizes={item.sizes}
                    width={item.width}
                    height={item.height}
                    alt={item.alt}
                    loading="lazy"
                    decoding="async"
                  />
                  <figcaption>{item.title}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
};

export default ServiceGallery;
