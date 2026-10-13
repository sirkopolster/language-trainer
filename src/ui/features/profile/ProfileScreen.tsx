import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabaseRepository as repo } from '../../../storage/supabaseRepository';
import type { Profile, Test } from '../../../domain/types';
import { AppBar, BackIcon, Button, Card, EmptyState, List, ListItem, TestIcon, useToast } from '../../ds';
import { NewTestModal, testSub } from '../test/NewTestModal';

/** S1: a student's tests. One test = one learning goal (e.g. "Vokabeltest Unit 4"). */
export function ProfileScreen() {
  const { profileId = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tests, setTests] = useState<Test[] | null>(null);
  const [adding, setAdding] = useState(false);

  const load = () => repo.listTests(profileId).then(setTests).catch((e: Error) => toast(e.message, 'bad'));
  useEffect(() => {
    repo.listProfiles().then((ps) => setProfile(ps.find((p) => p.id === profileId) ?? null));
    load();
  }, [profileId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <AppBar title={profile?.name ?? '…'} left={<button className="iconbtn" aria-label="Zurück" onClick={() => nav('/')}><BackIcon /></button>} />
      <main className="page stack">
        {tests === null ? <p className="muted text-sm">Lädt…</p> : tests.length === 0 ? (
          <Card flat>
            <EmptyState icon={<TestIcon />} title="Welcher Test steht an?" text="Lege den nächsten Vokabeltest an. Danach fotografierst du die Vokabelseiten." action={<Button data-testid="test-add" onClick={() => setAdding(true)}>Test anlegen</Button>} />
          </Card>
        ) : (
          <>
            <List>
              {tests.map((t) => (
                <ListItem key={t.id} lead={<TestIcon />} title={t.name} sub={testSub(t)} onClick={() => nav(`/t/${t.id}`)} />
              ))}
            </List>
            <Button variant="secondary" block data-testid="test-add" onClick={() => setAdding(true)}>Weiterer Test</Button>
          </>
        )}
      </main>
      <NewTestModal open={adding} profiles={profile ? [profile] : []} profileId={profileId} onClose={() => setAdding(false)} onCreated={(t) => nav(`/t/${t.id}`)} />
    </>
  );
}
