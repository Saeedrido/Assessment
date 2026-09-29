import { Router } from 'express';
import { validate } from '../middlewares/validate.middleware';
import { requireAdmin } from '../middlewares/require-role.middleware';
import { getCurrentUser, getUser, listUsers } from '../controllers/user.controller';
import { listUsersQuerySchema, userIdParamSchema } from '../validators/user.validator';

export const userRouter = Router();

/** GET /users/me — the caller's own profile and live token balance. */
userRouter.get('/me', getCurrentUser);

/** GET /users — admin only; backs the user table in the console. */
userRouter.get('/', requireAdmin, validate({ query: listUsersQuerySchema }), listUsers);

/** GET /users/:id — admin only. */
userRouter.get('/:id', requireAdmin, validate({ params: userIdParamSchema }), getUser);
