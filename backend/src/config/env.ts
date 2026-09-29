import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import path from 'path';

loadDotenv({ path: path.resolve(process.cwd(), '.env') });

/**
 * `z.coerce.boolean()` maps the string "false" to `true`, which is a classic
 * configuration bug. These helpers give predictable parsing instead.
 */
const booleanFromString = (defaultValue: boolean) =>
  z
    .union([z.boolean(), z.string()])
    .default(defaultValue)
    .transform((value) => {
      if (typeof value === 'boolean') return value;
      return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
    });

const numberFromString = (defaultValue: number) =>
  z
    .union([z.number(), z.string()])
    .default(String(defaultValue))
    .transform((value) => (typeof value === 'number' ? value : Number(value.trim())))
    .pipe(z.number());

const csvToArray = (defaultValue: string) =>
  z
    .string()
    .default(defaultValue)
    .transform((value) =>
      value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
    );

const envSchema = z.object({
  nodeEnv: z.enum(['development', 'test', 'production']).default('development'),
  port: numberFromString(4000).pipe(z.number().int().min(1).max(65535)),
  apiPrefix: z.string().default('/api/v1'),
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  corsOrigins: csvToArray('http://localhost:5173,http://127.0.0.1:5173'),
  rateLimitWindowMs: numberFromString(60_000).pipe(z.number().int().positive()),
  rateLimitMax: numberFromString(300).pipe(z.number().int().nonnegative()),

  mongoUri: z.string().min(1, 'MONGODB_URI is required'),
  mongoMaxPoolSize: numberFromString(20).pipe(z.number().int().positive()),
  mongoServerSelectionTimeoutMs: numberFromString(10_000).pipe(z.number().int().positive()),

  authDevEnabled: booleanFromString(true),
  authDevAllowedIps: csvToArray('127.0.0.1,::1'),

  aiProvider: z.enum(['mock', 'openai']).default('mock'),
  aiPromptVersion: z.string().default('v1'),
  aiTimeoutMs: numberFromString(5_000).pipe(z.number().int().positive()),
  /** Cost per summarisation request; may be 0 to make summaries free. */
  aiRequestCost: numberFromString(1).pipe(z.number().int().nonnegative().max(10_000)),
  aiSuccessReward: numberFromString(5).pipe(z.number().int().nonnegative()),
  aiMockMinLatencyMs: numberFromString(250).pipe(z.number().int().nonnegative()),
  aiMockMaxLatencyMs: numberFromString(900).pipe(z.number().int().nonnegative()),
  aiMockFailureRate: numberFromString(0).pipe(z.number().min(0).max(1)),
  aiFallbackEnabled: booleanFromString(true),

  openaiApiKey: z.string().default(''),
  openaiBaseUrl: z.string().default('https://api.openai.com/v1'),
  openaiModel: z.string().default('gpt-4o-mini'),
  openaiMaxOutputTokens: numberFromString(400).pipe(z.number().int().positive()),

  tokenInitialBalance: numberFromString(0).pipe(z.number().int().nonnegative()),
  seedUserTokenBalance: numberFromString(100).pipe(z.number().int().nonnegative()),
  rateTokensPerMockUsdt: numberFromString(100).pipe(z.number().positive()),
  rateTokensPerMockEth: numberFromString(20_000).pipe(z.number().positive()),

  mediaUploadProvider: z.enum(['mock', 'cloudinary']).default('mock'),
  mediaPromotionProvider: z.enum(['mock', 's3']).default('mock'),
  mediaMaxFileSizeBytes: numberFromString(10 * 1024 * 1024).pipe(z.number().int().positive()),
  cloudinaryCloudName: z.string().default(''),
  cloudinaryApiKey: z.string().default(''),
  cloudinaryApiSecret: z.string().default(''),
  cloudinaryFolder: z.string().default('t-world-media'),
  awsRegion: z.string().default('eu-west-2'),
  awsS3Bucket: z.string().default(''),
  awsAccessKeyId: z.string().default(''),
  awsSecretAccessKey: z.string().default(''),
  awsS3Endpoint: z.string().default(''),
  awsS3ForcePathStyle: booleanFromString(false),

  web3NetworkName: z.string().default('Ethereum'),
  web3ContractAddress: z.string().default('0x1111111111111111111111111111111111111111'),
  web3ChainId: numberFromString(1).pipe(z.number().int().positive()),
});

/**
 * Explicit `SCREAMING_SNAKE_CASE` → camelCase mapping.
 *
 * Written out rather than derived, because an implicit mapping over
 * `process.env` would silently pick up unrelated system variables and make the
 * configuration hard to audit.
 */
const rawEnv = {
  nodeEnv: process.env.NODE_ENV,
  port: process.env.PORT,
  apiPrefix: process.env.API_PREFIX,
  logLevel: process.env.LOG_LEVEL,

  corsOrigins: process.env.CORS_ORIGINS,
  rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS,
  rateLimitMax: process.env.RATE_LIMIT_MAX,

  mongoUri: process.env.MONGODB_URI,
  mongoMaxPoolSize: process.env.MONGODB_MAX_POOL_SIZE,
  mongoServerSelectionTimeoutMs: process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,

  authDevEnabled: process.env.AUTH_DEV_ENABLED,
  authDevAllowedIps: process.env.AUTH_DEV_ALLOWED_IPS,

  aiProvider: process.env.AI_PROVIDER,
  aiPromptVersion: process.env.AI_PROMPT_VERSION,
  aiTimeoutMs: process.env.AI_TIMEOUT_MS,
  aiRequestCost: process.env.AI_REQUEST_COST,
  aiSuccessReward: process.env.AI_SUCCESS_REWARD,
  aiMockMinLatencyMs: process.env.AI_MOCK_MIN_LATENCY_MS,
  aiMockMaxLatencyMs: process.env.AI_MOCK_MAX_LATENCY_MS,
  aiMockFailureRate: process.env.AI_MOCK_FAILURE_RATE,
  aiFallbackEnabled: process.env.AI_FALLBACK_ENABLED,

  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiBaseUrl: process.env.OPENAI_BASE_URL,
  openaiModel: process.env.OPENAI_MODEL,
  openaiMaxOutputTokens: process.env.OPENAI_MAX_OUTPUT_TOKENS,

  tokenInitialBalance: process.env.TOKEN_INITIAL_BALANCE,
  seedUserTokenBalance: process.env.SEED_USER_TOKEN_BALANCE,
  rateTokensPerMockUsdt: process.env.RATE_TOKENS_PER_MOCK_USDT,
  rateTokensPerMockEth: process.env.RATE_TOKENS_PER_MOCK_ETH,

  mediaUploadProvider: process.env.MEDIA_UPLOAD_PROVIDER,
  mediaPromotionProvider: process.env.MEDIA_PROMOTION_PROVIDER,
  mediaMaxFileSizeBytes: process.env.MEDIA_MAX_FILE_SIZE_BYTES,
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,
  cloudinaryFolder: process.env.CLOUDINARY_FOLDER,
  awsRegion: process.env.AWS_REGION,
  awsS3Bucket: process.env.AWS_S3_BUCKET,
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  awsS3Endpoint: process.env.AWS_S3_ENDPOINT,
  awsS3ForcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE,

  web3NetworkName: process.env.WEB3_NETWORK_NAME,
  web3ContractAddress: process.env.WEB3_CONTRACT_ADDRESS,
  web3ChainId: process.env.WEB3_CHAIN_ID,
};

/** Drops keys whose environment variable is unset so schema defaults apply. */
function withoutUnsetKeys<T extends Record<string, unknown>>(source: T): Partial<T> {
  return Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined)) as Partial<T>;
}

const parsed = envSchema.safeParse(withoutUnsetKeys(rawEnv));

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${details}`);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isProduction: raw.nodeEnv === 'production',
  isTest: raw.nodeEnv === 'test',
  corsAllowsAnyOrigin: raw.corsOrigins.includes('*'),
} as const;

export type Env = typeof env;
