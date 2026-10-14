import { useState, type FormEvent } from 'react';
import { supabase, supabaseRepository as repo } from '../../../storage/supabaseRepository';
import { Button, Card, Input } from '../../ds';

/** Parent login. Registration via sign-up with the same form (toggle), no password reset in v1 (built-in mailer, same as Trainer-App D-044). */
export function Login() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    if (mode === 'login') {
      await repo.signIn(email, password).catch((e: Error) => setError(/fetch|network/i.test(e.message) ? 'Keine Verbindung.' : e.message));
    } else {
      const res = await supabase.auth.signUp({ email, password });
      if (res.error) setError(/fetch|network/i.test(res.error.message) ? 'Keine Verbindung.' : res.error.message);
      else if (!res.data.session) setInfo('Fast geschafft: bitte den Link in der E-Mail bestätigen.');
    }
    setBusy(false);
  }

  return (
    <main className="page stack" style={{ minHeight: '100dvh', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="h1" style={{ color: 'var(--primary)' }}>SnapLearn</div>
        <p className="text-sm muted">Fotografieren · lernen · Test bestehen</p>
      </div>
      <Card>
        <form className="stack" onSubmit={submit}>
          <Input data-testid="login-email" label={mode === 'login' ? 'Name oder E-Mail' : 'E-Mail'} type={mode === 'login' ? 'text' : 'email'} autoCapitalize="none" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input data-testid="login-password" label="Passwort" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} error={error ?? undefined} hint={mode === 'signup' ? 'Mindestens 8 Zeichen.' : undefined} />
          {info && <p className="text-sm" style={{ color: 'var(--good)' }}>{info}</p>}
          <Button data-testid="login-submit" type="submit" block disabled={busy}>{mode === 'login' ? 'Anmelden' : 'Konto anlegen'}</Button>
          <Button data-testid="login-toggle" variant="ghost" block onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); setInfo(null); }}>
            {mode === 'login' ? 'Neu hier? Konto anlegen' : 'Schon ein Konto? Anmelden'}
          </Button>
        </form>
      </Card>
      <p className="text-xs muted" style={{ textAlign: 'center' }}>Eltern legen sich ein Konto an und erstellen darin die Konten ihrer Kinder.</p>
    </main>
  );
}
