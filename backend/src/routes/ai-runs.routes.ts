import { Router } from 'express';
import { validate } from '../middlewares/validate.middleware';
import { listUserAiRuns } from '../controllers/ai.controller';
import { aiRunHistoryQuerySchema } from '../validators/ai.validator';

/**
 * Cross-content AI run history.
 *
 * `content.routes.ts` exposes the same records scoped to a single item; this
 * router answers "what has this user run lately?" in one query.
 */
export const aiRunsRouter = Router();

/** GET /ai/runs — the caller's runs across every content item, newest first. */
aiRunsRouter.get('/runs', validate({ query: aiRunHistoryQuerySchema }), listUserAiRuns);
