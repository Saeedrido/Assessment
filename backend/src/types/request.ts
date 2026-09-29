import type { Request } from 'express';
import type { UserRole } from '../constants/domain';

/**
 * The authenticated user, attached to `request.user` by `userContext` middleware.
 *
 * This is deliberately NOT a production authentication principal — see the
 * README "Authentication" section. It exists so the API can identify a caller
 * and enforce roles without pretending to implement OAuth/JWT.
 */
export interface RequestUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  tokenBalance: number;
}

export interface RequestWithUser extends Request {
  user: RequestUser;
}

/** Request whose `user` is guaranteed to exist (routes behind `requireRole`). */
export interface RequestWithAdmin extends Request {
  user: RequestUser & { role: 'admin' };
}

/**
 * Typed accessors for data produced by the `validate()` middleware.
 *
 * `validate()` replaces `request.body` / `request.query` / `request.params` with
 * the parsed output of the Zod schema, so these helpers document that contract
 * at the call site instead of scattering casts through the controllers.
 */
export function validatedBody<T>(request: Request): T {
  return request.body as T;
}

export function validatedQuery<T>(request: Request): T {
  return request.query as T;
}

export function validatedParams<T>(request: Request): T {
  return request.params as T;
}
