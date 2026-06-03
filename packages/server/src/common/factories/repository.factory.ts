import { DrizzleService } from '../../db/drizzle.service';

export abstract class Repository {
  constructor(protected drizzle: DrizzleService) {}
}
