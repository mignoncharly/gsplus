export const getShareData = ({ documentRef, locationRef }) => {
  const canonical = documentRef.querySelector('link[rel="canonical"]')?.href;
  const description = documentRef.querySelector('meta[name="description"]')?.content;
  return {
    title: documentRef.title || 'Golden Studio Plus',
    text: description || 'Découvrez Golden Studio Plus, studio photo premium à Douala.',
    url: canonical || locationRef.href,
  };
};

const legacyCopy = (documentRef, value) => {
  const input = documentRef.createElement('textarea');
  input.value = value;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  documentRef.body.appendChild(input);
  input.select();
  const copied = documentRef.execCommand?.('copy') === true;
  input.remove();
  return copied;
};

export const shareSite = async ({ navigatorRef, documentRef, locationRef }) => {
  const data = getShareData({ documentRef, locationRef });

  if (typeof navigatorRef.share === 'function') {
    try {
      await navigatorRef.share(data);
      return { status: 'shared', data };
    } catch (error) {
      if (error?.name === 'AbortError') return { status: 'aborted', data };
    }
  }

  try {
    if (typeof navigatorRef.clipboard?.writeText === 'function') {
      await navigatorRef.clipboard.writeText(data.url);
      return { status: 'copied', data };
    }
    if (legacyCopy(documentRef, data.url)) return { status: 'copied', data };
  } catch {
    // A visible failure result is returned below.
  }

  return { status: 'failed', data };
};
