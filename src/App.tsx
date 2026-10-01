import { Auth } from './components/Auth';
import { Board } from './components/Board';
import { useAuth } from './hooks/useAuth';

function App() {
  const { session, loading } = useAuth();

  if (loading) return null;
  if (!session) return <Auth />;

  return <Board userId={session.user.id} userEmail={session.user.email} />;
}

export default App;
