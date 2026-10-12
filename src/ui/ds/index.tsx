// SnapLearn design system — the only components screens may use. Styles live in ds.css, values in tokens.css.
import { createContext, useCallback, useContext, useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

/* ---------- Button ---------- */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({ variant = 'primary', block, small, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; block?: boolean; small?: boolean }) {
  return <button type="button" {...rest} className={cx('btn', `btn-${variant}`, block && 'btn-block', small && 'btn-sm', className)} />;
}

/* ---------- Input ---------- */
type FieldProps = { label?: string; hint?: string; error?: string };
export function Input({ label, hint, error, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & FieldProps) {
  return (
    <label className="field">
      {label && <span className="field-label">{label}</span>}
      <input {...rest} className={cx('input', error && 'input-error', className)} />
      {(error || hint) && <span className={cx('field-hint', error && 'field-hint-error')}>{error ?? hint}</span>}
    </label>
  );
}
export function Textarea({ label, hint, error, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps) {
  return (
    <label className="field">
      {label && <span className="field-label">{label}</span>}
      <textarea {...rest} className={cx('input', error && 'input-error', className)} />
      {(error || hint) && <span className={cx('field-hint', error && 'field-hint-error')}>{error ?? hint}</span>}
    </label>
  );
}

/* ---------- Card ---------- */
export function Card({ title, accent, flat, children, className }: { title?: string; accent?: boolean; flat?: boolean; children: ReactNode; className?: string }) {
  return (
    <section className={cx('card', accent && 'card-accent', flat && 'card-flat', className)}>
      {title && <h2 className="card-title">{title}</h2>}
      {children}
    </section>
  );
}

/* ---------- ListItem ---------- */
export function List({ children }: { children: ReactNode }) {
  return <div className="list">{children}</div>;
}
export function ListItem({ lead, title, sub, trail, onClick }: { lead?: ReactNode; title: ReactNode; sub?: ReactNode; trail?: ReactNode; onClick?: () => void }) {
  const body = (
    <>
      {lead !== undefined && <span className="item-lead">{lead}</span>}
      <span className="item-body">
        <span className="item-title">{title}</span>
        {sub && <span className="item-sub">{sub}</span>}
      </span>
      {(trail || onClick) && <span className="item-trail">{trail}{onClick && <Chevron />}</span>}
    </>
  );
  return onClick ? <button type="button" className="item item-tap" onClick={onClick}>{body}</button> : <div className="item">{body}</div>;
}

/* ---------- ProgressBar ---------- */
export function ProgressBar({ value, max = 100, tone, thin, label }: { value: number; max?: number; tone?: 'good' | 'accent'; thin?: boolean; label?: [string, string] }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div>
      <div className={cx('progress', tone && `progress-${tone}`, thin && 'progress-thin')} role="progressbar" aria-valuenow={value} aria-valuemax={max}>
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      {label && <div className="progress-label"><span>{label[0]}</span><span>{label[1]}</span></div>}
    </div>
  );
}

/* ---------- Badge ---------- */
export type BadgeTone = 'neutral' | 'primary' | 'good' | 'warn' | 'bad' | 'star' | 'crown';
export function Badge({ tone = 'neutral', large, children }: { tone?: BadgeTone; large?: boolean; children?: ReactNode }) {
  return (
    <span className={cx('badge', tone !== 'neutral' && `badge-${tone}`, large && 'badge-lg')}>
      {tone === 'star' && <StarIcon />}
      {tone === 'crown' && <CrownIcon />}
      {children}
    </span>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, title, onClose, children, actions }: { open: boolean; title?: string; onClose: () => void; children?: ReactNode; actions?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {title && <h2 className="modal-title">{title}</h2>}
        {children}
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}

/* ---------- Toast ---------- */
type Toast = { id: number; text: string; tone?: 'good' | 'bad' };
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((text: string, tone?: Toast['tone']) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toast-host" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={cx('toast', t.tone && `toast-${t.tone}`)}>{t.text}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- EmptyState ---------- */
export function EmptyState({ icon = '✨', title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      {text && <p className="text-sm">{text}</p>}
      {action}
    </div>
  );
}

/* ---------- Shell: AppBar + TabBar ---------- */
export function AppBar({ title, left, right }: { title: string; left?: ReactNode; right?: ReactNode }) {
  return <header className="appbar">{left}<h1 className="appbar-title">{title}</h1>{right}</header>;
}
export function TabBar({ tabs, active, onSelect }: { tabs: { id: string; label: string; icon: ReactNode }[]; active: string; onSelect: (id: string) => void }) {
  return (
    <nav className="tabbar">
      {tabs.map((t) => <button key={t.id} type="button" className={cx('tab', 'iconbtn', t.id === active && 'tab-active')} style={{ width: 'auto', height: 'auto' }} onClick={() => onSelect(t.id)}>{t.icon}<span>{t.label}</span></button>)}
    </nav>
  );
}

/* ---------- Icons (inline SVG, currentColor) ---------- */
const svg = (d: string, filled = false) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
export const StarIcon = () => svg('M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z', true);
export const CrownIcon = () => svg('M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z', true);
export const Chevron = () => svg('M9 6l6 6-6 6');
export const BackIcon = () => svg('M15 6l-6 6 6 6');
export const CameraIcon = () => svg('M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 100-7 3.5 3.5 0 000 7');
export const HomeIcon = () => svg('M3 11l9-8 9 8v10h-6v-6H9v6H3z');
export const BookIcon = () => svg('M4 4h7a3 3 0 013 3v13a2 2 0 00-2-2H4zM20 4h-7a3 3 0 00-3 3v13a2 2 0 012-2h8z');
export const TestIcon = () => svg('M9 4h6l1 2h3v14H5V6h3zM9 12l2 2 4-4');
export const UserIcon = () => svg('M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0');
export const FlameIcon = () => svg('M12 3c1 3 4 5 4 9a4 4 0 01-8 0c0-1 .5-2 1-3 0 2 1 3 2 3 0-3-1-5 1-9z', true);
