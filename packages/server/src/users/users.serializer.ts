import type { User } from './users.schema';
import { userDto, type UserDto } from './dto/users.dto';

export class UsersSerializer {
  private serialize(user: User): UserDto {
    return userDto.parse(user);
  }

  single(user: User) {
    return { data: this.serialize(user) };
  }

  list(rows: User[]) {
    return { data: rows.map((r) => this.serialize(r)) };
  }
}
