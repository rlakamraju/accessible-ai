import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Mirrors webpack.config.ts's DefinePlugin so code referencing __LICENSE_SECRET__ works under vitest too.
  define: {
    __LICENSE_SECRET__: JSON.stringify('accessible-ai-dev-secret-2026'),
  },
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/support/chrome-mock.ts'],
    passWithNoTests: true,
  },
});
