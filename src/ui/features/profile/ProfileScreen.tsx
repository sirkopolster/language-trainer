import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabaseRepository as repo } from '../../../storage/supabaseRepository';
import type { Award, Profile, Test, Unit, Word } from '../../../domain/types';
import { AppBar, Button, Card, EmptyState, Input, Modal, TestIcon, useToast } from '../../ds';
import { NewTestModal } from '../test/NewTestModal';
import { TestCard, testProgress } from '../test/TestCard';
import { Stats } from '../home/Home';
import type { SessionSummary } from '../../../domain/stats';

/** One learner: every test the viewer can see (the family's tests), each with THIS learner's results (D-021). */
export function ProfileScreen() {
  const { profileId = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tests, setTests] = useState<Test[] | null>(null);
  const [data, setData] = useState<{ units: Unit[]; words: Word[]; awards: Award[]; sessions: SessionSummary[]; profiles: Profile[] } | null>(null);
  const [adding, setAdding] = useState(false);
  const [edit, setEdit] = useState<{ name: string; email: string; password: string } | null>(null);
  const [role, setRole] = useState<'admin' | 'student'>('student');
  const [stats, setStats] = useState<{ sessions: SessionSummary[]; awards: Award[] } | null>(null);
  const [attach, setAttach] = useState<{ email: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);

  /** a profile still on the parent's own login gets its own student account; all tests and progress stay */
  async function createAccount() {
    if (!attach || !profile) return;
    setBusy(true);
    try {
      await repo.adminCreateStudent({ name: profile.name, email: attach.email.trim(), password: attach.password, profileId });
      toast(`${profile.name} hat jetzt ein eigenes Konto`, 'good'); setAttach(null);
      repo.listProfiles().then((ps) => setProfile(ps.find((p) => p.id === profileId) ?? null));
    } catch (e) { toast((e as Error).message, 'bad'); }
    setBusy(false);
  }

  async function saveEdit() {
    if (!edit) return;
    setBusy(true);
    try {
      await repo.adminUpdateStudent({ profileId, name: edit.name.trim() || undefined, email: edit.email.trim() || undefined, password: edit.password || undefined });
      toast('Gespeichert', 'good'); setEdit(null);
      repo.listProfiles().then((ps) => setProfile(ps.find((p) => p.id === profileId) ?? null));
    } catch (e) { toast((e as Error).message, 'bad'); }
    setBusy(false);
  }

  const load = () => Promise.all([repo.listAllTests(), repo.listAllUnits(), repo.listAllWords(), repo.listAllAwards(), repo.listAllSessions(), repo.listProfiles()]).then(([t, units, words, awards, sessions, profiles]) => { setTests(t); setData({ units, words, awards: awards.filter((a) => a.profileId === profileId), sessions: sessions.filter((s) => s.profileId === profileId), profiles }); }).catch((e: Error) => toast(e.message, 'bad'));
  useEffect(() => {
    repo.listProfiles().then((ps) => setProfile(ps.find((p) => p.id === profileId) ?? null));
    repo.getRole().then(setRole);
    Promise.all([repo.listSessions(profileId), repo.listAllAwards()]).then(([sessions, awards]) => setStats({ sessions, awards: awards.filter((a) => a.profileId === profileId) })).catch(() => undefined);
    load();
  }, [profileId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <AppBar title={profile?.name ?? '…'} onBack={() => nav('/')} />
      <main className="page stack">
        {stats && <Stats sessions={stats.sessions} awards={stats.awards} />}
        {tests === null ? <p className="muted text-sm">Lädt…</p> : tests.length === 0 ? (
          <Card flat>
            <EmptyState icon={<TestIcon />} title="Welcher Test steht an?" text="Lege den nächsten Vokabeltest an. Danach fotografierst du die Vokabelseiten." action={<Button data-testid="test-add" onClick={() => setAdding(true)}>Test anlegen</Button>} />
          </Card>
        ) : (
          <>
            <p className="text-sm muted" style={{ margin: 0 }}>Ergebnisse von {profile?.name ?? '…'} je Test.</p>
            <div className="stack-sm">
              {tests.map((t) => <TestCard key={t.id} test={t} sub={t.profileId !== profileId ? `von ${data?.profiles.find((p) => p.id === t.profileId)?.name ?? '?'}` : undefined} progress={testProgress(t, data?.units ?? [], data?.words ?? [], data?.awards ?? [], data?.sessions ?? [])} onClick={() => nav(`/t/${t.id}`)} />)}
            </div>
            <Button variant="secondary" block data-testid="test-add" onClick={() => setAdding(true)}>Weiterer Test</Button>
          </>
        )}
        {profile && role === 'admin' && !profile.own && <Button variant="ghost" block data-testid="kid-edit" onClick={() => setEdit({ name: profile.name, email: '', password: '' })}>Konto von {profile.name} bearbeiten</Button>}
        {profile && role === 'admin' && profile.own && <Button variant="secondary" block data-testid="kid-attach" onClick={() => setAttach({ email: '', password: '' })}>Eigenes Konto für {profile.name} anlegen</Button>}
      </main>
      <Modal open={!!attach} title={`Konto für ${profile?.name ?? ''}`} onClose={() => setAttach(null)} actions={<><Button data-testid="kid-attach-save" onClick={createAccount} disabled={busy || !attach || !attach.email.includes('@') || attach.password.length < 8}>Anlegen</Button><Button variant="ghost" onClick={() => setAttach(null)}>Abbrechen</Button></>}>
        {attach && (
          <div className="stack-sm">
            <p className="text-sm muted">Damit meldet sich {profile?.name} auf dem eigenen Gerät an. Tests, Sterne und Fortschritt bleiben erhalten.</p>
            <Input label="E-Mail des Kindes" type="email" autoComplete="off" value={attach.email} onChange={(e) => setAttach({ ...attach, email: e.target.value })} autoFocus />
            <Input label="Passwort" type="text" autoComplete="off" hint="Mindestens 8 Zeichen." value={attach.password} onChange={(e) => setAttach({ ...attach, password: e.target.value })} />
          </div>
        )}
      </Modal>
      <Modal open={!!edit} title="Konto bearbeiten" onClose={() => setEdit(null)} actions={<><Button data-testid="kid-edit-save" onClick={saveEdit} disabled={busy}>Speichern</Button><Button variant="ghost" onClick={() => setEdit(null)}>Abbrechen</Button></>}>
        {edit && (
          <div className="stack-sm">
            <Input label="Vorname" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            <Input label="Neue E-Mail (leer = unverändert)" type="email" autoComplete="off" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
            <Input label="Neues Passwort (leer = unverändert)" type="text" autoComplete="off" hint="Mindestens 8 Zeichen." value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} />
          </div>
        )}
      </Modal>
      <NewTestModal open={adding} profiles={profile ? [profile] : []} profileId={profileId} onClose={() => setAdding(false)} onCreated={(t) => nav(`/t/${t.id}`)} />
    </>
  );
}
