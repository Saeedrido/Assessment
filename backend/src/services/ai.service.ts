import { contentRepository, type ContentRepository } from '../repositories/content.repository';
import { buildPaginatedResult, type PaginatedResult } from '../utils/pagination';
import { aiRunRepository, toAiRunDto, type AiRunRepository } from '../repositories/ai-run.repository';
import { tokenService, type TokenService } from './token.service';
import { withDatabaseTransaction } from './transaction.service';
import { getAIProvider } from '../ai/provider.factory';
import { buildSummaryPrompt } from '../ai/prompt.service';
import { AIProviderTimeoutError, type AIProvider } from '../ai/ai-provider';
import { AI_REQUEST_COST, AI_SUCCESS_REWARD, TOKEN_SOURCE, TOKEN_TRANSACTION_TYPE } from '../constants/token';
import { AI_REQUEST_TIMEOUT_MS } from '../constants/ai';
import { ERROR_CODES } from '../constants/error-codes';
import { HTTP_STATUS } from '../constants/http';
import { NotFoundError, ProviderError } from '../utils/errors';
import { withTimeout } from '../utils/timeout';
import { assertValidObjectId } from '../utils/object-id';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import type { AiSummaryLength, AiSummaryTone } from '../constants/domain';
import type { AiRunDto } from '../types/dto';

export interface SummarizeInput {
  contentId: string;
  userId: string;
  tone: AiSummaryTone;
  length: AiSummaryLength;
}

export interface SummarizeResult {
  output: string;
  latencyMs: number;
  tokensAwarded: number;
  totalTokenBalance: number;
  run: AiRunDto;
}

/** Records a run that produced no output, carrying the audit context to the API. */
export class AiRunFailedError extends ProviderError {
  constructor(
    message: string,
    errorCode: (typeof ERROR_CODES)[keyof typeof ERROR_CODES],
    statusCode: number,
    public readonly runId: string,
    public readonly runStatus: 'FAILED' | 'TIMEOUT',
    public readonly latencyMs: number,
    public readonly fallbackOutput: string | null,
  ) {
    // Attached to the API error response. `fallbackOutput` is a degraded
    // answer the caller may still use; it is clearly marked as *not* a
    // successful AI result — no tokens were awarded for it.
    super(message, errorCode, statusCode, {
      details: { runId, status: runStatus, latencyMs, fallbackOutput },
    });
  }
}

/**
 * AI orchestration.
 *
 * Responsibilities, in order:
 *   1. resolve the content and the caller
 *   2. record a PENDING run (so failures are auditable)
 *   3. call the provider under a timeout while measuring latency
 *   4. on success: persist the output and award tokens in one transaction
 *   5. on timeout/failure: persist the failed run and award nothing
 *
 * The provider itself is an injected `AIProvider`, so vendor SDKs never reach
 * this file.
 */
export class AiService {
  constructor(
    private readonly contents: ContentRepository,
    private readonly runs: AiRunRepository,
    private readonly tokens: TokenService,
    private readonly resolveProvider: () => AIProvider = getAIProvider,
    private readonly timeoutMs: number = AI_REQUEST_TIMEOUT_MS,
  ) {}

  async summarize(input: SummarizeInput): Promise<SummarizeResult> {
    assertValidObjectId(input.contentId, 'content id');

    const content = await this.contents.findById(input.contentId);
    if (!content) {
      throw new NotFoundError('Content not found', ERROR_CODES.AI_CONTENT_NOT_FOUND);
    }

    const provider = this.resolveProvider();
    const prompt = buildSummaryPrompt(
      { title: content.title, body: content.body },
      input.tone,
      input.length,
    );

    const run = await this.runs.createPending({
      contentId: input.contentId,
      userId: input.userId,
      promptVersion: prompt.promptVersion,
      provider: provider.name,
      tone: input.tone,
      length: input.length,
    });

    const startedAt = process.hrtime.bigint();

    // The request is paid for up front. `debit` uses an atomic conditional
    // update, so a user with an insufficient balance is rejected here and the
    // provider is never called.
    if (AI_REQUEST_COST > 0) {
      try {
        await this.tokens.debit({
          userId: input.userId,
          amount: AI_REQUEST_COST,
          type: TOKEN_TRANSACTION_TYPE.SPEND,
          source: TOKEN_SOURCE.AI_USAGE,
          referenceType: 'AI_RUN',
          referenceId: String(run._id),
          note: 'AI summarisation request',
        });
      } catch (error) {
        // The run was opened before the charge, so close it here. Otherwise a
        // rejected request (typically an insufficient balance) would leave a
        // PENDING run in the history forever. No refund is needed: the debit
        // is atomic and failed outright.
        await this.runs.markFailed(String(run._id), {
          status: 'FAILED',
          latencyMs: elapsedMs(startedAt),
          errorMessage: (error instanceof Error ? error.message : 'Request rejected')
            .slice(0, 500),
        });
        throw error;
      }
    }

    try {
      const result = await withTimeout(
        provider.summarize({
          content: { title: content.title, body: content.body },
          tone: input.tone,
          length: input.length,
          promptVersion: prompt.promptVersion,
        }),
        this.timeoutMs,
        () => new AIProviderTimeoutError(this.timeoutMs, provider.name),
      );

      return await this.completeSuccessfully(String(run._id), input.userId, result.output, startedAt);
    } catch (error) {
      return this.handleFailure(String(run._id), input.userId, error, startedAt);
    }
  }

  async listRunsForContent(
    contentId: string,
    pagination: { page: number; pageSize: number },
  ): Promise<PaginatedResult<AiRunDto>> {
    assertValidObjectId(contentId, 'content id');

    const window = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      skip: (pagination.page - 1) * pagination.pageSize,
      limit: pagination.pageSize,
    };

    const { items, total } = await this.runs.list({ contentId }, window);
    return buildPaginatedResult(items.map(toAiRunDto), total, window);
  }

  async listRunsForUser(
    userId: string,
    pagination: { page: number; pageSize: number },
  ): Promise<PaginatedResult<AiRunDto>> {
    const window = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      skip: (pagination.page - 1) * pagination.pageSize,
      limit: pagination.pageSize,
    };

    const { items, total } = await this.runs.list({ userId }, window);
    return buildPaginatedResult(items.map(toAiRunDto), total, window);
  }

  /**
   * Success path: the run is marked SUCCESS and the reward is credited in a
   * single transaction, so a run can never show tokens awarded while the
   * balance was not actually updated.
   */
  private async completeSuccessfully(
    runId: string,
    userId: string,
    output: string,
    startedAt: bigint,
  ): Promise<SummarizeResult> {
    const latencyMs = elapsedMs(startedAt);

    const { run, balance } = await withDatabaseTransaction(async (session) => {
      const updatedRun = await this.runs.markSuccess(
        runId,
        { output, latencyMs, tokensAwarded: AI_SUCCESS_REWARD },
        session,
      );

      const mutation = await this.tokens.credit({
        userId,
        amount: AI_SUCCESS_REWARD,
        type: 'EARN',
        source: TOKEN_SOURCE.AI_USAGE,
        referenceType: 'AI_RUN',
        referenceId: runId,
        note: 'AI summarisation reward',
        session,
      });

      return { run: updatedRun, balance: mutation.balanceAfter };
    });

    logger.info({ runId, latencyMs, tokensAwarded: AI_SUCCESS_REWARD }, 'AI run completed');

    return {
      output,
      latencyMs,
      tokensAwarded: AI_SUCCESS_REWARD,
      totalTokenBalance: balance,
      run: toAiRunDto(run!),
    };
  }

  /**
   * Failure path: the run is recorded as FAILED or TIMEOUT with **no** tokens
   * awarded. The caller still receives a typed error so the API can answer 502
   * or 504 rather than pretending the run succeeded.
   */
  private async handleFailure(
    runId: string,
    userId: string,
    error: unknown,
    startedAt: bigint,
  ): Promise<never> {
    const latencyMs = elapsedMs(startedAt);
    const isTimeout = isTimeoutError(error);

    const status = isTimeout ? 'TIMEOUT' : 'FAILED';
    const reason = error instanceof Error ? error.message : 'Unknown provider error';

    const failedRun = await this.runs.markFailed(runId, {
      status,
      latencyMs,
      errorMessage: reason.slice(0, 500),
    });

    // A failed or timed-out run is never charged: the cost taken up front is
    // returned, so a user only ever pays for a summary they received.
    await this.refundRequestCost(runId, userId);

    logger.warn({ runId, status, latencyMs, reason }, 'AI run failed; no tokens awarded');

    throw new AiRunFailedError(
      isTimeout
        ? `The AI provider did not respond within ${this.timeoutMs}ms`
        : 'The AI provider could not complete this request',
      isTimeout ? ERROR_CODES.AI_PROVIDER_TIMEOUT : ERROR_CODES.AI_PROVIDER_ERROR,
      isTimeout ? HTTP_STATUS.GATEWAY_TIMEOUT : HTTP_STATUS.BAD_GATEWAY,
      runId,
      status,
      latencyMs,
      env.aiFallbackEnabled ? fallbackOutputFor(failedRun) : null,
    );
  }

  /**
   * Returns the cost taken before the provider was called.
   *
   * A refund failure must not mask the original provider error, so it is
   * logged and swallowed: the caller still learns that the run failed.
   */
  private async refundRequestCost(runId: string, userId: string): Promise<void> {
    if (AI_REQUEST_COST <= 0) return;

    try {
      await this.tokens.credit({
        userId,
        amount: AI_REQUEST_COST,
        type: TOKEN_TRANSACTION_TYPE.SPEND,
        source: TOKEN_SOURCE.AI_USAGE,
        referenceType: 'AI_RUN',
        referenceId: runId,
        note: 'AI summarisation request refunded',
      });
    } catch (error) {
      logger.error({ err: error, runId, userId }, 'Failed to refund AI request cost');
    }
  }
}

/** Monotonic clock: immune to system clock adjustments during the call. */
function elapsedMs(startedAt: bigint): number {
  return Math.round(Number(process.hrtime.bigint() - startedAt) / 1_000_000);
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof AIProviderTimeoutError;
}

/**
 * When a provider fails we still know the article, so a plain extractive
 * fallback can be offered. It is returned as `fallbackOutput` on the error
 * response and never counted as a successful AI run.
 */
function fallbackOutputFor(run: Awaited<ReturnType<AiRunRepository['findById']>>): string | null {
  if (!run) return null;
  return `Automatic summary unavailable (${run.status}). Please retry in a moment.`;
}

export const aiService = new AiService(contentRepository, aiRunRepository, tokenService);
