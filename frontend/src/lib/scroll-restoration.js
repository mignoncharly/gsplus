export const createScrollPositionStore = () => {
  const positions = new Map();

  return {
    save(key, position) {
      positions.set(key, {
        x: Number(position?.x) || 0,
        y: Number(position?.y) || 0,
      });
    },
    target(key, navigationType) {
      if (navigationType !== 'POP') {
        return { x: 0, y: 0 };
      }

      return positions.get(key) || { x: 0, y: 0 };
    },
  };
};
