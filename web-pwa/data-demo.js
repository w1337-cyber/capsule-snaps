// In-memory demo data (open the app with #demo). Nothing is saved; for previewing the UI only.
let uid = 'me';
const now = Date.now();
const day = 864e5;
const users = { me: 'William', a: 'Alex', f: 'Freddie', s: 'Sara' };
const groups = [
  { id: 'g1', name: 'The gang 2026', emoji: '🎆', unlockAt: new Date(new Date().getFullYear(), 11, 31, 23, 59).getTime(), createdBy: 'me', members: ['me', 'a', 'f', 's'], code: 'GANG26', createdAt: now - 300 * day },
  { id: 'g2', name: 'Ibiza trip', emoji: '🌴', unlockAt: now - day, createdBy: 'a', members: ['me', 'a'], code: 'IBZ777', createdAt: now - 90 * day },
  { id: 'g3', name: 'Basketlaget', emoji: '🔥', unlockAt: now + 40 * day, createdBy: 'f', members: ['me', 'f', 's'], code: 'BSK123', createdAt: now - 60 * day },
];
const svg = (bg, t) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1600"><rect width="100%" height="100%" fill="${bg}"/><text x="50%" y="50%" font-size="120" text-anchor="middle" fill="#fff" font-family="sans-serif">${t}</text></svg>`);
const snaps = {
  g1: Array.from({ length: 8 }, (_, i) => ({ id: 's' + i, type: 'snap', by: ['me', 'a', 'f', 's'][i % 4], kind: i % 3 ? 'image' : 'video', path: '', caption: i === 3 ? 'lol' : '', at: now - (8 - i) * 4 * day })),
  g2: [['#0ea5e9', '🌊'], ['#f97316', '🌅'], ['#16a34a', '🌴']].map(([c, e], i) => ({ id: 'z' + i, type: 'snap', by: i % 2 ? 'a' : 'me', kind: 'image', path: svg(c, e), caption: i === 1 ? 'best sunset ever' : '', at: now - (30 - i) * day })),
  g3: [],
};
const msgs = {
  g1: [{ id: 'm1', type: 'msg', by: 'a', text: 'bro don’t peek 😂', at: now - 2 * day }, { id: 'm2', type: 'msg', by: 'me', text: 'can’t even if I wanted to', at: now - 2 * day + 6e4 }],
  g2: [], g3: [{ id: 'm3', type: 'msg', by: 'f', text: 'träning imorgon?', at: now - 3 * 36e5 }],
};
const subs = { groups: new Set() };
const fire = (key, data) => (subs[key] || new Set()).forEach((cb) => cb(data));
const listen = (key, cb, data) => { (subs[key] ||= new Set()).add(cb); setTimeout(() => cb(data), 30); return () => subs[key].delete(cb); };

export async function init() { return uid; }
export async function getMyName() { return users[uid]; }
export async function setMyName(n) { users[uid] = n; }
export async function names() { return { ...users }; }
export function onGroups(cb) { return listen('groups', cb, groups.slice()); }
export async function createGroup(name, emoji, unlockAt) {
  const id = 'g' + Math.random().toString(36).slice(2, 7);
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  groups.push({ id, name, emoji, unlockAt, createdBy: uid, members: [uid], code, createdAt: Date.now() });
  snaps[id] = []; msgs[id] = [];
  fire('groups', groups.slice());
  return { id, code };
}
export async function joinByCode(code) { const g = groups.find((x) => x.code === code.toUpperCase()); if (!g) throw new Error('not-found'); return g.id; }
export function onSnaps(gid, cb) { return listen('s' + gid, cb, (snaps[gid] || []).slice()); }
export function onMsgs(gid, cb) { return listen('m' + gid, cb, (msgs[gid] || []).slice()); }
export async function sendMsg(gid, text) { msgs[gid].push({ id: 'm' + Date.now(), type: 'msg', by: uid, text, at: Date.now() }); fire('m' + gid, msgs[gid].slice()); }
export async function sendSnap(gid, blob, kind, caption, onProgress) {
  onProgress && onProgress(1);
  snaps[gid].push({ id: 's' + Date.now() + Math.random(), type: 'snap', by: uid, kind, path: URL.createObjectURL(blob), caption, at: Date.now() });
  fire('s' + gid, snaps[gid].slice());
}
export async function mediaUrl(s) { return s.path; }

export async function logError(where, message) { console.warn('[demo error]', where, message); }
