export type AppRole = 'admin' | 'intern';

export const ROLE_HOME: Record<AppRole, string> = {
  admin: '/admin',
  intern: '/advisors'
};

const ROUTE_RULES: Array<{
  prefix: string;
  roles: AppRole[];
}> = [
  { prefix: '/admin', roles: ['admin'] },
  { prefix: '/advisors', roles: ['admin', 'intern'] },
  { prefix: '/chat', roles: ['admin', 'intern'] }
];

function normalizeInternalPath(raw: string | null): string | null {
  if (!raw) return null;

  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    return null;
  }

  const base = 'https://internal.invalid';
  const parsed = new URL(raw, base);

  if (parsed.origin !== base) return null;

  if (
    parsed.pathname === '/login' ||
    parsed.pathname === '/admin/login' ||
    parsed.pathname === '/auth/continue'
  ) {
    return null;
  }

  return `${parsed.pathname}${parsed.search}`;
}

function canAccess(role: AppRole, destination: string): boolean {
  const pathname = new URL(destination, 'https://internal.invalid').pathname;

  const matchedRule = ROUTE_RULES.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  return matchedRule ? matchedRule.roles.includes(role) : false;
}

export function resolvePostLoginDestination(
  rawReturnTo: string | null,
  role: AppRole
): string {
  const fallback = ROLE_HOME[role];
  const destination = normalizeInternalPath(rawReturnTo);

  if (!destination) return fallback;
  if (!canAccess(role, destination)) return fallback;

  return destination;
}
