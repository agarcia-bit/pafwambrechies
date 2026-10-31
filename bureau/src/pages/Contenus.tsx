import { useMemo, useRef, useState } from 'react';

import type { PageProps } from '../App';
import { COLLECTIONS, withConfig, type Collection, type Field, type Row, type Values } from '../collections';
import { Drawer } from '../Drawer';
import { Empty, Icon, Skeleton } from '../Icon';
import { loadTenantConfig, supabase, toast, uploadPhoto, useAsync } from '../lib';

/** Une page par type de contenu (actus, offres, annuaire, liens) : liste, recherche, création, modification, suppression. */
export function Contenus({ kind, profile }: PageProps & { kind: keyof typeof COLLECTIONS }) {
  const config = useAsync(loadTenantConfig, []);
  const c = useMemo(() => (config.data ? withConfig(COLLECTIONS[kind], config.data) : COLLECTIONS[kind]), [kind, config.data]);
  const rows = useAsync(async () => {
    let q = supabase.from(c.key).select('*');
    for (const o of c.order) q = q.order(o.column, { ascending: o.ascending, nullsFirst: o.nullsFirst });
    const { data, error } = await q;
    if (error) throw error;
    return data as Row[];
  }, [c.key]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<number | 'new' | null>(null);

  if ((rows.loading && !rows.data) || config.loading) return <div className="card"><Skeleton lines={6} /></div>;
  if (rows.error) return <p className="error">{rows.error}</p>;
  const all = rows.data!;
  const needle = q.trim().toLowerCase();
  const list = needle ? all.filter((r) => Object.values(r).some((v) => typeof v === 'string' && v.toLowerCase().includes(needle))) : all;
  const current = open === 'new' ? null : open === null ? undefined : all.find((r) => r.id === open) ?? undefined;
  const moduleOff = kind !== 'actus' && config.data && !config.data.modules[kind];

  return (
    <>
      {moduleOff && <p className="note small">Cette section est désactivée dans l’application : les adhérents ne la voient pas. Un administrateur peut la réactiver dans les réglages.</p>}
      <div className="toolbar">
        <div className="search"><Icon name="search" size={16} /><input type="search" placeholder="Rechercher" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <span className="muted small">{list.length} élément{list.length > 1 ? 's' : ''}</span>
        <button className="push primary" onClick={() => setOpen('new')}><Icon name="plus" size={16} /> {c.addLabel}</button>
      </div>
      {!list.length ? (
        <Empty icon="inbox" title={needle ? 'Rien ne correspond' : c.empty} hint={needle ? 'Essayez un autre mot.' : undefined} action={!needle ? <button className="primary" onClick={() => setOpen('new')}><Icon name="plus" size={15} /> {c.addLabel}</button> : undefined} />
      ) : (
        <div className="card flush">
          <ul className="items">
            {list.map((r) => {
              const d = c.describe(r);
              return (
                <li key={r.id} className="item" onClick={() => setOpen(r.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(r.id)}>
                  {c.photo && (d.image ? <img className="thumb" src={d.image} alt="" /> : <span className="thumb empty"><Icon name="file" size={18} /></span>)}
                  <div className="grow">
                    <strong>{d.title}</strong>
                    <div className="muted small">{d.subtitle}</div>
                  </div>
                  {d.flag && <span className={'pill ' + (d.flagTone ?? 'neutral')}>{d.flag}</span>}
                  <Icon name="right" size={16} />
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {open !== null && current !== undefined && (
        <ItemDrawer c={c} row={current} tenant={profile.tenant_id} onClose={() => setOpen(null)} onChanged={rows.reload} />
      )}
    </>
  );
}

function ItemDrawer({ c, row, tenant, onClose, onChanged }: { c: Collection; row: Row | null; tenant: string; onClose: () => void; onChanged: () => void }) {
  const [v, setV] = useState<Values>(() => ({ ...c.defaults(), ...(row ? c.toValues(row) : {}) }));
  const [busy, setBusy] = useState(false);
  const set = (k: string, val: string) => setV((s) => ({ ...s, [k]: val }));

  async function save() {
    const missing = c.fields.find((f) => f.required && !v[f.key]?.trim());
    if (missing) return toast(`Le champ « ${missing.label} » est obligatoire.`, 'error');
    setBusy(true);
    const payload = c.toPayload(v);
    const res = row
      ? await supabase.from(c.key).update(payload).eq('id', row.id).select('id')
      : await supabase.from(c.key).insert({ ...payload, tenant_id: tenant }).select('id');
    setBusy(false);
    if (res.error) return toast(res.error.message, 'error');
    if (!res.data?.length) return toast('Modification refusée : réservée au bureau et aux administrateurs.', 'error');
    toast(row ? 'Modifications enregistrées' : 'Publié');
    onChanged();
    onClose();
  }
  async function remove() {
    if (!row || !confirm(`Supprimer « ${c.describe(row).title} » ?`)) return;
    setBusy(true);
    const { error } = await supabase.from(c.key).delete().eq('id', row.id);
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast('Supprimé');
    onChanged();
    onClose();
  }

  // Les champs « demi-largeur » consécutifs se partagent une ligne.
  const groups: Field[][] = [];
  for (const f of c.fields) {
    const last = groups[groups.length - 1];
    if (f.half && last && last[0].half && last.length < 2) last.push(f); else groups.push([f]);
  }

  return (
    <Drawer title={row ? c.describe(row).title || c.title : c.newTitle} subtitle={!row ? c.createHint : undefined} onClose={onClose}
      footer={<>{row && <button className="link danger" onClick={remove} disabled={busy}>Supprimer</button>}<span className="grow" /><button onClick={onClose} disabled={busy}>Annuler</button><button className="primary" onClick={save} disabled={busy}>{busy ? 'Enregistrement…' : row ? 'Enregistrer' : c.addLabel}</button></>}>
      <div className="form">
        {groups.map((g) => (
          <div key={g[0].key} className={g.length > 1 ? 'form-row' : undefined}>
            {g.map((f) => <FieldInput key={f.key} f={f} value={v[f.key] ?? ''} onChange={(val) => set(f.key, val)} photo={c.photo} autoFocus={f === c.fields[0] && !row} />)}
          </div>
        ))}
      </div>
    </Drawer>
  );
}

function FieldInput({ f, value, onChange, photo, autoFocus }: { f: Field; value: string; onChange: (v: string) => void; photo?: Collection['photo']; autoFocus?: boolean }) {
  const file = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  if (f.type === 'photo') {
    async function pick(e: React.ChangeEvent<HTMLInputElement>) {
      const chosen = e.target.files?.[0];
      if (!chosen || !photo) return;
      setUploading(true);
      try { onChange(await uploadPhoto(chosen, photo.bucket, photo.width, photo.crop)); toast('Photo ajoutée'); } catch (err) { toast((err as Error).message, 'error'); } finally { setUploading(false); if (file.current) file.current.value = ''; }
    }
    return (
      <div className="photo-field">
        <span className="lbl">{f.label}</span>
        <div className="row" style={{ marginTop: 6 }}>
          {value ? <img src={value} alt="" className="photo-preview" /> : <span className="photo-preview empty"><Icon name="file" size={20} /></span>}
          <input ref={file} type="file" accept="image/*" hidden onChange={pick} />
          <button type="button" onClick={() => file.current?.click()} disabled={uploading}><Icon name="upload" size={15} /> {uploading ? 'Envoi…' : value ? 'Changer' : 'Choisir une photo'}</button>
          {value && <button type="button" className="link danger" onClick={() => onChange('')}>Retirer</button>}
        </div>
      </div>
    );
  }
  if (f.type === 'choice') return (
    <label>{f.label}<select value={value} onChange={(e) => onChange(e.target.value)}>{(f.options ?? []).map((o) => <option key={o} value={o}>{f.labels?.[o] ?? o}</option>)}</select></label>
  );
  if (f.type === 'multiline') return <label>{f.label}<textarea className="plain-text" rows={6} value={value} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder} /></label>;
  const type = f.type === 'phone' ? 'tel' : f.type === 'url' ? 'text' : f.type;
  return <label>{f.label}{f.required && <span className="req"> *</span>}<input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder} autoFocus={autoFocus} /></label>;
}
