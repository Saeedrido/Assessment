import type { RequestHandler } from 'express';
import { Types } from 'mongoose';
import { ERROR_CODES } from '../constants/error-codes';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';
import { UserModel } from '../models/user.model';
import { env } from '../config/env';
import type { RequestUser } from '../types/request';

export const USER_ID_HEADER = 'x-user-id';

/**
 * Development authentication.
 *
 * The caller identifies itself with `x-user-id: <mongo object id>`; we load that
 * user and attach it to the request. This is a *deliberately* simplified
 * assessment mechanism — it trusts the header — and is guarded by two things so
 * it cannot be mistaken for production auth:
 *
 *  1. `AUTH_DEV_ENABLED=false` disables it entirely (use real auth instead).
 *  2. When enabled, requests must originate from an allow-listed local IP.
 *
 * Production replacement: validate a JWT/OAuth2 access token, load the subject,
 * and populate `request.user` with the same `RequestUser` shape. Nothing else in
 * the codebase needs to change.
 */
export const userContext: RequestHandler = async (request, _response, next) => {
  try {
    if (!env.authDevEnabled) {
      throw new ForbiddenError(
        'Development user context is disabled. Configure real authentication before enabling this API.',
        ERROR_CODES.AUTH_DISABLED,
      );
    }

    assertLocalCaller(request.ip);

    const rawUserId = extractHeader(request.headers[USER_ID_HEADER]);
    if (!rawUserId) {
      throw new UnauthorizedError(
        `Missing ${USER_ID_HEADER} header. Identify the caller with the seeded user's id.`,
        ERROR_CODES.AUTH_USER_CONTEXT_MISSING,
      );
    }
    if (!Types.ObjectId.isValid(rawUserId)) {
      throw new UnauthorizedError(
        `${USER_ID_HEADER} header is not a valid user id`,
        ERROR_CODES.AUTH_INVALID_HEADER,
      );
    }

    const user = await UserModel.findById(rawUserId).lean<{
      _id: Types.ObjectId;
      email: string;
      displayName: string;
      role: RequestUser['role'];
      tokenBalance: number;
    }>();

    if (!user) {
      throw new UnauthorizedError(
        'No user matches the supplied id',
        ERROR_CODES.AUTH_USER_NOT_FOUND,
      );
    }

    request.user = {
      id: String(user._id),
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      tokenBalance: user.tokenBalance,
    };
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Blocks obviously non-local callers from spoofing an identity via the header.
 * `trust proxy` is enabled in the app, so `request.ip` already reflects
 * `X-Forwarded-For` when the API sits behind a load balancer.
 */
function assertLocalCaller(ip: string | undefined): void {
  if (!ip) return;

  const normalized = ip.replace(/^::ffff:/, '');
  const allowed = env.authDevAllowedIps.includes(normalized);
  if (!allowed) {
    throw new ForbiddenError(
      'Development user context is only available from a loopback address',
      ERROR_CODES.AUTH_DISABLED,
    );
  }
}

function extractHeader(value: string | string[] | undefined): string | undefined {
  const header = Array.isArray(value) ? value[0] : value;
  return header?.trim() || undefined;
}
