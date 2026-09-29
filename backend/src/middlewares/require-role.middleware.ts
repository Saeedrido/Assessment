import type { RequestHandler } from 'express';
import type { UserRole } from '../constants/domain';
import { ForbiddenError } from '../utils/errors';
import type { RequestUser } from '../types/request';

/**
 * Role guard. Must be registered after `userContext`, which is what populates
 * `request.user`.
 *
 * Usage: `router.post('/', requireRole('admin'), handler)`
 */
export function requireRole(...allowedRoles: UserRole[]): RequestHandler {
  return (request, _response, next) => {
    const user = request.user as RequestUser | undefined;

    if (!user) {
      next(new ForbiddenError('Authentication is required for this route'));
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      next(
        new ForbiddenError(
          `Role "${user.role}" may not perform this action. Required: ${allowedRoles.join(' or ')}.`,
        ),
      );
      return;
    }

    next();
  };
}

export const requireAdmin = requireRole('admin');
