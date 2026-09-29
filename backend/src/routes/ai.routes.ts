import { Router } from 'express';
import { validate } from '../middlewares/validate.middleware';
import { listContentAiRuns, summarizeContent } from '../controllers/ai.controller';
import { aiRunHistoryQuerySchema, summarizeBodySchema } from '../validators/ai.validator';
import { idParamSchema } from '../validators/content.validator';

/**
 * AI sub-routes, mounted by `content.routes.ts` under `/content/:id/ai`.
 * Kept separate so the AI surface can grow (streaming, batch jobs) without
 * touching the content routes.
 */
export const aiRouter = Router({ mergeParams: true });

/** POST /content/:id/ai/summarize — generates a summary and rewards 5 tokens. */
aiRouter.post(
  '/summarize',
  validate({ params: idParamSchema, body: summarizeBodySchema }),
  summarizeContent,
);

/** GET /content/:id/ai/runs — history of runs against this content item. */
aiRouter.get('/runs', validate({ params: idParamSchema, query: aiRunHistoryQuerySchema }), listContentAiRuns);
