import type { User } from './users.schema';
import { userDto, type UserDto } from './dto/users.dto';
import { paginatedResponse } from '../common/pagination';

export class UsersSerializer {
  private serialize(user: User): UserDto {
    return userDto.parse(user);
  }

  single(user: User) {
    return { data: this.serialize(user) };
  }

  list(result: { rows: User[]; nextCursor: string | null }) {
    return paginatedResponse(
      result.rows.map((r) => this.serialize(r)),
      result.rows.length,
      result.nextCursor
    );
  }
}
