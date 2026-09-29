import { getOne, getPaginated } from './apiClient';
import type { ListUsersQuery, User } from '../types/api';

/** User directory endpoints. The list routes require an admin caller. */
export const userApi = {
  me: () => getOne<User>('/users/me'),
  list: (query: ListUsersQuery) => getPaginated<User>('/users', { ...query }),
};
