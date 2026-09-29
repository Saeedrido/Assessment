import type { RequestHandler } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { sendPaginated } from '../utils/pagination';
import { sendSuccess } from '../utils/response';
import { tokenService } from '../services/token.service';
import { conversionService } from '../services/conversion.service';
import { validatedBody, validatedQuery } from '../types/request';
import type {
  ConvertTokensBody,
  TokenHistoryQuery,
  WithdrawBody,
} from '../validators/token.validator';

/** Thin HTTP handlers: parse the call, delegate to a service, shape the reply. */

export const getTokenBalance: RequestHandler = asyncHandler(async (request, response) => {
  const balance = await tokenService.getBalance(request.user!.id);
  sendSuccess(response, balance, 'Token balance retrieved');
});

export const getTokenHistory: RequestHandler = asyncHandler(async (request, response) => {
  const query = validatedQuery<TokenHistoryQuery>(request);
  const result = await tokenService.getHistory(
    request.user!.id,
    { page: query.page, pageSize: query.pageSize },
    query.type ? { type: query.type } : {},
  );
  sendPaginated(response, result);
});

export const convertTokens: RequestHandler = asyncHandler(async (request, response) => {
  const body = validatedBody<ConvertTokensBody>(request);
  const result = await conversionService.convert({
    userId: request.user!.id,
    toAsset: body.toAsset,
    amount: body.amount,
  });

  sendSuccess(
    response,
    {
      txHashMock: result.conversion.txHashMock,
      convertedAmount: result.convertedAmount,
      totalTokenBalance: result.remainingBalance,
      conversion: result.conversion,
    },
    'Tokens converted',
  );
});

export const withdrawTokens: RequestHandler = asyncHandler(async (request, response) => {
  const body = validatedBody<WithdrawBody>(request);
  const result = await conversionService.withdraw(body.conversionId, request.user!.id);

  sendSuccess(
    response,
    {
      status: result.status,
      network: result.network,
      txHashMock: result.txHashMock,
      conversion: result.conversion,
    },
    'Withdrawal completed',
  );
});

export const listConversions: RequestHandler = asyncHandler(async (request, response) => {
  const query = validatedQuery<TokenHistoryQuery>(request);
  const result = await conversionService.list(request.user!.id, {
    page: query.page,
    pageSize: query.pageSize,
  });
  sendPaginated(response, result);
});
