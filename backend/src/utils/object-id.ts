import { Types } from 'mongoose';
import { ERROR_CODES } from '../constants/error-codes';
import { BadRequestError } from './errors';

/**
 * Guards against malformed ids producing confusing CastErrors deep inside a
 * repository. Returns the string form so callers can keep working with strings.
 */
export function assertValidObjectId(value: string, fieldName = 'id'): string {
  if (!value || !Types.ObjectId.isValid(value)) {
    throw new BadRequestError(
      `${fieldName} "${value}" is not a valid identifier`,
      ERROR_CODES.INVALID_OBJECT_ID,
      { field: fieldName, value },
    );
  }
  return value;
}

export function isValidObjectId(value: unknown): value is string {
  return typeof value === 'string' && Types.ObjectId.isValid(value);
}

export function toObjectId(value: string): Types.ObjectId {
  return new Types.ObjectId(value);
}
