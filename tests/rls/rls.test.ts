import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Verifies the database itself keeps users apart. Needs a Supabase TEST project with the
 * same tables/policies plus two pre-created confirmed users. Skipped when not configured:
 *   RLS_TEST_URL, RLS_TEST_KEY (publishable key),
 *   RLS_TEST_EMAIL_A / RLS_TEST_PASSWORD_A, RLS_TEST_EMAIL_B / RLS_TEST_PASSWORD_B
 * Do NOT point this at production: it inserts and deletes rows.
 */
const env = process.env;
const configured = ['RLS_TEST_URL', 'RLS_TEST_KEY', 'RLS_TEST_EMAIL_A', 'RLS_TEST_PASSWORD_A', 'RLS_TEST_EMAIL_B', 'RLS_TEST_PASSWORD_B'].every(
  (name) => env[name],
);

const newClient = () => createClient(env.RLS_TEST_URL!, env.RLS_TEST_KEY!, { auth: { persistSession: false } });

async function signedIn(email: string, password: string) {
  const client = newClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { client, userId: data.user!.id };
}

describe.skipIf(!configured)('row level security', () => {
  let a: { client: SupabaseClient; userId: string };
  let b: { client: SupabaseClient; userId: string };
  let anon: SupabaseClient;
  let cardId: string;
  const columnId = `rls-${Date.now()}`;

  beforeAll(async () => {
    a = await signedIn(env.RLS_TEST_EMAIL_A!, env.RLS_TEST_PASSWORD_A!);
    b = await signedIn(env.RLS_TEST_EMAIL_B!, env.RLS_TEST_PASSWORD_B!);
    anon = newClient();

    const card = await a.client
      .from('cards')
      .insert({ user_id: a.userId, title: 'A secret', assignee: 'A', priority: 'High', due_date: '2030-01-01', column_id: 'backlog' })
      .select('id')
      .single();
    expect(card.error).toBeNull();
    cardId = card.data!.id;
    const column = await a.client.from('columns').insert({ id: columnId, title: 'A column', position: 99, user_id: a.userId });
    expect(column.error).toBeNull();
  });

  afterAll(async () => {
    await a.client.from('cards').delete().eq('id', cardId);
    await a.client.from('columns').delete().eq('id', columnId);
  });

  it('lets the owner read their own rows', async () => {
    const { data } = await a.client.from('cards').select('id').eq('id', cardId);
    expect(data).toHaveLength(1);
  });

  it("hides one user's cards and columns from another", async () => {
    expect((await b.client.from('cards').select('id').eq('id', cardId)).data).toEqual([]);
    expect((await b.client.from('columns').select('id').eq('id', columnId)).data).toEqual([]);
  });

  it("does not let another user update or delete someone else's card", async () => {
    const update = await b.client.from('cards').update({ title: 'hacked' }).eq('id', cardId).select();
    expect(update.data ?? []).toEqual([]);
    const del = await b.client.from('cards').delete().eq('id', cardId).select();
    expect(del.data ?? []).toEqual([]);
    const still = await a.client.from('cards').select('title').eq('id', cardId).single();
    expect(still.data?.title).toBe('A secret');
  });

  it('rejects inserting a row owned by someone else', async () => {
    const { error } = await b.client
      .from('cards')
      .insert({ user_id: a.userId, title: 'forged', assignee: 'B', priority: 'Low', due_date: '2030-01-01', column_id: 'backlog' });
    expect(error).not.toBeNull();
  });

  it("does not let a user hand their card to someone else", async () => {
    const { error, data } = await a.client.from('cards').update({ user_id: b.userId }).eq('id', cardId).select();
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it('gives signed-out visitors no access', async () => {
    const read = await anon.from('cards').select('id');
    expect(read.error !== null || (read.data ?? []).length === 0).toBe(true);
    const write = await anon
      .from('cards')
      .insert({ user_id: a.userId, title: 'anon', assignee: 'x', priority: 'Low', due_date: '2030-01-01', column_id: 'backlog' });
    expect(write.error).not.toBeNull();
    const cols = await anon.from('columns').select('id');
    expect(cols.error !== null || (cols.data ?? []).length === 0).toBe(true);
  });
});
