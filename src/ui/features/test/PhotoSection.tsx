import { useRef } from 'react';
import type { Photo, PhotoKind } from '../../../domain/types';
import { Badge, Button, CameraIcon, Card } from '../../ds';

export const SECTIONS: { kind: PhotoKind; title: string; hint: string }[] = [
  { kind: 'vocab', title: 'Vokabelseiten', hint: 'Alle Seiten mit den Vokabeln für diesen Test, eine Seite pro Foto.' },
  { kind: 'test', title: 'Beispieltest', hint: 'Ein alter Test oder eine Übungsseite, damit die Übungen so aussehen wie der echte Test.' },
];

/** One photo kind: thumbnails with state, camera/gallery inputs, "N Fotos auswerten". */
export function PhotoSection({ kind, title, hint, photos, urls, busy, extracting, onFiles, onRemove, onExtract }: { kind: PhotoKind; title: string; hint: string; photos: Photo[]; urls: Record<string, string>; busy: number; extracting: string | null; onFiles: (f: FileList | null) => void; onRemove: (p: Photo) => void; onExtract: () => void }) {
  const open = photos.filter((p) => p.status !== 'extracted').length;
  const cam = useRef<HTMLInputElement>(null);
  const pick = useRef<HTMLInputElement>(null);
  return (
    <Card title={`${title}${photos.length ? ` (${photos.length})` : ''}`}>
      <div className="stack-sm">
        {photos.length === 0 && busy === 0 && <p className="text-sm muted">{hint}</p>}
        {(photos.length > 0 || busy > 0) && (
          <div className="thumbs" data-testid={`thumbs-${kind}`}>
            {photos.map((p) => (
              <div key={p.id} className="thumb">
                {urls[p.id] && <img src={urls[p.id]} alt="" />}
                <span className="thumb-state">{extracting === p.id ? <Badge tone="primary">liest…</Badge> : p.status === 'extracted' ? <Badge tone="good">✓</Badge> : p.status === 'failed' ? <Badge tone="bad">Fehler</Badge> : null}</span>
                <button className="thumb-x" data-testid="thumb-delete" aria-label="Foto löschen" onClick={() => onRemove(p)}>×</button>
              </div>
            ))}
            {Array.from({ length: busy }, (_, i) => <div key={`b${i}`} className="thumb thumb-busy">lädt…</div>)}
          </div>
        )}
        <div className="row">
          <Button block variant={open ? 'secondary' : 'primary'} onClick={() => cam.current?.click()} disabled={busy > 0 || !!extracting}><CameraIcon /> Foto</Button>
          <Button block variant="secondary" onClick={() => pick.current?.click()} disabled={busy > 0 || !!extracting}>Galerie</Button>
        </div>
        {open > 0 && <Button block data-testid={`extract-${kind}`} onClick={onExtract} disabled={busy > 0 || !!extracting}>{extracting ? 'Wird gelesen…' : open === 1 ? '1 Foto auswerten' : `${open} Fotos auswerten`}</Button>}
        <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
        <input ref={pick} type="file" accept="image/*" multiple hidden data-testid={`pick-${kind}`} onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
      </div>
    </Card>
  );
}
