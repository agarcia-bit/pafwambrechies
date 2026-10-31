import { useEffect, useState } from 'react';

type T = { id: number; message: string; kind: 'ok' | 'error' };

export function Toasts() {
  const [list, setList] = useState<T[]>([]);
  useEffect(() => {
    let n = 0;
    const on = (e: Event) => {
      const id = ++n;
      const { message, kind } = (e as CustomEvent).detail;
      setList((l) => [...l, { id, message, kind }]);
      setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 4000);
    };
    addEventListener('toast', on);
    return () => removeEventListener('toast', on);
  }, []);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => <div key={t.id} className={'toast ' + t.kind}>{t.message}</div>)}
    </div>
  );
}
