import { render, screen, waitFor } from '@testing-library/react';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_COLUMNS } from './constants';
import { Auth } from './components/Auth';
import { Board } from './components/Board';
import { db } from './test/supabaseMock';

vi.mock('./lib/supabaseClient', () => import('./test/supabaseMock'));

const root = process.cwd();
const html = new DOMParser().parseFromString(readFileSync(resolve(root, 'index.html'), 'utf8'), 'text/html');
const meta = (selector: string) => html.querySelector(selector)?.getAttribute('content') ?? '';

beforeEach(() => db.reset());

describe('SEO regression: index.html', () => {
  it('declares language and viewport', () => {
    expect(html.documentElement.lang).toBe('en');
    expect(meta('meta[name="viewport"]')).toContain('width=device-width');
  });

  it('has a descriptive title that fits in search results', () => {
    const title = html.title;
    expect(title).toMatch(/^Flowboard/);
    expect(title.length).toBeGreaterThan('Flowboard'.length);
    expect(title.length).toBeLessThanOrEqual(60);
  });

  it('has a meta description of 70–160 characters', () => {
    const description = meta('meta[name="description"]');
    expect(description.length).toBeGreaterThanOrEqual(70);
    expect(description.length).toBeLessThanOrEqual(160);
  });

  it('has Open Graph and Twitter card tags for link previews', () => {
    for (const property of ['og:title', 'og:description', 'og:type', 'og:site_name']) {
      expect(meta(`meta[property="${property}"]`), property).not.toBe('');
    }
    expect(meta('meta[name="twitter:card"]')).not.toBe('');
    expect(meta('meta[name="twitter:title"]')).not.toBe('');
  });

  it('does not block indexing of the only public page', () => {
    expect(meta('meta[name="robots"]')).not.toMatch(/noindex/i);
  });

  it('ships a robots.txt that allows crawling', () => {
    const path = resolve(root, 'public/robots.txt');
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, 'utf8')).toMatch(/User-agent:\s*\*/);
    expect(readFileSync(path, 'utf8')).not.toMatch(/Disallow:\s*\/\s*$/m);
  });
});

describe('SEO regression: heading structure', () => {
  it('signed-out page has exactly one h1', () => {
    render(<Auth />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('board has exactly one h1', async () => {
    db.seed('columns', DEFAULT_COLUMNS.map((c, position) => ({ ...c, user_id: 'u1', position })));
    render(<Board userId="u1" userEmail="a@b.co" />);
    await waitFor(() => expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'false'));
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});
