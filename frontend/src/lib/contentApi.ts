import { getOne, getPaginated, postOne } from './apiClient';
import type {
  AiRun,
  ContentDetail,
  ContentListItem,
  CreateContentInput,
  ListContentQuery,
  SummarizeInput,
  SummarizeResult,
} from '../types/api';

/** Content and AI endpoints. */
export const contentApi = {
  list: (query: ListContentQuery) =>
    getPaginated<ContentListItem>('/content', { ...query }),

  getById: (id: string) => getOne<ContentDetail>(`/content/${id}`),

  create: (input: CreateContentInput) =>
    postOne<ContentListItem, CreateContentInput>('/content', input),

  summarize: (contentId: string, input: SummarizeInput) =>
    postOne<SummarizeResult, SummarizeInput>(`/content/${contentId}/ai/summarize`, input),

  listAiRuns: (contentId: string, page = 1, pageSize = 10) =>
    getPaginated<AiRun>(`/content/${contentId}/ai/runs`, { page, pageSize }),
};
