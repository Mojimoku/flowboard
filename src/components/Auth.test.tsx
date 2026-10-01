import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../test/supabaseMock';
import { Auth } from './Auth';

vi.mock('../lib/supabaseClient', () => import('../test/supabaseMock'));

beforeEach(() => db.reset());

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>, submitName: RegExp) {
  await user.type(screen.getByLabelText('Email'), 'a@b.co');
  await user.type(screen.getByLabelText('Password'), 'secret123');
  await user.click(screen.getByRole('button', { name: submitName }));
}

describe('Auth', () => {
  it('shows the sign-in heading by default', () => {
    render(<Auth />);
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in to Flowboard' })).toBeInTheDocument();
  });

  it('shows the error returned by Supabase', async () => {
    const user = userEvent.setup();
    db.authError = { message: 'Invalid login credentials' };
    render(<Auth />);
    await fillAndSubmit(user, /^sign in$/i);
    expect(await screen.findByText('Invalid login credentials')).toBeInTheDocument();
  });

  it('switches to sign-up and tells the user to confirm their email', async () => {
    const user = userEvent.setup();
    render(<Auth />);
    await user.click(screen.getByRole('button', { name: /Don't have an account/ }));
    expect(screen.getByRole('heading', { level: 1, name: 'Create your Flowboard account' })).toBeInTheDocument();
    await fillAndSubmit(user, /^sign up$/i);
    expect(await screen.findByRole('status')).toHaveTextContent('Check your email to confirm');
  });
});
