import React from 'react';

const headingPattern = /^\d+\.\s+/;

const OwnerLegalDocument = ({ text }) => (
  <section className="legal-section" data-owner-source="true">
    {text.split(/\r?\n/).map((line, index) => {
      const content = line.trim();
      if (!content) return null;
      return headingPattern.test(content)
        ? <h2 key={`${index}-${content}`}>{content}</h2>
        : <p key={`${index}-${content}`}>{content}</p>;
    })}
  </section>
);

export default OwnerLegalDocument;
