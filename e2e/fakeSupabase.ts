import type { Page, Route } from '@playwright/test';

type Row = Record<string, any>;

const ORIGIN = 'https://e2e.supabase.co';
const USER = { id: 'e2e-user', email: 'e2e@example.com', aud: 'authenticated', role: 'authenticated' };

/**
 * Signs the page in and answers Supabase REST calls from in-memory tables, so the
 * browser test never touches a real backend but state still survives page reloads.
 */
export async function installFakeSupabase(page: Page, seed: { cards?: Row[]; columns?: Row[] } = {}) {
  const tables: Record<string, Row[]> = { cards: [...(seed.cards ?? [])], columns: [...(seed.columns ?? [])] };
  let counter = 0;

  await page.addInitScript(
    ({ key, session }) => localStorage.setItem(key, JSON.stringify(session)),
    {
      key: 'sb-e2e-auth-token',
      session: {
        access_token: 'fake',
        refresh_token: 'fake',
        token_type: 'bearer',
        expires_in: 36000,
        expires_at: Math.floor(Date.now() / 1000) + 36000,
        user: USER,
      },
    },
  );

  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(body),
    });

  const matcher = (params: URLSearchParams) => {
    const tests: ((row: Row) => boolean)[] = [];
    for (const [key, value] of params) {
      if (['select', 'order', 'on_conflict', 'columns'].includes(key)) continue;
      if (value.startsWith('eq.')) tests.push((row) => String(row[key]) === value.slice(3));
      if (value.startsWith('in.')) tests.push((row) => value.slice(4, -1).split(',').includes(String(row[key])));
    }
    return (row: Row) => tests.every((test) => test(row));
  };

  await page.route(`${ORIGIN}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname.startsWith('/auth/v1')) return json(route, 200, USER);

    const table = url.pathname.replace('/rest/v1/', '');
    const rows = (tables[table] ??= []);
    const wantsObject = (request.headers()['accept'] ?? '').includes('vnd.pgrst.object');
    const match = matcher(url.searchParams);
    const body = request.postDataJSON?.() as Row | Row[] | undefined;

    switch (request.method()) {
      case 'GET': {
        let out = rows.filter(match);
        const order = url.searchParams.get('order')?.split('.')[0];
        if (order) out = [...out].sort((a, b) => String(a[order]).localeCompare(String(b[order])));
        return json(route, 200, out);
      }
      case 'POST': {
        const incoming = Array.isArray(body) ? body : [body!];
        const upsert = (request.headers()['prefer'] ?? '').includes('resolution=');
        const out = incoming.map((row) => {
          const existing = rows.find((r) => r.id === row.id);
          if (existing && upsert) return Object.assign(existing, row);
          const created = { id: `id-${++counter}`, created_at: String(1000 + ++counter), ...row };
          rows.push(created);
          return created;
        });
        return json(route, 201, wantsObject ? out[0] : out);
      }
      case 'PATCH': {
        const out = rows.filter(match);
        out.forEach((row) => Object.assign(row, body));
        return json(route, 200, out);
      }
      case 'DELETE':
        tables[table] = rows.filter((row) => !match(row));
        return json(route, 204, null);
      default:
        return json(route, 405, { message: 'unsupported' });
    }
  });

  return tables;
}
