const createSubmissionKey = () => globalThis.crypto.randomUUID();

export const createLeadSubmissionController = (createKey = createSubmissionKey) => {
  let inFlight = false;
  let submissionKey = createKey();

  return {
    start(formElement) {
      if (inFlight) return null;
      inFlight = true;
      return { formElement, submissionKey };
    },
    fail() {
      inFlight = false;
    },
    next() {
      inFlight = false;
      submissionKey = createKey();
    },
  };
};

export const resetFormAfterSuccess = (formElement, succeeded) => {
  if (succeeded) formElement.reset();
  return succeeded;
};
