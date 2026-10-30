import { useEffect, type ReactNode } from 'react';

import { Icon } from './Icon';

export function Drawer({ title, subtitle, onClose, children, wide }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', on);
    return () => removeEventListener('keydown', on);
  }, [onClose]);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className={'drawer' + (wide ? ' wide' : '')} role="dialog" aria-label={title}>
        <div className="drawer-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <span className="muted">{subtitle}</span>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer"><Icon name="x" /></button>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </>
  );
}
