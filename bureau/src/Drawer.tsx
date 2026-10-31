import { useEffect, type ReactNode } from 'react';

import { Icon } from './Icon';

export function Drawer({ title, subtitle, onClose, children, wide, footer }: { title: ReactNode; subtitle?: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', on);
    document.body.style.overflow = 'hidden';
    return () => { removeEventListener('keydown', on); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className={'drawer' + (wide ? ' wide' : '')} role="dialog" aria-modal="true">
        <div className="drawer-head">
          <div className="grow">
            <h2>{title}</h2>
            {subtitle && <div className="muted">{subtitle}</div>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer"><Icon name="x" /></button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </div>
    </>
  );
}
