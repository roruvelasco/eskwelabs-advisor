import NextAuth from 'next-auth';
import type { NextAuthOptions } from 'next-auth';
import { authConfig } from './auth.config';

const handler = NextAuth(authConfig as unknown as NextAuthOptions);

export const handlers = { GET: handler, POST: handler };
export default handler;

export type { Session } from 'next-auth';
