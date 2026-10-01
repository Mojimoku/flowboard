import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export function Auth() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);

    const { error } = mode === 'sign-in' ? await signIn(email, password) : await signUp(email, password);

    setSubmitting(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (mode === 'sign-up') {
      setInfo('Account created. Check your email to confirm, then sign in.');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-4">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-2xl border border-black/10 p-6 shadow-xl">
        <h1 className="text-lg font-medium text-[#0a0a0a]">
          {mode === 'sign-in' ? 'Sign in to Flowboard' : 'Create your Flowboard account'}
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-[#0a0a0a]">Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-[10px] border border-[#767676] px-3 py-2.5 text-sm text-[#0a0a0a] focus:border-[#0369a1] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0369a1]"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-[#0a0a0a]">Password</span>
            <input
              type="password"
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              aria-describedby="password-hint"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-[10px] border border-[#767676] px-3 py-2.5 text-sm text-[#0a0a0a] focus:border-[#0369a1] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0369a1]"
            />
          </label>

          <p id="password-hint" className="-mt-2 text-xs text-[#585868]">
            At least 6 characters.
          </p>

          <div aria-live="polite">
            {error && (
              <p role="alert" className="text-sm text-[#d4183d]">
                {error}
              </p>
            )}
            {info && (
              <p role="status" className="text-sm text-[#0369a1]">
                {info}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="rounded-[10px] bg-[#0369a1] px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mode === 'sign-in' ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
            setError(null);
            setInfo(null);
          }}
          className="text-sm font-medium text-[#0369a1] hover:underline"
        >
          {mode === 'sign-in' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
