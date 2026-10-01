/**
 * In-memory stand-in for `src/lib/supabaseClient`. Tests mock that module with this
 * one, so nothing ever reaches a real Supabase project.
 */
type Row = Record<string, any>;
type Op = 'select' | 'insert' | 'update' | 'delete' | 'upsert';
type Result = { data: any; error: { message: string } | null };

let counter = 0;

export const db = {
  tables: { cards: [] as Row[], columns: [] as Row[] } as Record<string, Row[]>,
  failures: new Set<string>(),
  session: null as any,
  authError: null as { message: string } | null,
  calls: [] as { table: string; op: Op; payload?: unknown }[],

  reset() {
    this.tables = { cards: [], columns: [] };
    this.failures.clear();
    this.session = null;
    this.authError = null;
    this.calls = [];
    counter = 0;
  },
  seed(table: string, rows: Row[]) {
    this.tables[table] = rows.map((row) => ({ created_at: String(++counter).padStart(6, '0'), ...row }));
  },
  /** Makes the next `op` on `table` return an error (then resets). */
  failNext(table: string, op: Op) {
    this.failures.add(`${table}:${op}`);
  },
};

class Query implements PromiseLike<Result> {
  private filters: ((row: Row) => boolean)[] = [];
  private orderKey: string | null = null;
  private payload: any;
  private options: Row = {};
  private returning = false;
  private single_ = false;

  private table: string;
  private op: Op;

  constructor(table: string, op: Op = 'select') {
    this.table = table;
    this.op = op;
  }

  select(_columns?: string) {
    this.returning = true;
    return this;
  }
  order(key: string) {
    this.orderKey = key;
    return this;
  }
  eq(key: string, value: unknown) {
    this.filters.push((row) => row[key] === value);
    return this;
  }
  in(key: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[key]));
    return this;
  }
  single() {
    this.single_ = true;
    return this;
  }
  _setOp(op: Op, payload: unknown, options: Row = {}) {
    this.op = op;
    this.payload = payload;
    this.options = options;
    return this;
  }

  private run(): Result {
    const rows = (db.tables[this.table] ??= []);
    db.calls.push({ table: this.table, op: this.op, payload: this.payload });

    const key = `${this.table}:${this.op}`;
    if (db.failures.delete(key)) return { data: null, error: { message: `forced ${key} failure` } };

    const matching = () => rows.filter((row) => this.filters.every((f) => f(row)));
    let out: Row[] = [];

    if (this.op === 'select') {
      out = matching();
      if (this.orderKey) out = [...out].sort((a, b) => String(a[this.orderKey!]).localeCompare(String(b[this.orderKey!])));
    } else if (this.op === 'insert') {
      const incoming: Row[] = Array.isArray(this.payload) ? this.payload : [this.payload];
      out = incoming.map((row) => ({
        id: crypto.randomUUID(),
        created_at: String(++counter).padStart(6, '0'),
        ...row,
      }));
      rows.push(...out);
    } else if (this.op === 'upsert') {
      const incoming: Row[] = Array.isArray(this.payload) ? this.payload : [this.payload];
      for (const row of incoming) {
        const existing = rows.find((r) => r.id === row.id);
        if (!existing) rows.push({ created_at: String(++counter).padStart(6, '0'), ...row });
        else if (!this.options.ignoreDuplicates) Object.assign(existing, row);
      }
      out = incoming;
    } else if (this.op === 'update') {
      out = matching();
      out.forEach((row) => Object.assign(row, this.payload));
    } else if (this.op === 'delete') {
      out = matching();
      db.tables[this.table] = rows.filter((row) => !out.includes(row));
    }

    if (this.single_) return { data: out[0] ?? null, error: null };
    return { data: this.returning || this.op === 'select' ? out : null, error: null };
  }

  then<R1 = Result, R2 = never>(
    onFulfilled?: ((value: Result) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2> {
    return Promise.resolve().then(() => this.run()).then(onFulfilled, onRejected);
  }
}

export const supabase = {
  from(table: string) {
    return {
      select: (columns?: string) => new Query(table).select(columns),
      insert: (payload: unknown) => new Query(table)._setOp('insert', payload),
      update: (payload: unknown) => new Query(table)._setOp('update', payload),
      delete: () => new Query(table)._setOp('delete', undefined),
      upsert: (payload: unknown, options?: Row) => new Query(table)._setOp('upsert', payload, options),
    };
  },
  auth: {
    getSession: async () => ({ data: { session: db.session } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: async () => ({ error: db.authError }),
    signUp: async () => ({ error: db.authError }),
    signOut: async () => ({ error: null }),
  },
};
