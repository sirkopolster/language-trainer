import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, supabaseRepository as repo } from '../../../storage/supabaseRepository';
import type { Award, Profile, Test } from '../../../domain/types';
import { AppBar, Button, Card, CrownIcon, EmptyState, Input, List, ListItem, Modal, StarIcon, TestIcon, UserIcon, useToast } from '../../ds';
import { NewTestModal, testSub } from '../test/NewTestModal';

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
  const [newTest, setNewTest] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [kid, setKid] = useState<{ name: string; email: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => Promise.all([repo.getRole(), repo.listProfiles(), repo.listAllTests(), repo.listAllAwards()]).then(([r, p, t, a]) => { setRole(r); setProfiles(p); setTests(t); setAwards(a); }).catch((e: Error) => toast(e.message, 'bad'));
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
      <AppBar title="SnapLearn" right={<Button small variant="ghost" onClick={() => supabase.auth.signOut()}>Abmelden</Button>} />
      <main className="page stack">
        {profiles === null || role === null ? <p className="muted text-sm">Lädt…</p> : role === 'student' ? (
          !me ? (
            <Card flat><EmptyState icon={<UserIcon />} title="Wie heißt du?" text="Nur dein Vorname, mehr braucht es nicht." action={<Button data-testid="profile-add" onClick={() => setNaming(true)}>Namen eingeben</Button>} /></Card>
          ) : (
            <>
              <div className="row-between">
                <h2 className="h2">Aktuelle Tests</h2>
                {tests.length > 0 && <Button small data-testid="test-add" onClick={() => setNewTest(true)}>Neuer Test</Button>}
              </div>
              {tests.length === 0 ? (
                <Card flat><EmptyState icon={<TestIcon />} title="Welcher Test steht an?" text="Lege den nächsten Vokabeltest an und fotografiere danach die Vokabelseiten." action={<Button data-testid="test-add" onClick={() => setNewTest(true)}>Neuen Test anlegen</Button>} /></Card>
              ) : (
                <List>{tests.map((t) => <ListItem key={t.id} testId={`test-${t.id}`} lead={<TestIcon />} title={t.name} sub={testSub(t)} onClick={() => nav(`/t/${t.id}`)} />)}</List>
              )}
            </>
          )
        ) : (
          <>
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
                  return <ListItem key={p.id} testId={`profile-${p.id}`} lead={p.name.slice(0, 1).toUpperCase()} title={p.name} sub={`${pt.length === 1 ? '1 Test' : `${pt.length} Tests`}${p.email ? ` · ${p.email}` : ''}`} trail={<span className="row text-sm" style={{ color: 'var(--accent)' }}><StarIcon />{starsOf(p.id)} <CrownIcon />{crownsOf(p.id)}</span>} onClick={() => nav(`/p/${p.id}`)} />;
                })}
              </List>
            )}
            {tests.length > 0 && (
              <>
                <h2 className="h2">Aktuelle Tests</h2>
                <List>{tests.map((t) => <ListItem key={t.id} testId={`test-${t.id}`} lead={<TestIcon />} title={t.name} sub={testSub(t, profiles.find((p) => p.id === t.profileId)?.name)} onClick={() => nav(`/t/${t.id}`)} />)}</List>
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
