/**
 * ESLint configuration for the whole monorepo.
 *
 * Kept intentionally small: TypeScript correctness rules plus a handful of
 * readability rules that prevent the most common code-review complaints.
 */
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
    browser: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    // `tsconfig.test.json` exists only so the test files (excluded from the
    // build config) are type-aware when linted.
    project: [
      './backend/tsconfig.json',
      './backend/tsconfig.test.json',
      './frontend/tsconfig.json',
    ],
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  ignorePatterns: [
    'node_modules',
    'dist',
    'coverage',
    'backend/src/types/express.d.ts',
    '.eslintrc.cjs',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    eqeqeq: ['error', 'smart'],
    'prefer-const': 'error',
  },
  overrides: [
    {
      // Seed scripts and the dev entrypoint legitimately print to the console.
      files: ['backend/src/scripts/**/*.ts', 'backend/src/server.ts'],
      rules: { 'no-console': 'off' },
    },
    {
      files: ['frontend/**/*.ts', 'frontend/**/*.tsx'],
      rules: { 'no-console': 'off' },
    },
  ],
};
