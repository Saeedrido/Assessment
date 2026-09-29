import { getOne } from './apiClient';
import type { User } from '../types/api';

/** Development helper: the seeded accounts the console can act as. */
export const devApi = {
  seedUsers: () =>
    getOne<{ notice: string; users: User[] }>('/dev/seed-users'),
};
