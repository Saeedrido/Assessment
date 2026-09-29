import type { RequestHandler } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { sendPaginated } from '../utils/pagination';
import { sendSuccess } from '../utils/response';
import { userService } from '../services/user.service';
import { validatedQuery } from '../types/request';
import type { ListUsersQuery } from '../validators/user.validator';

export const getCurrentUser: RequestHandler = asyncHandler(async (request, response) => {
  const user = await userService.getCurrentUser(request.user!.id);
  sendSuccess(response, user, 'Current user retrieved');
});

export const listUsers: RequestHandler = asyncHandler(async (request, response) => {
  const query = validatedQuery<ListUsersQuery>(request);
  sendPaginated(response, await userService.list(query));
});

export const getUser: RequestHandler = asyncHandler(async (request, response) => {
  const user = await userService.getById(request.params.id);
  sendSuccess(response, user, 'User retrieved');
});
