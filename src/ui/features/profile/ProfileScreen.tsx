import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabaseRepository as repo } from '../../../storage/supabaseRepository';
import type { Profile, Test } from '../../../domain/types';
import { AppBar, BackIcon, Button, Card, EmptyState, Input, List, ListItem, Modal, TestIcon, useToast } from '../../ds';

const LANGS: Record<string, string> = { de: 'Deutsch', en: 'Englisch', fr: 'Französisch', es: 'Spanisch', la: 'Latein' };
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null);

/** S1: a student's tests. One test = one learning goal (e.g. "Vokabeltest Unit 4"). */
export function ProfileScreen() {
  const { profileId = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tests, setTests] = useState<Test[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [langTo, setLangTo] = useState('en');
  const [date, setDate] = useState('');

  const load = () => repo.listTests(profileId).then(setTests).catch((e: Error) => toast(e.message, 'bad'));
  useEffect(() => {
    repo.listProfiles().then((ps) => setProfile(ps.find((p) => p.id === profileId) ?? null));
    load();
  }, [profileId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function add() {
    const n = name.trim();
    if (!n) return;
    try {
      const t = await repo.addTest(profileId, { name: n, langFrom: 'de', langTo, testDate: date || null });
      setAdding(false); setName(''); setDate('');
      nav(`/t/${t.id}`);
    } catch (e) { toast((e as Error).message, 'bad'); }
  }

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
                <ListItem key={t.id} lead={<TestIcon />} title={t.name} sub={[`${LANGS[t.langFrom] ?? t.langFrom} → ${LANGS[t.langTo] ?? t.langTo}`, fmtDate(t.testDate)].filter(Boolean).join(' · ')} onClick={() => nav(`/t/${t.id}`)} />
              ))}
            </List>
            <Button variant="secondary" block data-testid="test-add" onClick={() => setAdding(true)}>Weiterer Test</Button>
          </>
        )}
      </main>
      <Modal open={adding} title="Neuer Test" onClose={() => setAdding(false)} actions={<><Button data-testid="test-save" onClick={add} disabled={!name.trim()}>Anlegen</Button><Button variant="ghost" onClick={() => setAdding(false)}>Abbrechen</Button></>}>
        <div className="stack-sm">
          <Input data-testid="test-name" label="Name" placeholder="z. B. Vokabeltest Unit 4" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <label className="field"><span className="field-label">Sprache</span>
            <select className="input" value={langTo} onChange={(e) => setLangTo(e.target.value)}>
              {Object.entries(LANGS).filter(([k]) => k !== 'de').map(([k, v]) => <option key={k} value={k}>Deutsch ↔ {v}</option>)}
            </select>
          </label>
          <Input label="Datum des Tests (optional)" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </Modal>
    </>
  );
}
