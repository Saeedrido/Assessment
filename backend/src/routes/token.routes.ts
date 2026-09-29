import { Router } from 'express';
import { validate } from '../middlewares/validate.middleware';
import {
  convertTokens,
  getTokenBalance,
  getTokenHistory,
  listConversions,
  withdrawTokens,
} from '../controllers/token.controller';
import {
  convertTokensBodySchema,
  tokenHistoryQuerySchema,
  withdrawBodySchema,
} from '../validators/token.validator';

export const tokenRouter = Router();

/** GET /tokens/balance — current balance and lifetime totals. */
tokenRouter.get('/balance', getTokenBalance);

/** GET /tokens/history — append-only ledger, newest first. */
tokenRouter.get('/history', validate({ query: tokenHistoryQuerySchema }), getTokenHistory);

/** POST /tokens/convert — spend tokens, receive a mock on-chain asset. */
tokenRouter.post('/convert', validate({ body: convertTokensBodySchema }), convertTokens);

/** POST /tokens/withdraw — transfer a completed conversion to the wallet. */
tokenRouter.post('/withdraw', validate({ body: withdrawBodySchema }), withdrawTokens);

/** GET /tokens/conversions — conversion history for the caller. */
tokenRouter.get('/conversions', validate({ query: tokenHistoryQuerySchema }), listConversions);
