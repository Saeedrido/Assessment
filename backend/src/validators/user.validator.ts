import { z } from 'zod';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants/pagination';
import { USER_ROLES } from '../constants/domain';
import { optionalQuery } from './query';

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  role: z.enum([...USER_ROLES]).optional(),
  q: optionalQuery(z.string().trim().min(1).max(120)),
});

export const userIdParamSchema = z.object({
  id: z.string().min(1, 'id is required'),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
