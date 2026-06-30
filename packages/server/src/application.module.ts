import type { DrizzleService } from './db/drizzle.service';

export class ApplicationModule {
  constructor(private drizzleService?: Pick<DrizzleService, 'close'>) {}

  async start() {}

  async stop() {
    await this.drizzleService?.close();
  }
}
