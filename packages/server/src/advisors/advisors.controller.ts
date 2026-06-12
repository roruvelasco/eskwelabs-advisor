import { Controller } from '../common/factories/controller.factory';
import { requireActor } from '../common/middleware/auth.middleware';

import { AdvisorRuntimeService } from './advisor-runtime.service';
import { AdvisorsSerializer } from './advisors.serializer';
import { AdvisorsService } from './advisors.service';

export class AdvisorController extends Controller {
  constructor(
    private advisorsService: AdvisorsService,
    private advisorRuntimeService: AdvisorRuntimeService,
    private advisorsSerializer: AdvisorsSerializer
  ) {
    super();
  }

  routes() {
    this.controller.use('/advisors/*', requireActor(['eif', 'admin']));
    this.controller.use('/advisors', requireActor(['eif', 'admin']));

    return this.controller.get('/advisors', async (c) => {
      const rows = await this.advisorsService.list();
      const withAvailability = await Promise.all(
        rows.map(async (row) => {
          const result = await this.advisorRuntimeService.checkReadiness(
            row.id
          );
          return {
            ...row,
            availability: result.ready
              ? ({ status: 'available' } as const)
              : ({
                  status: 'unavailable' as const,
                  reasons: result.reasons.map((r) => r.code)
                } as const)
          };
        })
      );
      return c.json(this.advisorsSerializer.list(withAvailability));
    });
  }
}
