import { Router } from 'express';
import { contentRouter } from './content.routes';
import { tokenRouter } from './token.routes';
import { mediaRouter } from './media.routes';
import { userRouter } from './user.routes';
import { web3Router } from './web3.routes';
import { aiRunsRouter } from './ai-runs.routes';

/**
 * Versioned API surface.
 *
 * New modules are registered here and nowhere else, which keeps the mounting
 * point of every feature in a single file.
 */
export const apiRouter = Router();

apiRouter.use('/content', contentRouter);
apiRouter.use('/tokens', tokenRouter);
apiRouter.use('/media', mediaRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/ai', aiRunsRouter);
apiRouter.use('/web3', web3Router);

