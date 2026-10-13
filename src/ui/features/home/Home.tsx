import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, supabaseRepository as repo } from '../../../storage/supabaseRepository';
import type { Profile } from '../../../domain/types';
import { AppBar, Button, Card, EmptyState, Input, List, ListItem, Modal, UserIcon, useToast } from '../../ds';

/** Home: profiles list, add profile, JSON backup, logout. Tap a profile for its tests (S1). */
export function Home() {
  const toast = useToast();
  const nav = useNavigate();
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const load = () => repo.listProfiles().then(setProfiles).catch((e: Error) => toast(e.message, 'bad'));
  useEffect(() => { load(); }, []);

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
            <List>
              {profiles.map((p) => <ListItem key={p.id} testId={`profile-${p.id}`} lead={p.name.slice(0, 1).toUpperCase()} title={p.name} sub="Tests und Fotos" onClick={() => nav(`/p/${p.id}`)} />)}
            </List>
            <Button variant="secondary" block data-testid="profile-add" onClick={() => setAdding(true)}>Weiteres Profil</Button>
          </>
        )}
        <Button variant="ghost" block onClick={backup}>Backup (JSON) herunterladen</Button>
      </main>
      <Modal open={adding} title="Neues Profil" onClose={() => setAdding(false)} actions={<><Button data-testid="profile-save" onClick={add} disabled={!name.trim()}>Anlegen</Button><Button variant="ghost" onClick={() => setAdding(false)}>Abbrechen</Button></>}>
        <Input data-testid="profile-name" label="Vorname" placeholder="z. B. Mila" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Modal>
    </>
  );
}
