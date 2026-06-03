import { Hono } from 'hono';

import type { HonoEnv } from '../utils/hono';

export abstract class Controller {
  protected controller = new Hono<HonoEnv>();
  abstract routes(): Hono<HonoEnv>;
}
