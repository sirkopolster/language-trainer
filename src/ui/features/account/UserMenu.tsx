import { useEffect, useState } from 'react';
import { supabase } from '../../../storage/supabaseRepository';
import { Button, Input, Modal, UserIcon, useToast } from '../../ds';

/** Top-right account button: icon with the name below. Opens a sheet with name, e-mail, e-mail change and logout. */
export function UserMenu({ name }: { name: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [busy, setBusy] = useState(false);
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
        <span className="usermenu-name">{name}</span>
      </button>
      <Modal open={open} title="Dein Konto" onClose={() => setOpen(false)} actions={<Button variant="ghost" onClick={() => setOpen(false)}>Schließen</Button>}>
        <div className="stack-sm">
          <div className="row"><span className="usermenu-icon usermenu-icon-lg"><UserIcon /></span><div className="grow"><div className="h3">{name}</div><div className="text-sm muted" data-testid="account-email">{email}</div></div></div>
          <Input label="Neue E-Mail" type="email" autoComplete="off" hint="Du bekommst einen Bestätigungslink an die neue Adresse." value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          <Button block variant="secondary" disabled={busy || !newEmail.includes('@')} onClick={changeEmail}>E-Mail ändern</Button>
          <Button block variant="ghost" data-testid="logout" onClick={() => supabase.auth.signOut()}>Abmelden</Button>
        </div>
      </Modal>
    </>
  );
}
