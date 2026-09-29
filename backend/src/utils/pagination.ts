import type { Response } from 'express';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants/pagination';

export interface PaginatedMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginatedMeta;
}

/**
 * Normalises raw `page` / `pageSize` values into a safe query window.
 * Values arrive as strings from query params, so clamping happens here rather
 * than in every repository.
 */
export function buildPaginationParams(rawPage?: unknown, rawPageSize?: unknown): PaginationParams {
  const page = clampToInt(rawPage, DEFAULT_PAGE, 1, Number.MAX_SAFE_INTEGER);
  const requestedSize = clampToInt(rawPageSize, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
  return {
    page,
    pageSize: requestedSize,
    skip: (page - 1) * requestedSize,
    limit: requestedSize,
  };
}

export function buildPaginatedResult<T>(items: T[], totalItems: number, params: PaginationParams): PaginatedResult<T> {
  const totalPages = params.pageSize > 0 ? Math.ceil(totalItems / params.pageSize) : 0;
  return {
    items,
    meta: {
      page: params.page,
      pageSize: params.pageSize,
      totalItems,
      totalPages,
      hasNextPage: params.page < totalPages,
      hasPreviousPage: params.page > 1,
    },
  };
}

export function sendPaginated<T>(response: Response, result: PaginatedResult<T>): Response {
  return response.json({ success: true, data: result.items, meta: result.meta });
}

function clampToInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}
