import type { ClientSession, Types } from 'mongoose';
import { AiRunModel, buildAiRunFilter, type AiRun, type AiRunQueryFilters } from '../models/ai-run.model';
import type { PaginationParams } from '../utils/pagination';
import type { AiRunStatus } from '../constants/domain';
import type { AiRunDto } from '../types/dto';

type AiRunDocument = AiRun & { _id: Types.ObjectId };

export interface CreateAiRunInput {
  contentId: string;
  userId: string;
  promptVersion: string;
  provider: string;
  tone: string;
  length: string;
}

export const aiRunRepository = {
  /** Records the attempt up-front so failures are observable, not lost. */
  async createPending(input: CreateAiRunInput, session?: ClientSession): Promise<AiRunDocument> {
    const [created] = await AiRunModel.create(
      [{ ...input, status: 'PENDING', latencyMs: 0, tokensAwarded: 0 }],
      session ? { session } : {},
    );
    return created;
  },

  async markSuccess(
    id: string,
    result: { output: string; latencyMs: number; tokensAwarded: number },
    session?: ClientSession,
  ): Promise<AiRunDocument | null> {
    return AiRunModel.findByIdAndUpdate(
      id,
      {
        $set: {
          status: 'SUCCESS',
          output: result.output,
          latencyMs: result.latencyMs,
          tokensAwarded: result.tokensAwarded,
          errorMessage: null,
        },
      },
      { new: true, session },
    ).lean<AiRunDocument>();
  },

  async markFailed(
    id: string,
    result: { status: Extract<AiRunStatus, 'FAILED' | 'TIMEOUT'>; latencyMs: number; errorMessage: string },
    session?: ClientSession,
  ): Promise<AiRunDocument | null> {
    return AiRunModel.findByIdAndUpdate(
      id,
      {
        $set: {
          status: result.status,
          output: null,
          latencyMs: result.latencyMs,
          tokensAwarded: 0,
          errorMessage: result.errorMessage,
        },
      },
      { new: true, session },
    ).lean<AiRunDocument>();
  },

  async findById(id: string): Promise<AiRunDocument | null> {
    return AiRunModel.findById(id).lean<AiRunDocument>();
  },

  async list(
    filters: AiRunQueryFilters,
    pagination: PaginationParams,
  ): Promise<{ items: AiRunDocument[]; total: number }> {
    const query = buildAiRunFilter(filters);

    const [items, total] = await Promise.all([
      AiRunModel.find(query)
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean<AiRunDocument[]>(),
      AiRunModel.countDocuments(query),
    ]);

    return { items, total };
  },
};

export type AiRunRepository = typeof aiRunRepository;

export function toAiRunDto(document: AiRunDocument): AiRunDto {
  return {
    id: String(document._id),
    contentId: String(document.contentId),
    userId: String(document.userId),
    promptVersion: document.promptVersion,
    provider: document.provider,
    tone: document.tone,
    length: document.length,
    status: document.status,
    output: document.output ?? null,
    errorMessage: document.errorMessage ?? null,
    latencyMs: document.latencyMs,
    tokensAwarded: document.tokensAwarded,
    createdAt: document.createdAt.toISOString(),
  };
}
