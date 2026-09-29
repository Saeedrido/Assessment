import type { RequestUser } from './request';
import type { ValidatedRequestData } from './validation';

/**
 * Express type augmentation.
 *
 * `userContext` attaches `request.user`, `requestLogger` assigns `request.id`
 * and `validate()` records `request.validated`. Declaring them here means every
 * handler sees the correct type without casting.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: RequestUser;
      /** Correlation id assigned by `requestLogger`. */
      id?: string;
      /** Parsed request data produced by the `validate()` middleware. */
      validated?: ValidatedRequestData;
    }
  }
}

export {};
