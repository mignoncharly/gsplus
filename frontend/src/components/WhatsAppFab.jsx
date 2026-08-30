import { useEffect, useRef } from 'react';
import { useSiteSettings } from '../lib/use-site-settings';
import { whatsappLink } from '../lib/site-settings';

const interactiveSelector = 'a[href], button, input, select, textarea, [role="button"], [role="option"], [tabindex]:not([tabindex="-1"])';
const keyboardSelector = 'input:not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]), select, textarea, [contenteditable="true"]';

const overlaps = (a, b, gap = 6) => (
  a.left < b.right + gap
  && a.right > b.left - gap
  && a.top < b.bottom + gap
  && a.bottom > b.top - gap
);

const isVisibleControl = (element) => {
  if (!(element instanceof HTMLElement) || element.closest('[inert], [aria-hidden="true"]')) return false;
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0
    && rect.top < window.innerHeight && rect.left < window.innerWidth;
};

const WhatsAppFab = () => {
  const { settings } = useSiteSettings();
  const fabRef = useRef(null);

  useEffect(() => {
    const fab = fabRef.current;
    if (!fab) return undefined;

    let animationFrame = 0;
    const visualViewport = window.visualViewport;

    const update = () => {
      animationFrame = 0;
      const compactViewport = window.matchMedia('(max-width: 992px)').matches;
      const activeElement = document.activeElement;
      const focusedKeyboardControl = compactViewport
        && activeElement instanceof HTMLElement
        && activeElement.matches(keyboardSelector);
      const reducedVisualViewport = Boolean(
        visualViewport && window.innerHeight - visualViewport.height > 100,
      );
      const keyboardOpen = focusedKeyboardControl || reducedVisualViewport;
      const modalOpen = Boolean(document.querySelector('[role="dialog"][aria-modal="true"]'));
      const fabBox = fab.getBoundingClientRect();
      const collision = !keyboardOpen && [...document.querySelectorAll(interactiveSelector)].some((element) => (
        element !== fab
        && !fab.contains(element)
        && isVisibleControl(element)
        && overlaps(fabBox, element.getBoundingClientRect())
      ));

      fab.dataset.keyboardOpen = String(keyboardOpen);
      fab.dataset.obscured = String(keyboardOpen || modalOpen || collision);
    };

    const scheduleUpdate = () => {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(update);
    };

    const observer = new MutationObserver(scheduleUpdate);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-hidden', 'class', 'disabled', 'hidden', 'inert'],
    });
    window.addEventListener('scroll', scheduleUpdate, { capture: true, passive: true });
    window.addEventListener('resize', scheduleUpdate, { passive: true });
    document.addEventListener('focusin', scheduleUpdate);
    document.addEventListener('focusout', scheduleUpdate);
    visualViewport?.addEventListener('resize', scheduleUpdate);
    visualViewport?.addEventListener('scroll', scheduleUpdate);
    scheduleUpdate();

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('scroll', scheduleUpdate, true);
      window.removeEventListener('resize', scheduleUpdate);
      document.removeEventListener('focusin', scheduleUpdate);
      document.removeEventListener('focusout', scheduleUpdate);
      visualViewport?.removeEventListener('resize', scheduleUpdate);
      visualViewport?.removeEventListener('scroll', scheduleUpdate);
    };
  }, []);

  return (
    <a
      ref={fabRef}
      href={whatsappLink(settings.identity.phoneE164) ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="whatsapp-fab"
      aria-label="Contacter Golden Studio Plus sur WhatsApp"
      data-keyboard-open="false"
      data-obscured="false"
    >
      <img
        className="whatsapp-fab__mark"
        src="/images/whatsapp-mark-white.svg"
        alt=""
        aria-hidden="true"
        draggable="false"
        width="36"
        height="36"
      />
    </a>
  );
};

export default WhatsAppFab;
