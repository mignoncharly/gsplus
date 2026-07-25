export const createLatestRequestGate = () => {
  let version = 0;

  return {
    begin() {
      version += 1;
      return version;
    },
    invalidate() {
      version += 1;
    },
    isCurrent(requestVersion) {
      return requestVersion === version;
    },
  };
};
