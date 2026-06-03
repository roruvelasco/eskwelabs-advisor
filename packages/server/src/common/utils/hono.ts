export type ActorRole = 'eif' | 'admin';

export interface Actor {
  id: string;
  email: string;
  role: ActorRole;
  isActive: boolean;
}

export interface HonoEnv {
  Variables: {
    actor?: Actor;
  };
}
