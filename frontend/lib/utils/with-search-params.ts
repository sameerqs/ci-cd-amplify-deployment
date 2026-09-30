export function withSearchParams(
  path: string,
  searchParams?: { toString?: () => string } | string | null,
  exclude?: string[],
) {
  if (!searchParams) return path;

  const incomingQs = typeof searchParams === 'string'
    ? searchParams.replace(/^\?/, '')
    : (typeof (searchParams as { toString?: unknown }).toString === 'function'
      ? (searchParams as { toString: () => string }).toString()
      : '');
  if (!incomingQs) return path;

  let hash = '';
  let pathWithoutHash = path;
  const hashIndex = path.indexOf('#');
  if (hashIndex !== -1) {
    pathWithoutHash = path.slice(0, hashIndex);
    hash = path.slice(hashIndex);
  }

  const [base, existingQs] = pathWithoutHash.split('?');

  try {
    const existing = new URLSearchParams(existingQs ?? '');
    const incoming = new URLSearchParams(incomingQs);

    if (exclude?.length) {
      for (const key of exclude) {
        incoming.delete(key);
      }
    }

    for (const [key, value] of incoming) {
      if (!existing.has(key)) {
        existing.append(key, value);
      }
    }

    const merged = existing.toString();
    return merged ? `${base}?${merged}${hash}` : `${base}${hash}`;
  } catch (err) {
    return path.includes('?') ? `${path}&${incomingQs}` : `${path}?${incomingQs}`;
  }
}

export default withSearchParams;
