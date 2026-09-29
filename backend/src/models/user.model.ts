import { Schema, type Types } from 'mongoose';
import { USER_ROLES, type UserRole } from '../constants/domain';
import { defineModel } from './model-registry';

export interface User {
  email: string;
  displayName: string;
  role: UserRole;
  tokenBalance: number;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<User>(
  {
    email: {
      type: String,
      required: [true, 'email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    displayName: {
      type: String,
      required: [true, 'displayName is required'],
      trim: true,
      maxlength: 120,
    },
    role: { type: String, required: true, enum: USER_ROLES, default: 'user' },
    tokenBalance: {
      type: Number,
      required: true,
      default: 0,
      // The last line of defence against a negative balance. Application code
      // also uses an atomic conditional update, but the invariant is enforced
      // here as well so a bad write can never be persisted.
      validate: {
        validator: (value: number) => Number.isInteger(value) && value >= 0,
        message: 'tokenBalance must be a non-negative integer',
      },
    },
  },
  { timestamps: true, versionKey: false, collection: 'users' },
);

// `email` is already unique-indexed by the `unique: true` field option above,
// so no additional index is declared for it here.
userSchema.index({ role: 1 });

/** Shape returned to clients — never includes anything sensitive. */
export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  tokenBalance: number;
  createdAt: Date;
}

export function toPublicUser(user: User & { _id: Types.ObjectId }): PublicUser {
  return {
    id: String(user._id),
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    tokenBalance: user.tokenBalance,
    createdAt: user.createdAt,
  };
}

export const UserModel = defineModel<User>('User', userSchema);
