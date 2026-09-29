import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/response';
import { verifySignedMessage } from '../web3/signature-verifier';
import { validate } from '../middlewares/validate.middleware';
import { verifySignatureBodySchema } from '../validators/web3.validator';

export const web3Router = Router();

/**
 * POST /web3/verify-signature
 *
 * Stateless signature check used by the console to confirm that the wallet a
 * user typed in really controls that address. It does not mutate anything, so
 * a failed verification is reported as `valid: false` in a 200 response rather
 * than an HTTP error — the caller asked a question, and "no" is an answer.
 */
web3Router.post(
  '/verify-signature',
  validate({ body: verifySignatureBodySchema }),
  asyncHandler(async (request, response) => {
    const result = verifySignedMessage(request.body);
    sendSuccess(response, result, result.valid ? 'Signature verified' : 'Signature rejected');
  }),
);
