import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, supabaseRepository as repo } from '../../../storage/supabaseRepository';
import type { Profile, Test } from '../../../domain/types';
import { AppBar, Button, Card, EmptyState, Input, List, ListItem, Modal, TestIcon, UserIcon, useToast } from '../../ds';
import { NewTestModal, testSub } from '../test/NewTestModal';

/** Home dashboard: all tests across students (tap to open), CTA "Neuer Test", students below, backup + logout. */
export function Home() {
  const toast = useToast();
  const nav = useNavigate();
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [tests, setTests] = useState<Test[]>([]);
  const [adding, setAdding] = useState(false);
  const [newTest, setNewTest] = useState(false);
  const [name, setName] = useState('');

  const load = () => Promise.all([repo.listProfiles(), repo.listAllTests()]).then(([p, t]) => { setProfiles(p); setTests(t); }).catch((e: Error) => toast(e.message, 'bad'));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function add() {
    const n = name.trim();
    if (!n) return;
    await repo.addProfile(n).catch((e: Error) => toast(e.message, 'bad'));
    setName(''); setAdding(false); load(); toast(`${n} angelegt`, 'good');
  }

  async function backup() {
    const data = await repo.exportAll();
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...data }, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `snaplearn-backup-${new Date().toISOString().slice(0, 10)}.json` });
    a.click(); URL.revokeObjectURL(a.href);
  }

  const nameOf = (id: string) => profiles?.find((p) => p.id === id)?.name;

  return (
    <>
      <AppBar title="SnapLearn" right={<Button small variant="ghost" onClick={() => supabase.auth.signOut()}>Abmelden</Button>} />
      <main className="page stack">
        {profiles === null ? <p className="muted text-sm">Lädt…</p> : profiles.length === 0 ? (
          <Card flat>
            <EmptyState icon={<UserIcon />} title="Wer lernt hier?" text="Lege ein Profil für dein Kind an. Nur der Vorname, mehr braucht es nicht." action={<Button data-testid="profile-add" onClick={() => setAdding(true)}>Profil anlegen</Button>} />
          </Card>
        ) : (
          <>
            <div className="row-between">
              <h2 className="h2">Tests</h2>
              {tests.length > 0 && <Button small data-testid="test-add" onClick={() => setNewTest(true)}>Neuer Test</Button>}
            </div>
            {tests.length === 0 ? (
              <Card flat>
                <EmptyState icon={<TestIcon />} title="Welcher Test steht an?" text="Lege den nächsten Vokabeltest an und fotografiere danach die Vokabelseiten." action={<Button data-testid="test-add" onClick={() => setNewTest(true)}>Neuen Test anlegen</Button>} />
              </Card>
            ) : (
              <List>
                {tests.map((t) => <ListItem key={t.id} testId={`test-${t.id}`} lead={<TestIcon />} title={t.name} sub={testSub(t, nameOf(t.profileId))} onClick={() => nav(`/t/${t.id}`)} />)}
              </List>
            )}
            <div className="row-between">
              <h2 className="h2">Kinder</h2>
              <Button small variant="secondary" data-testid="profile-add" onClick={() => setAdding(true)}>Profil</Button>
            </div>
            <List>
              {profiles.map((p) => <ListItem key={p.id} testId={`profile-${p.id}`} lead={p.name.slice(0, 1).toUpperCase()} title={p.name} sub={(n => n === 1 ? '1 Test' : `${n} Tests`)(tests.filter((t) => t.profileId === p.id).length)} onClick={() => nav(`/p/${p.id}`)} />)}
            </List>
          </>
        )}
        <Button variant="ghost" block onClick={backup}>Backup (JSON) herunterladen</Button>
      </main>
      <Modal open={adding} title="Neues Profil" onClose={() => setAdding(false)} actions={<><Button data-testid="profile-save" onClick={add} disabled={!name.trim()}>Anlegen</Button><Button variant="ghost" onClick={() => setAdding(false)}>Abbrechen</Button></>}>
        <Input data-testid="profile-name" label="Vorname" placeholder="z. B. Mila" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Modal>
      <NewTestModal open={newTest} profiles={profiles ?? []} onClose={() => setNewTest(false)} onCreated={(t) => { setNewTest(false); nav(`/t/${t.id}`); }} />
    </>
  );
}
