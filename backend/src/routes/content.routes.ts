import { Router } from 'express';
import { validate } from '../middlewares/validate.middleware';
import { requireAdmin } from '../middlewares/require-role.middleware';
import { createContent, getContentById, listContent } from '../controllers/content.controller';
import { createContentBodySchema, idParamSchema, listContentQuerySchema } from '../validators/content.validator';
import { aiRouter } from './ai.routes';

export const contentRouter = Router();

/** POST /content — admin only. Read access is open to any identified user. */
contentRouter.post('/', requireAdmin, validate({ body: createContentBodySchema }), createContent);

/**
 * GET /content?tag=&q=&page=&pageSize=
 * Supports tag filtering, text search and pagination.
 * Declared before `/:id` so the list route is not captured as an id.
 */
contentRouter.get('/', validate({ query: listContentQuerySchema }), listContent);

contentRouter.get('/:id', validate({ params: idParamSchema }), getContentById);

/** AI operations for a single content item: /content/:id/ai/* */
contentRouter.use('/:id/ai', aiRouter);
