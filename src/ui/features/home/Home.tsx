import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseRepository as repo } from '../../../storage/supabaseRepository';
import { computeStats, type SessionSummary } from '../../../domain/stats';
import { UserMenu } from '../account/UserMenu';
import type { Award, Profile, Test, Unit, Word } from '../../../domain/types';
import { TestCard, testProgress } from '../test/TestCard';
import { AppBar, Button, Card, ColorIcon, CrownIcon, EmptyState, FlameIcon, Input, List, ListItem, Modal, StarIcon, TestIcon, UserIcon, ClipboardCheckIcon, GraduationIcon, useToast } from '../../ds';
import { NewTestModal } from '../test/NewTestModal';

/**
 * Home (D-015). Student: "Aktuelle Tests" of the own profile, nothing else. Admin (parent): the children with progress,
 * "Neues Kind" creates a student account (name, e-mail, password) via the admin function.
 */
export function Home() {
  const toast = useToast();
  const nav = useNavigate();
  const [role, setRole] = useState<'admin' | 'student' | null>(null);
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [tests, setTests] = useState<Test[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [words, setWords] = useState<Word[]>([]);
  const [newTest, setNewTest] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [kid, setKid] = useState<{ name: string; email: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [accountName, setAccountName] = useState('');

  const load = () => Promise.all([repo.getRole(), repo.listProfiles(), repo.listAllTests(), repo.listAllAwards(), repo.listAllUnits(), repo.listAllWords(), repo.listAllSessions()]).then(async ([r, p, t, a, u, w, se]) => {
    setRole(r); setProfiles(p); setTests(t); setAwards(a); setUnits(u); setWords(w); setSessions(se);
    const own = p.find((x) => x.own);
    const acc = await repo.getAccount();
    setAccountName(acc.name || own?.name || acc.email.split('@')[0]);
  }).catch((e: Error) => toast(e.message, 'bad'));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const me = profiles?.find((p) => p.own) ?? null;

  async function saveName() {
    const n = name.trim();
    if (!n) return;
    await repo.addProfile(n).catch((e: Error) => toast(e.message, 'bad'));
    setName(''); setNaming(false); load();
  }

  async function createKid() {
    if (!kid) return;
    setBusy(true);
    try { await repo.adminCreateStudent(kid); toast(`${kid.name} angelegt`, 'good'); setKid(null); load(); }
    catch (e) { toast((e as Error).message, 'bad'); }
    setBusy(false);
  }

  async function backup() {
    const data = await repo.exportAll();
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...data }, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `snaplearn-backup-${new Date().toISOString().slice(0, 10)}.json` });
    a.click(); URL.revokeObjectURL(a.href);
  }

  const starsOf = (profileId: string) => awards.filter((a) => a.profileId === profileId && a.kind === 'star').reduce((s, a) => s + a.value, 0);
  const crownsOf = (profileId: string) => awards.filter((a) => a.profileId === profileId && a.kind === 'crown').length;

  return (
    <>
      <AppBar title={<span>Snap<span style={{ color: 'var(--accent)' }}>Learn</span></span>} right={<span className="row">{me && <Button small data-testid="test-add" onClick={() => setNewTest(true)}>Neuer Test</Button>}<UserMenu name={accountName} role={role} onNameChange={load} /></span>} />
      <main className="page stack">
        {profiles === null || role === null ? <p className="muted text-sm">Lädt…</p> : role === 'student' ? (
          !me ? (
            <Card flat><EmptyState icon={<UserIcon />} title="Wie heißt du?" text="Nur dein Vorname, mehr braucht es nicht." action={<Button data-testid="profile-add" onClick={() => setNaming(true)}>Namen eingeben</Button>} /></Card>
          ) : (
            <>
              <h1 className="hello">Hi <span className="hello-name">{me.name}</span>, schön, dass du da bist</h1>
              <Stats sessions={sessions.filter((s) => s.profileId === me.id)} awards={awards.filter((a) => a.profileId === me.id)} />
              <h2 className="h2">Aktuelle Tests</h2>
              {tests.length === 0 ? (
                <Card flat><EmptyState icon={<TestIcon />} title="Welcher Test steht an?" text="Lege den nächsten Vokabeltest an und fotografiere danach die Vokabelseiten." action={<Button data-testid="test-add-empty" onClick={() => setNewTest(true)}>Neuen Test anlegen</Button>} /></Card>
              ) : (
                <div className="stack-sm">{tests.map((t) => <TestCard key={t.id} test={t} progress={testProgress(t, units, words, awards, sessions)} onClick={() => nav(`/t/${t.id}`)} />)}</div>
              )}
            </>
          )
        ) : (
          <>
            <h1 className="hello">Hi <span className="hello-name">{accountName}</span>, schön, dass du da bist</h1>
            <div className="row-between">
              <h2 className="h2">Kinder</h2>
              <Button small data-testid="kid-add" onClick={() => setKid({ name: '', email: '', password: '' })}>Neues Kind</Button>
            </div>
            {profiles.length === 0 ? (
              <Card flat><EmptyState icon={<UserIcon />} title="Noch kein Kind angelegt" text="Jedes Kind bekommt ein eigenes Konto mit E-Mail und Passwort und sieht nur seine Tests." action={<Button data-testid="kid-add" onClick={() => setKid({ name: '', email: '', password: '' })}>Neues Kind</Button>} /></Card>
            ) : (
              <List>
                {profiles.map((p) => {
                  const pt = tests.filter((t) => t.profileId === p.id);
                  return <ListItem key={p.id} testId={`profile-${p.id}`} lead={<ColorIcon color={(['orange', 'green', 'blue', 'pink'] as const)[profiles.indexOf(p) % 4]}>{p.name.slice(0, 1).toUpperCase()}</ColorIcon>} title={p.name} sub={`${pt.length === 1 ? '1 Test' : `${pt.length} Tests`}${p.email ? ` · ${p.email}` : ''}`} trail={<span className="row text-sm" style={{ color: 'var(--accent)' }}><StarIcon />{starsOf(p.id)} <CrownIcon />{crownsOf(p.id)}</span>} onClick={() => nav(`/p/${p.id}`)} />;
                })}
              </List>
            )}
            {tests.length > 0 && (
              <>
                <h2 className="h2">Aktuelle Tests</h2>
                <div className="stack-sm">{tests.map((t) => <TestCard key={t.id} test={t} sub={profiles.find((p) => p.id === t.profileId)?.name} progress={testProgress(t, units, words, awards, sessions)} onClick={() => nav(`/t/${t.id}`)} />)}</div>
              </>
            )}
            <Button variant="ghost" block onClick={backup}>Backup (JSON) herunterladen</Button>
          </>
        )}
      </main>
      <Modal open={naming} title="Dein Name" onClose={() => setNaming(false)} actions={<><Button data-testid="profile-save" onClick={saveName} disabled={!name.trim()}>Speichern</Button><Button variant="ghost" onClick={() => setNaming(false)}>Abbrechen</Button></>}>
        <Input data-testid="profile-name" label="Vorname" placeholder="z. B. Mila" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Modal>
      <Modal open={!!kid} title="Neues Kind" onClose={() => setKid(null)} actions={<><Button data-testid="kid-save" onClick={createKid} disabled={busy || !kid || !kid.name.trim() || !kid.email.includes('@') || kid.password.length < 8}>Anlegen</Button><Button variant="ghost" onClick={() => setKid(null)}>Abbrechen</Button></>}>
        {kid && (
          <div className="stack-sm">
            <Input data-testid="kid-name" label="Vorname" value={kid.name} onChange={(e) => setKid({ ...kid, name: e.target.value })} autoFocus />
            <Input data-testid="kid-email" label="E-Mail des Kindes" type="email" autoComplete="off" value={kid.email} onChange={(e) => setKid({ ...kid, email: e.target.value })} />
            <Input data-testid="kid-password" label="Passwort" type="text" autoComplete="off" hint="Mindestens 8 Zeichen. Du kannst es später ändern." value={kid.password} onChange={(e) => setKid({ ...kid, password: e.target.value })} />
          </div>
        )}
      </Modal>
      {me && <NewTestModal open={newTest} profiles={[me]} profileId={me.id} onClose={() => setNewTest(false)} onCreated={(t) => { setNewTest(false); nav(`/t/${t.id}`); }} />}
    </>
  );
}

export function Stats({ sessions, awards }: { sessions: SessionSummary[]; awards: Award[] }) {
  const s = computeStats(sessions, awards);
  const tiles = [
    { n: s.days, l: s.days === 1 ? 'Tag gelernt' : 'Tage gelernt', icon: <ColorIcon color="orange"><FlameIcon /></ColorIcon> },
    { n: s.partsDone, l: s.partsDone === 1 ? 'Teil geschafft' : 'Teile geschafft', icon: <ColorIcon color="green"><GraduationIcon /></ColorIcon> },
    { n: s.answers, l: 'Aufgaben beantwortet', icon: <ColorIcon color="yellow"><StarIcon /></ColorIcon> },
    { n: s.mocks, l: s.mocks === 1 ? 'Probetest geschrieben' : 'Probetests geschrieben', icon: <ColorIcon color="blue"><ClipboardCheckIcon /></ColorIcon> },
  ];
  const shown = tiles.filter((t) => t.n > 0); // accomplishments appear once they exist
  if (shown.length === 0) return null;
  return <div className="stats" data-testid="stats">{shown.map((t) => <div key={t.l} className="stat">{t.icon}<div><div className="stat-n">{t.n}</div><div className="stat-l">{t.l}</div></div></div>)}</div>;
}
