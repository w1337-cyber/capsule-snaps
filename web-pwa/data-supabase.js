// Supabase data layer: anonymous sign-in, Postgres tables with row-level security, private storage bucket.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';
const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('missing-config');
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'capsule-auth' } });

let uid = null;
const nameCache = {};
const urlCache = {};
const t = (s) => new Date(s).getTime();
const must = ({ data, error }) => { if (error) throw error; return data; };

export async function init() {
  let { data: { session } } = await sb.auth.getSession();
  if (!session) session = must(await sb.auth.signInAnonymously()).session;
  uid = session.user.id;
  return uid;
}

export async function getMyName() {
  const row = must(await sb.from('profiles').select('name').eq('id', uid).maybeSingle());
  if (row) nameCache[uid] = row.name;
  return row ? row.name : null;
}

export async function setMyName(name) {
  must(await sb.from('profiles').upsert({ id: uid, name }));
  nameCache[uid] = name;
}

export async function names(ids) {
  const need = [...new Set(ids)].filter((i) => i && !nameCache[i]);
  if (need.length) {
    try {
      const rows = must(await sb.from('profiles').select('id,name').in('id', need));
      rows.forEach((r) => (nameCache[r.id] = r.name));
    } catch { /* fine */ }
    need.forEach((i) => (nameCache[i] ||= 'Friend'));
  }
  return { ...nameCache };
}

/* A tiny "live query": fetch now, refetch on realtime changes, and poll as a safety net. */
function live(fetcher, cb, { table, filter, every = 15000 } = {}) {
  let alive = true, busy = false, again = false, last = null;
  const run = async () => {
    if (!alive) return;
    if (busy) { again = true; return; }
    busy = true;
    try {
      const d = await fetcher();
      const sig = JSON.stringify(d);
      if (alive && sig !== last) { last = sig; cb(d); } // only notify when something actually changed
    } catch (e) { console.warn(e); }
    busy = false;
    if (again) { again = false; run(); }
  };
  run();
  const poll = setInterval(run, every);
  const onVis = () => { if (!document.hidden) run(); };
  document.addEventListener('visibilitychange', onVis);
  let ch = null;
  if (table) {
    ch = sb.channel(`${table}:${filter || 'all'}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, run)
      .subscribe();
  }
  return () => { alive = false; clearInterval(poll); document.removeEventListener('visibilitychange', onVis); if (ch) sb.removeChannel(ch); };
}

export function onGroups(cb, onErr) {
  let failed = false;
  return live(async () => {
    try {
      const rows = must(await sb.from('groups').select('id,name,emoji,unlock_at,code,created_by,created_at,members(user_id)'));
      return rows.map((g) => ({
        id: g.id, name: g.name, emoji: g.emoji, unlockAt: t(g.unlock_at), code: g.code,
        createdBy: g.created_by, createdAt: t(g.created_at), members: (g.members || []).map((m) => m.user_id),
      }));
    } catch (e) { if (!failed) { failed = true; onErr && onErr(e); } throw e; }
  }, cb, { table: 'members' });
}

export async function createGroup(name, emoji, unlockAt) {
  return must(await sb.rpc('create_group', { p_name: name, p_emoji: emoji, p_unlock: new Date(unlockAt).toISOString() }));
}

export async function joinByCode(code) {
  const { data, error } = await sb.rpc('join_group', { p_code: code });
  if (error) throw new Error(/not-found/.test(error.message) ? 'not-found' : error.message);
  return data;
}

export function onSnaps(gid, cb) {
  return live(async () => must(await sb.from('snaps').select('id,by,kind,path,caption,created_at').eq('group_id', gid).order('created_at'))
    .map((x) => ({ id: x.id, type: 'snap', by: x.by, kind: x.kind, path: x.path, caption: x.caption, at: t(x.created_at) })),
  cb, { table: 'snaps', filter: `group_id=eq.${gid}` });
}

export function onMsgs(gid, cb) {
  return live(async () => must(await sb.from('msgs').select('id,by,text,created_at').eq('group_id', gid).order('created_at'))
    .map((x) => ({ id: x.id, type: 'msg', by: x.by, text: x.text, at: t(x.created_at) })),
  cb, { table: 'msgs', filter: `group_id=eq.${gid}`, every: 8000 });
}

export async function sendMsg(gid, text) {
  must(await sb.from('msgs').insert({ group_id: gid, text }));
}

// Idempotent: the same `id` can be retried safely (after a dropped connection or an app restart).
// Errors that retrying can't fix carry err.permanent = true.
export async function sendSnap(gid, blob, kind, caption, onProgress, id = crypto.randomUUID()) {
  const type = (blob.type || (kind === 'video' ? 'video/mp4' : 'image/jpeg')).split(';')[0];
  const ext = type.includes('quicktime') ? 'mov' : (type.split('/')[1] || 'bin').replace('jpeg', 'jpg');
  const path = `${gid}/${uid}/${id}.${ext}`;
  onProgress && onProgress(0.05);
  const { error } = await sb.storage.from('snaps').upload(path, blob, { contentType: type, upsert: false, cacheControl: '31536000' });
  if (error) {
    const msg = String(error.message || '');
    const status = Number(error.statusCode || error.status || 0);
    const already = status === 409 || /already exists|duplicate/i.test(msg);
    if (!already) {
      if (/row-level security|policy|unauthorized/i.test(msg) || status === 403) {
        let room = true;
        try { room = must(await sb.rpc('storage_has_room')); } catch { /* ignore */ }
        const e = new Error(room ? 'this group has already opened, or you’re no longer in it' : 'capsule storage is full');
        e.permanent = true; throw e;
      }
      if (status === 413 || /too large|exceeded the maximum/i.test(msg)) { const e = new Error('file is too big'); e.permanent = true; throw e; }
      throw error; // network hiccup etc. — will be retried
    }
  }
  onProgress && onProgress(0.9);
  const { error: e2 } = await sb.from('snaps').insert({ id, group_id: gid, kind, path, caption });
  if (e2 && e2.code !== '23505') { // 23505 = already saved on an earlier try
    if (e2.code === '42501') { const e = new Error('this group has already opened'); e.permanent = true; throw e; }
    throw e2;
  }
}

// Signed links are kept for a week (memory + localStorage), so the same link is reused and the
// phone's cache serves repeat views instead of downloading the file again.
const URL_TTL = 7 * 24 * 3600;
export async function mediaUrl(snap) {
  const key = 'capsule:url:' + snap.path;
  let hit = urlCache[snap.path];
  if (!hit) { try { hit = JSON.parse(localStorage.getItem(key) || 'null'); } catch { hit = null; } }
  if (hit && hit.exp > Date.now() + 3600e3) { urlCache[snap.path] = hit; return hit.url; }
  const d = must(await sb.storage.from('snaps').createSignedUrl(snap.path, URL_TTL));
  hit = { url: d.signedUrl, exp: Date.now() + URL_TTL * 1000 };
  urlCache[snap.path] = hit;
  try { localStorage.setItem(key, JSON.stringify(hit)); } catch { /* storage full or private mode */ }
  return d.signedUrl;
}

export async function storageUsed() {
  return must(await sb.rpc('storage_used_bytes'));
}

let errCount = 0;
export async function logError(where, message, version) {
  if (!uid || errCount++ > 20) return; // never spam
  try { await sb.from('client_errors').insert({ user_id: uid, where_: String(where).slice(0, 80), message: String(message).slice(0, 1000), ua: navigator.userAgent.slice(0, 300), app_version: version }); } catch { /* ignore */ }
}
