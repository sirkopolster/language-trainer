import { useState } from 'react';
import { supabaseRepository as repo } from '../../../storage/supabaseRepository';
import type { Profile, Test } from '../../../domain/types';
import { Button, Input, Modal, useToast } from '../../ds';

export const LANGS: Record<string, string> = { de: 'Deutsch', en: 'Englisch', fr: 'Französisch', es: 'Spanisch', la: 'Latein' };
export const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null);
export const testSub = (t: Test, profileName?: string) => [profileName, `${LANGS[t.langFrom] ?? t.langFrom} → ${LANGS[t.langTo] ?? t.langTo}`, fmtDate(t.testDate)].filter(Boolean).join(' · ');

/** "Neuer Test" dialog shared by Home and ProfileScreen. Shows a student picker only when there is a choice. */
export function NewTestModal({ open, profiles, profileId, onClose, onCreated }: { open: boolean; profiles: Profile[]; profileId?: string; onClose: () => void; onCreated: (t: Test) => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [langTo, setLangTo] = useState('en');
  const [date, setDate] = useState('');
  const [picked, setPicked] = useState('');
  const student = profileId ?? (profiles.some((p) => p.id === picked) ? picked : profiles[0]?.id ?? '');

  async function add() {
    const n = name.trim();
    if (!n || !student) return;
    try {
      const t = await repo.addTest(student, { name: n, langFrom: 'de', langTo, testDate: date || null });
      setName(''); setDate('');
      onCreated(t);
    } catch (e) { toast((e as Error).message, 'bad'); }
  }

  return (
    <Modal open={open} title="Neuer Test" onClose={onClose} actions={<><Button data-testid="test-save" onClick={add} disabled={!name.trim() || !student}>Anlegen</Button><Button variant="ghost" onClick={onClose}>Abbrechen</Button></>}>
      <div className="stack-sm">
        {!profileId && profiles.length > 1 && (
          <label className="field"><span className="field-label">Wer lernt?</span>
            <select className="input" value={student} onChange={(e) => setPicked(e.target.value)}>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        )}
        <Input data-testid="test-name" label="Name" placeholder="z. B. Vokabeltest Unit 4" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <label className="field"><span className="field-label">Sprache</span>
          <select className="input" value={langTo} onChange={(e) => setLangTo(e.target.value)}>
            {Object.entries(LANGS).filter(([k]) => k !== 'de').map(([k, v]) => <option key={k} value={k}>Deutsch ↔ {v}</option>)}
          </select>
        </label>
        <Input label="Datum des Tests (optional)" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
    </Modal>
  );
}
