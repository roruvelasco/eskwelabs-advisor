import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

const handler = NextAuth(authConfig);

export const handlers = { GET: handler, POST: handler };
export default handler;

export type { Session } from 'next-auth';
