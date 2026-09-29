import { toUserDto, userRepository, type UserRepository } from '../repositories/user.repository';
import { ERROR_CODES } from '../constants/error-codes';
import { NotFoundError } from '../utils/errors';
import { assertValidObjectId } from '../utils/object-id';
import { buildPaginatedResult, type PaginatedResult } from '../utils/pagination';
import type { ListUsersQuery } from '../validators/user.validator';
import type { UserRole } from '../constants/domain';
import type { UserDto } from '../types/dto';

/**
 * User queries for the admin console and the caller's own profile.
 *
 * There is deliberately no `updateBalance` method here: balances are owned by
 * `TokenService`, which is the only writer of `UserModel.tokenBalance`.
 */
export class UserService {
  constructor(private readonly repository: UserRepository) {}

  /** The authenticated caller's own profile, including their live balance. */
  async getCurrentUser(userId: string): Promise<UserDto> {
    assertValidObjectId(userId, 'user id');

    const user = await this.repository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', ERROR_CODES.AUTH_USER_NOT_FOUND);
    }
    return toUserDto(user);
  }

  async list(query: ListUsersQuery): Promise<PaginatedResult<UserDto>> {
    const pagination = {
      page: query.page,
      pageSize: query.pageSize,
      skip: (query.page - 1) * query.pageSize,
      limit: query.pageSize,
    };

    const { items, total } = await this.repository.list(
      { role: query.role as UserRole | undefined, search: query.q },
      pagination,
    );

    return buildPaginatedResult(items.map(toUserDto), total, pagination);
  }

  async getById(id: string): Promise<UserDto> {
    assertValidObjectId(id, 'user id');

    const user = await this.repository.findById(id);
    if (!user) {
      throw new NotFoundError('User not found', ERROR_CODES.AUTH_USER_NOT_FOUND);
    }
    return toUserDto(user);
  }

  async count(): Promise<number> {
    return this.repository.count();
  }
}

export const userService = new UserService(userRepository);
