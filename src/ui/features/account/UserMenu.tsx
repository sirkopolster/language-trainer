import { useEffect, useState } from 'react';
import { supabase, supabaseRepository as repo } from '../../../storage/supabaseRepository';
import type { Role } from '../../../domain/types';
import { Badge, Button, Input, Modal, UserIcon, useToast } from '../../ds';

/** Top-right account button: icon only. Opens a sheet with name, e-mail, e-mail change and logout. */
export function UserMenu({ name, role, onNameChange }: { name: string; role: Role | null; onNameChange?: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState('');

  async function changeName() {
    const n = newName.trim();
    if (!n) return;
    setBusy(true);
    try { await repo.updateAdminName(n); toast('Name geändert', 'good'); setNewName(''); onNameChange?.(); }
    catch (e) { toast((e as Error).message, 'bad'); }
    setBusy(false);
  }
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? '')); }, []);

  async function changeEmail() {
    const e = newEmail.trim();
    if (!e.includes('@')) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ email: e });
    if (error) toast(error.message, 'bad');
    else { toast('Bestätigungslink an die neue Adresse geschickt', 'good'); setNewEmail(''); }
    setBusy(false);
  }

  return (
    <>
      <button type="button" className="usermenu" data-testid="usermenu" aria-label="Konto" onClick={() => setOpen(true)}>
        <span className="usermenu-icon"><UserIcon /></span>
      </button>
      <Modal open={open} title="Dein Konto" onClose={() => setOpen(false)} actions={<Button variant="ghost" onClick={() => setOpen(false)}>Schließen</Button>}>
        <div className="stack-sm">
          <div className="row"><span className="usermenu-icon usermenu-icon-lg"><UserIcon /></span><div className="grow"><div className="h3">{name}</div><div className="text-sm muted" data-testid="account-email">{email}</div><div className="row" style={{ marginTop: 4 }} data-testid="account-role">{(role === 'admin' ? ['Eltern', 'Admin'] : ['Free']).map((r) => <Badge key={r} tone={r === 'Admin' ? 'primary' : r === 'Eltern' ? 'good' : 'neutral'}>{r}</Badge>)}</div></div></div>
          {role === 'admin' && (<><Input label="Name ändern" autoComplete="off" value={newName} onChange={(e) => setNewName(e.target.value)} /><Button block variant="secondary" disabled={busy || !newName.trim()} onClick={changeName}>Name speichern</Button></>)}
          <Input label="Neue E-Mail" type="email" autoComplete="off" hint="Du bekommst einen Bestätigungslink an die neue Adresse." value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          <Button block variant="secondary" disabled={busy || !newEmail.includes('@')} onClick={changeEmail}>E-Mail ändern</Button>
          <Button block variant="ghost" data-testid="logout" onClick={() => supabase.auth.signOut()}>Abmelden</Button>
        </div>
      </Modal>
    </>
  );
}
