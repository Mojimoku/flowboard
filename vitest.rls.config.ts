import { defineConfig } from 'vitest/config';

// Row-level-security tests run against a real Supabase TEST project (never production).
export default defineConfig({
  test: { environment: 'node', include: ['tests/rls/**/*.test.ts'], testTimeout: 20000 },
});
