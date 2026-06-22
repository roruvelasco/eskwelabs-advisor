import type { AdminService } from '../admin.service';

export class AdminOverviewUseCase {
  constructor(private adminService: AdminService) {}

  async execute() {
    return this.adminService.overview();
  }
}
