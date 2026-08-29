import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { createScrollPositionStore } from '../lib/scroll-restoration';

const HASH_TARGET_TIMEOUT_MS = 5_000;

const hashTargetId = (hash) => {
  if (!hash) return '';
  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return '';
  }
};

const focusHashTarget = (hash) => {
  const id = hashTargetId(hash);
  const target = id ? document.getElementById(id) : null;
  if (!target) return false;

  target.scrollIntoView({ block: 'start', behavior: 'auto' });
  target.focus({ preventScroll: true });
  return true;
};

const focusMain = () => {
  const main = document.getElementById('main-content');
  main?.focus({ preventScroll: true });
};

const isAdminPath = (pathname) => pathname === '/admin' || pathname.startsWith('/admin/');

const ScrollManager = () => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const store = useRef(createScrollPositionStore());
  const previousKey = useRef(location.key);
  const previousPathname = useRef(location.pathname);

  useEffect(() => {
    const previousSetting = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';

    return () => {
      window.history.scrollRestoration = previousSetting;
    };
  }, []);

  useLayoutEffect(() => {
    let observer;
    let timeoutId;
    let frameId;
    let settledFrameId;

    const stopHashObserver = () => {
      observer?.disconnect();
      if (timeoutId) window.clearTimeout(timeoutId);
    };
    const cleanup = () => {
      stopHashObserver();
      if (frameId) window.cancelAnimationFrame(frameId);
      if (settledFrameId) window.cancelAnimationFrame(settledFrameId);
    };

    const resolveHashTarget = () => {
      if (!location.hash || focusHashTarget(location.hash)) {
        stopHashObserver();
        return;
      }

      const main = document.getElementById('main-content');
      if (!main || observer) return;
      observer = new MutationObserver(() => {
        if (focusHashTarget(location.hash)) stopHashObserver();
      });
      observer.observe(main, { childList: true, subtree: true });
      timeoutId = window.setTimeout(stopHashObserver, HASH_TARGET_TIMEOUT_MS);
    };

    if (previousKey.current === location.key) {
      resolveHashTarget();
      return cleanup;
    }

    // Since Phase 2 the administration views are addressable, so switching view inside
    // /admin produces a route change. That is not a page transition: the administration
    // is a single screen that manages its own focus (drawer trap, feedback region,
    // record dialog), and moving focus to #main-content here would steal it from the
    // control the operator just used. Entering or leaving /admin is still a real
    // transition and keeps the normal scroll and focus handling.
    const movedWithinAdmin = isAdminPath(previousPathname.current) && isAdminPath(location.pathname);
    previousPathname.current = location.pathname;
    if (movedWithinAdmin) {
      previousKey.current = location.key;
      return cleanup;
    }

    store.current.save(previousKey.current, {
      x: window.scrollX,
      y: window.scrollY,
    });

    const target = store.current.target(location.key, navigationType);
    previousKey.current = location.key;

    const applyNavigationTarget = () => {
      window.scrollTo({ left: target.x, top: target.y, behavior: 'auto' });
      if (navigationType !== 'POP' && location.hash) {
        resolveHashTarget();
      } else {
        focusMain();
      }
    };

    applyNavigationTarget();
    frameId = window.requestAnimationFrame(() => {
      applyNavigationTarget();
      settledFrameId = window.requestAnimationFrame(applyNavigationTarget);
    });

    return cleanup;
  }, [location.hash, location.key, location.pathname, navigationType]);

  return null;
};

export default ScrollManager;
