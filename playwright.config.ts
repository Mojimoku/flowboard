import { defineConfig } from '@playwright/test';

const PORT = 5199;

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    // Fake project URL: every request to it is intercepted by e2e/fakeSupabase.ts.
    env: { VITE_SUPABASE_URL: 'https://e2e.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'e2e-key' },
  },
});
