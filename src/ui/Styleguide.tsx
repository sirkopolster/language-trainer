// /styleguide — every token and component in every state. Review surface, not an app screen.
import { useState } from 'react';
import { AppBar, BackIcon, Badge, BookIcon, Button, Card, CameraIcon, EmptyState, FlameIcon, HomeIcon, Input, List, ListItem, Modal, ProgressBar, TabBar, TestIcon, Textarea, useToast } from './ds';

const colors = ['primary', 'primary-strong', 'primary-soft', 'accent', 'accent-soft', 'good', 'good-soft', 'warn', 'warn-soft', 'bad', 'bad-soft', 'bg', 'card', 'text', 'muted', 'line'];
const spaces = [['s-1', 4], ['s-2', 8], ['s-3', 16], ['s-4', 24], ['s-5', 32]] as const;
const radii = ['r-sm', 'r-md', 'r-lg', 'r-pill'];

export function Styleguide() {
  const toast = useToast();
  const [modal, setModal] = useState(false);
  const [tab, setTab] = useState('home');
  return (
    <>
      <AppBar title="SnapLearn · Styleguide" left={<button type="button" className="iconbtn" aria-label="Zurück"><BackIcon /></button>} right={<Badge tone="star">12</Badge>} />
      <main className="page stack">
        <Section title="Farben">
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {colors.map((c) => (
              <div key={c} style={{ width: 96 }}>
                <div style={{ height: 40, borderRadius: 'var(--r-sm)', background: `var(--${c})`, border: '1px solid var(--line)' }} />
                <div className="text-xs muted">--{c}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Typografie">
          <div className="h1">Überschrift 1 · 24</div>
          <div className="h2">Überschrift 2 · 20</div>
          <div className="h3">Überschrift 3 · 16</div>
          <p className="text">Fließtext · 16. Lernen, bis die Vokabeln sitzen.</p>
          <p className="text-sm muted">Nebentext · 14, gedämpft</p>
          <p className="text-xs muted">Kleintext · 12</p>
        </Section>

        <Section title="Abstände & Radien">
          <div className="row" style={{ alignItems: 'flex-end' }}>
            {spaces.map(([n, px]) => <div key={n} style={{ textAlign: 'center' }}><div style={{ width: px, height: px, background: 'var(--primary)', borderRadius: 2, margin: '0 auto' }} /><div className="text-xs muted">{n}</div></div>)}
          </div>
          <div className="row">
            {radii.map((r) => <div key={r} style={{ textAlign: 'center' }}><div style={{ width: 48, height: 48, background: 'var(--primary-soft)', border: '2px solid var(--primary)', borderRadius: `var(--${r})` }} /><div className="text-xs muted">{r}</div></div>)}
          </div>
          <div className="row">
            <div style={{ flex: 1, height: 48, borderRadius: 'var(--r-md)', background: 'var(--card)', boxShadow: 'var(--shadow-1)' }} />
            <div style={{ flex: 1, height: 48, borderRadius: 'var(--r-md)', background: 'var(--card)', boxShadow: 'var(--shadow-2)' }} />
          </div>
          <div className="row text-xs muted"><span style={{ flex: 1 }}>shadow-1</span><span style={{ flex: 1 }}>shadow-2</span></div>
        </Section>

        <Section title="Buttons">
          <Button block onClick={() => toast('Gespeichert', 'good')}>Primary · Weiter</Button>
          <Button block variant="secondary">Secondary · Nochmal</Button>
          <Button block variant="ghost">Ghost · Überspringen</Button>
          <Button block variant="danger">Danger · Löschen</Button>
          <div className="row"><Button small>Klein</Button><Button small variant="secondary">Klein</Button><Button disabled>Inaktiv</Button></div>
        </Section>

        <Section title="Eingaben">
          <Input label="Dein Name" placeholder="z. B. Mila" />
          <Input label="Mit Hinweis" hint="Nur der Vorname reicht." defaultValue="Mila" />
          <Input label="Mit Fehler" error="Bitte einen Namen eingeben." />
          <Textarea label="Beispielsatz" placeholder="The cat sits on the mat." />
        </Section>

        <Section title="Karten">
          <Card title="Standard">Ein Inhalt mit Schatten.</Card>
          <Card flat title="Flach">Ohne Schatten, für Listen in Karten.</Card>
          <Card accent><div className="row-between"><div><div className="h3">Unit 4 · bereit</div><div className="text-sm muted">18 Wörter, 3 fett</div></div><Badge tone="crown">2</Badge></div></Card>
        </Section>

        <Section title="Listenelemente">
          <List>
            <ListItem lead="U1" title="Unit 1 · At home" sub="20 Wörter · 15 sicher" trail={<Badge tone="star">3</Badge>} onClick={() => toast('Unit 1 geöffnet')} />
            <ListItem lead="U2" title="Unit 2 · Food and drink mit sehr langem Titel der abgeschnitten wird" sub="24 Wörter" trail={<Badge tone="good">fertig</Badge>} onClick={() => undefined} />
            <ListItem lead={<BookIcon />} title="Ohne Pfeil" sub="Statisch, nicht antippbar" />
          </List>
        </Section>

        <Section title="Fortschritt">
          <ProgressBar value={7} max={10} label={['7 von 10', '70 %']} />
          <ProgressBar value={10} max={10} tone="good" label={['Fertig', '100 %']} />
          <ProgressBar value={3} max={10} tone="accent" thin />
        </Section>

        <Section title="Badges">
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <Badge>neutral</Badge><Badge tone="primary">neu</Badge><Badge tone="good">richtig</Badge><Badge tone="warn">fällig</Badge><Badge tone="bad">falsch</Badge><Badge tone="star">3</Badge><Badge tone="crown">1</Badge>
          </div>
          <div className="row"><Badge tone="star" large>12 Sterne</Badge><Badge tone="crown" large>2 Kronen</Badge><Badge tone="primary" large><FlameIcon /> 5 Tage</Badge></div>
        </Section>

        <Section title="Modal & Toast">
          <div className="row">
            <Button variant="secondary" onClick={() => setModal(true)}>Modal öffnen</Button>
            <Button variant="ghost" onClick={() => toast('Hinweis')}>Toast</Button>
            <Button variant="ghost" onClick={() => toast('Das war falsch', 'bad')}>Toast rot</Button>
          </div>
          <Modal open={modal} title="Unit wirklich löschen?" onClose={() => setModal(false)} actions={<><Button variant="danger" onClick={() => { setModal(false); toast('Gelöscht', 'bad'); }}>Ja, löschen</Button><Button variant="ghost" onClick={() => setModal(false)}>Abbrechen</Button></>}>
            <p className="text">Alle 20 Wörter und dein Fortschritt dieser Unit gehen verloren.</p>
          </Modal>
        </Section>

        <Section title="Leerer Zustand">
          <Card flat>
            <EmptyState icon={<CameraIcon />} title="Noch keine Vokabeln" text="Fotografiere die Seiten aus deinem Buch, dann geht es los." action={<Button>Fotos aufnehmen</Button>} />
          </Card>
        </Section>
      </main>
      <TabBar active={tab} onSelect={setTab} tabs={[{ id: 'home', label: 'Start', icon: <HomeIcon /> }, { id: 'learn', label: 'Lernen', icon: <BookIcon /> }, { id: 'test', label: 'Test', icon: <TestIcon /> }, { id: 'me', label: 'Ich', icon: <FlameIcon /> }]} />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="stack-sm"><h2 className="h2" style={{ marginTop: 'var(--s-2)' }}>{title}</h2>{children}</section>;
}
