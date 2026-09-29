import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';
import { toUserDto, userRepository } from '../repositories/user.repository';
import { env } from '../config/env';
import { ERROR_CODES } from '../constants/error-codes';
import { NotFoundError } from '../utils/errors';

/**
 * Development-only helper endpoints.
 *
 * The console authenticates with an `x-user-id` header, so a reviewer needs to
 * discover the seeded account ids before they can make any other request. This
 * router is therefore mounted *ahead* of the user-context middleware, and
 * guards itself: it is reachable only from a loopback address, and only while
 * the environment is non-production with dev auth enabled.
 */
export const devRouter = Router();

const MAX_LISTED_USERS = 20;

devRouter.get(
  '/seed-users',
  asyncHandler(async (request, response) => {
    if (env.isProduction || !env.authDevEnabled || !isLoopback(request.ip)) {
      // 404 rather than 403: in a real deployment this route does not exist.
      throw new NotFoundError('Not found', ERROR_CODES.ROUTE_NOT_FOUND);
    }

    const pagination = { page: 1, pageSize: MAX_LISTED_USERS, skip: 0, limit: MAX_LISTED_USERS };
    const { items } = await userRepository.list({}, pagination);

    sendSuccess(
      response,
      {
        notice: 'Development helper. Accounts are listed only because header-based dev auth is enabled.',
        users: items.map(toUserDto),
      },
      'Seed users',
    );
  }),
);

function isLoopback(ip: string | undefined): boolean {
  if (!ip) return false;
  const normalized = ip.replace(/^::ffff:/, '');
  return normalized === '127.0.0.1' || normalized === '::1' || normalized.startsWith('127.');
}
