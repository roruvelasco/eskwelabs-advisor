import { dataResponse } from '../common/pagination';

export class AdminSerializer {
  overview(row: unknown) {
    return dataResponse(row);
  }
}
