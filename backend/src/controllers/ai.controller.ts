import type { RequestHandler } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';
import { sendPaginated } from '../utils/pagination';
import { aiService } from '../services/ai.service';
import { validatedBody, validatedQuery } from '../types/request';
import type { AiRunHistoryQuery, SummarizeBody } from '../validators/ai.validator';

/**
 * HTTP layer for AI runs.
 *
 * The response intentionally returns exactly the fields the assessment
 * specifies — `output`, `latencyMs`, `tokensAwarded`, `totalTokenBalance` —
 * with the full run record under `data.run` for traceability.
 */
export const summarizeContent: RequestHandler = asyncHandler(async (request, response) => {
  const body = validatedBody<SummarizeBody>(request);

  const result = await aiService.summarize({
    contentId: request.params.id,
    userId: request.user!.id,
    tone: body.tone,
    length: body.length,
  });

  sendSuccess(
    response,
    {
      output: result.output,
      latencyMs: result.latencyMs,
      tokensAwarded: result.tokensAwarded,
      totalTokenBalance: result.totalTokenBalance,
      run: result.run,
    },
    'Summary generated',
  );
});

export const listContentAiRuns: RequestHandler = asyncHandler(async (request, response) => {
  const query = validatedQuery<AiRunHistoryQuery>(request);
  const runs = await aiService.listRunsForContent(request.params.id, {
    page: query.page,
    pageSize: query.pageSize,
  });

  sendPaginated(response, runs);
});

/** GET /ai/runs — the caller's run history across all content items. */
export const listUserAiRuns: RequestHandler = asyncHandler(async (request, response) => {
  const query = validatedQuery<AiRunHistoryQuery>(request);
  const runs = await aiService.listRunsForUser(request.user!.id, {
    page: query.page,
    pageSize: query.pageSize,
  });

  sendPaginated(response, runs);
});
