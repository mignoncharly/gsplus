import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { createScrollPositionStore } from '../lib/scroll-restoration';

const ScrollManager = () => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const store = useRef(createScrollPositionStore());
  const previousKey = useRef(location.key);
  const initialRender = useRef(true);

  useEffect(() => {
    const previousSetting = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';

    return () => {
      window.history.scrollRestoration = previousSetting;
    };
  }, []);

  useLayoutEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    store.current.save(previousKey.current, {
      x: window.scrollX,
      y: window.scrollY,
    });

    const target = store.current.target(location.key, navigationType);
    window.scrollTo({ left: target.x, top: target.y, behavior: 'auto' });
    previousKey.current = location.key;

    if (navigationType !== 'POP') {
      const main = document.getElementById('main-content');
      main?.focus({ preventScroll: true });
    }
  }, [location.key, navigationType]);

  return null;
};

export default ScrollManager;
