import axios, { AxiosError, type AxiosInstance } from 'axios';
import type { PaginatedMeta } from '../types/api';

/**
 * The API speaks one envelope: `{ success, message, data, meta }` on success and
 * `{ success: false, message, errorCode, details }` on failure. This module is
 * the single place that knows about that shape — features just call typed
 * helpers and catch `ApiError`.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

/** Sent as `x-user-id`; the backend's dev auth resolves it to a user record. */
let activeUserId = import.meta.env.VITE_USER_ID ?? '';

export function setActiveUserId(userId: string): void {
  activeUserId = userId;
}

export function getActiveUserId(): string {
  return activeUserId;
}

export interface SuccessEnvelope<T> {
  success: true;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ErrorEnvelope {
  success: false;
  message: string;
  errorCode: string;
  details?: unknown;
}

/** A failed API call, carrying the backend's stable error code. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errorCode: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const http: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

http.interceptors.request.use((config) => {
  if (activeUserId) {
    config.headers.set('x-user-id', activeUserId);
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ErrorEnvelope>) => {
    const body = error.response?.data;
    if (body && body.success === false) {
      return Promise.reject(new ApiError(body.message, error.response!.status, body.errorCode, body.details));
    }

    // Network failure, timeout, or a non-JSON error page (e.g. a proxy 502).
    const message =
      error.code === 'ECONNABORTED'
        ? 'The request timed out. Please try again.'
        : 'Could not reach the T-World API. Is the backend running?';

    return Promise.reject(new ApiError(message, error.response?.status ?? 0, 'NETWORK_ERROR'));
  },
);

/** Unwraps a paginated envelope into items plus metadata. */
export async function getPaginated<T>(
  url: string,
  params?: Record<string, unknown>,
): Promise<{ items: T[]; meta: PaginatedMeta }> {
  // The paginated envelope is `data` plus a typed `meta`; asserting the whole
  // body keeps the cast in one place instead of at every call site.
  const response = await http.get<SuccessEnvelope<T[]> & { meta: PaginatedMeta }>(url, { params });
  return { items: response.data.data, meta: response.data.meta };
}

export async function getOne<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const response = await http.get<SuccessEnvelope<T>>(url, { params });
  return response.data.data;
}

export async function postOne<TResponse, TBody = unknown>(url: string, body?: TBody): Promise<TResponse> {
  const response = await http.post<SuccessEnvelope<TResponse>>(url, body);
  return response.data.data;
}

/** Turns any thrown value into a message that is safe to render. */
export function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}
