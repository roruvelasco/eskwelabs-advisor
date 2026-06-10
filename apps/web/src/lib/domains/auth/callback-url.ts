function matchesPath(pathname: string, paths: string[]) {
  return paths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

export function roleCallbackUrl(
  value: string | null,
  fallback: string,
  paths: string[]
) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return fallback;
  }

  const url = new URL(value, 'http://localhost');
  if (!matchesPath(url.pathname, paths)) {
    return fallback;
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
