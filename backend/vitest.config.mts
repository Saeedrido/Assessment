import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    /**
     * Test files run sequentially in a single worker. They share one in-memory
     * replica set (started in `src/test/setup.ts`) and clear collections
     * between suites, so running them in parallel would produce races.
     */
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts', 'src/test/**', 'src/types/**', 'src/scripts/**', 'src/**/*.d.ts'],
    },
  },
});
