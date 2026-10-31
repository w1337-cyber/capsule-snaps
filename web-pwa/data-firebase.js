// Firebase data layer. Same database + rules as the native app, so web and phone users share groups.
const V = '12.0.0';
const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
const { getAuth, signInAnonymously, onAuthStateChanged } = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`);
const fs = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`);
const st = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-storage.js`);

async function loadConfig() {
  // On Firebase Hosting the project config is served automatically.
  try {
    const r = await fetch('/__/firebase/init.json');
    if (r.ok) return await r.json();
  } catch { /* not on Firebase Hosting */ }
  const m = await import('./config.js');
  return m.firebaseConfig;
}

const config = await loadConfig();
if (!config || !config.apiKey) throw new Error('missing-config');

const app = initializeApp(config);
const auth = getAuth(app);
const db = fs.getFirestore(app);
const storage = st.getStorage(app);

let uid = null;
const nameCache = {};
const urlCache = {};
const ms = (t) => (t && t.toMillis ? t.toMillis() : Date.now());

export async function init() {
  uid = await new Promise((resolve, reject) => {
    const off = onAuthStateChanged(auth, async (u) => {
      off();
      if (u) return resolve(u.uid);
      try { resolve((await signInAnonymously(auth)).user.uid); } catch (e) { reject(e); }
    });
  });
  return uid;
}

export async function getMyName() {
  const s = await fs.getDoc(fs.doc(db, 'users', uid));
  const n = (s.exists() && s.data().name) || null;
  if (n) nameCache[uid] = n;
  return n;
}

export async function setMyName(name) {
  await fs.setDoc(fs.doc(db, 'users', uid), { name });
  nameCache[uid] = name;
}

export async function names(ids) {
  const need = [...new Set(ids)].filter((i) => i && !nameCache[i]);
  await Promise.all(need.map(async (i) => {
    try { const s = await fs.getDoc(fs.doc(db, 'users', i)); nameCache[i] = (s.exists() && s.data().name) || 'Friend'; }
    catch { nameCache[i] = 'Friend'; }
  }));
  return { ...nameCache };
}

export function onGroups(cb, onErr) {
  const q = fs.query(fs.collection(db, 'groups'), fs.where('members', 'array-contains', uid));
  return fs.onSnapshot(q, (s) => cb(s.docs.map((d) => {
    const x = d.data();
    return { id: d.id, name: x.name, emoji: x.emoji || '📸', unlockAt: ms(x.unlockAt), createdBy: x.createdBy, members: x.members || [], code: x.code || '', createdAt: ms(x.createdAt) };
  })), onErr);
}

const CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 6 }, () => CODE[Math.floor(Math.random() * CODE.length)]).join('');

export async function createGroup(name, emoji, unlockAt) {
  let code = newCode();
  for (let i = 0; i < 5; i++) {
    if (!(await fs.getDoc(fs.doc(db, 'invites', code))).exists()) break;
    code = newCode();
  }
  const ref = fs.doc(fs.collection(db, 'groups'));
  const b = fs.writeBatch(db);
  b.set(ref, { name, emoji, code, unlockAt: fs.Timestamp.fromMillis(unlockAt), createdBy: uid, members: [uid], createdAt: fs.serverTimestamp() });
  b.set(fs.doc(db, 'invites', code), { groupId: ref.id, createdBy: uid });
  await b.commit();
  return { id: ref.id, code };
}

export async function joinByCode(raw) {
  const code = String(raw).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const inv = await fs.getDoc(fs.doc(db, 'invites', code));
  if (!inv.exists()) throw new Error('not-found');
  const gid = inv.data().groupId;
  try { if ((await fs.getDoc(fs.doc(db, 'groups', gid))).exists()) return gid; } catch { /* not a member yet */ }
  await fs.updateDoc(fs.doc(db, 'groups', gid), { members: fs.arrayUnion(uid) });
  return gid;
}

export function onSnaps(gid, cb) {
  const q = fs.query(fs.collection(db, 'groups', gid, 'snaps'), fs.orderBy('createdAt', 'asc'));
  return fs.onSnapshot(q, (s) => cb(s.docs.map((d) => {
    const x = d.data();
    return { id: d.id, type: 'snap', by: x.by, kind: x.kind, path: x.path, caption: x.caption || '', at: ms(x.createdAt) };
  })), () => cb([]));
}

export function onMsgs(gid, cb) {
  const q = fs.query(fs.collection(db, 'groups', gid, 'msgs'), fs.orderBy('createdAt', 'asc'));
  return fs.onSnapshot(q, (s) => cb(s.docs.map((d) => {
    const x = d.data();
    return { id: d.id, type: 'msg', by: x.by, text: x.text, at: ms(x.createdAt) };
  })), () => cb([]));
}

export async function sendMsg(gid, text) {
  await fs.addDoc(fs.collection(db, 'groups', gid, 'msgs'), { by: uid, text, createdAt: fs.serverTimestamp() });
}

export async function sendSnap(gid, blob, kind, caption, onProgress) {
  const ref = fs.doc(fs.collection(db, 'groups', gid, 'snaps'));
  const contentType = (blob.type || (kind === 'video' ? 'video/mp4' : 'image/jpeg')).split(';')[0];
  const ext = contentType.includes('quicktime') ? 'mov' : (contentType.split('/')[1] || 'bin').replace('jpeg', 'jpg');
  const path = `groups/${gid}/${uid}_${ref.id}.${ext}`;
  await new Promise((resolve, reject) => {
    const task = st.uploadBytesResumable(st.ref(storage, path), blob, { contentType });
    task.on('state_changed', (s) => onProgress && onProgress(s.totalBytes ? s.bytesTransferred / s.totalBytes : 0), reject, resolve);
  });
  await fs.setDoc(ref, { by: uid, kind, path, caption, createdAt: fs.serverTimestamp() });
}

export async function mediaUrl(snap) {
  if (!urlCache[snap.path]) urlCache[snap.path] = await st.getDownloadURL(st.ref(storage, snap.path));
  return urlCache[snap.path];
}
