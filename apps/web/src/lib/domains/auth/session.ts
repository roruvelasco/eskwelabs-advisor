export interface SessionActor {
  id: string;
  email: string;
  role: 'eif' | 'admin';
  isActive: boolean;
}

export function getBrowserSessionActor(): SessionActor | null {
  if (typeof document === 'undefined') return null;

  const cookies = Object.fromEntries(
    document.cookie.split('; ').map((entry) => {
      const [key, ...value] = entry.split('=');
      return [key, decodeURIComponent(value.join('='))];
    })
  );

  if (!cookies.eskwelabs_actor_id || !cookies.eskwelabs_actor_email) {
    return null;
  }

  return {
    id: cookies.eskwelabs_actor_id,
    email: cookies.eskwelabs_actor_email,
    role: cookies.eskwelabs_actor_role === 'admin' ? 'admin' : 'eif',
    isActive: cookies.eskwelabs_actor_active !== 'false'
  };
}
