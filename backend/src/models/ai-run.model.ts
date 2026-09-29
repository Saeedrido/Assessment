import { Schema, type FilterQuery, type Types } from 'mongoose';
import { AI_RUN_STATUSES, type AiRunStatus } from '../constants/domain';
import { defineModel } from './model-registry';

export interface AiRun {
  contentId: Types.ObjectId;
  userId: Types.ObjectId;
  promptVersion: string;
  provider: string;
  tone: string;
  length: string;
  status: AiRunStatus;
  output?: string;
  errorMessage?: string;
  latencyMs: number;
  tokensAwarded: number;
  createdAt: Date;
  updatedAt: Date;
}

const aiRunSchema = new Schema<AiRun>(
  {
    contentId: { type: Schema.Types.ObjectId, ref: 'ContentItem', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Persisted so a historical run can be explained after the prompt changes.
    promptVersion: { type: String, required: true },
    provider: { type: String, required: true },
    tone: { type: String, required: true },
    length: { type: String, required: true },
    status: { type: String, required: true, enum: AI_RUN_STATUSES, default: 'PENDING' },
    output: { type: String, default: null },
    errorMessage: { type: String, default: null },
    latencyMs: { type: Number, required: true, default: 0, min: 0 },
    tokensAwarded: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true, versionKey: false, collection: 'ai_runs' },
);

/**
 * Indexes:
 * 1. `{ userId: 1, createdAt: -1 }` → `GET /ai-runs` for one user, and the
 *    "my AI activity" panel in the admin UI.
 * 2. `{ contentId: 1, createdAt: -1 }` → run history for a single content item.
 * 3. `{ status: 1, createdAt: -1 }` → operational query for failed/timeout runs.
 */
aiRunSchema.index({ userId: 1, createdAt: -1 });
aiRunSchema.index({ contentId: 1, createdAt: -1 });
aiRunSchema.index({ status: 1, createdAt: -1 });

export interface AiRunQueryFilters {
  userId?: string;
  contentId?: string;
  status?: AiRunStatus;
}

export function buildAiRunFilter(filters: AiRunQueryFilters): FilterQuery<AiRun> {
  const query: FilterQuery<AiRun> = {};
  if (filters.userId) query.userId = filters.userId;
  if (filters.contentId) query.contentId = filters.contentId;
  if (filters.status) query.status = filters.status;
  return query;
}

export const AiRunModel = defineModel<AiRun>('AiRun', aiRunSchema);
