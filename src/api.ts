import { signInAnonymously, onAuthStateChanged, type User } from 'firebase/auth';
import {
  doc, getDoc, setDoc, addDoc, collection, query, where, onSnapshot, orderBy, limit,
  writeBatch, updateDoc, arrayUnion, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { auth, db, storage } from './firebase';

export type Group = {
  id: string;
  name: string;
  emoji: string;
  unlockAt: number; // ms
  createdBy: string;
  members: string[];
  code: string;
};

export type Snap = {
  id: string;
  by: string;
  kind: 'image' | 'video';
  path: string;
  caption: string;
  at: number; // ms
};

export type Media = { uri: string; kind: 'image' | 'video'; mimeType?: string };

export type Msg = { id: string; by: string; text: string; at: number };

/* ---------- auth & names ---------- */

export function waitForUser(): Promise<User> {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      unsub();
      if (u) return resolve(u);
      try { resolve((await signInAnonymously(auth)).user); } catch (e) { reject(e); }
    });
  });
}

const nameCache: Record<string, string> = {};

export async function getMyName(uid: string): Promise<string | null> {
  const local = await AsyncStorage.getItem('capsule:name');
  if (local) { nameCache[uid] = local; return local; }
  const s = await getDoc(doc(db, 'users', uid));
  const n = (s.exists() && (s.data().name as string)) || null;
  if (n) { nameCache[uid] = n; await AsyncStorage.setItem('capsule:name', n); }
  return n;
}

export async function saveMyName(uid: string, name: string) {
  await setDoc(doc(db, 'users', uid), { name });
  nameCache[uid] = name;
  await AsyncStorage.setItem('capsule:name', name);
}

export async function namesFor(uids: string[]): Promise<Record<string, string>> {
  const missing = [...new Set(uids)].filter((u) => u && !nameCache[u]);
  await Promise.all(missing.map(async (u) => {
    try {
      const s = await getDoc(doc(db, 'users', u));
      nameCache[u] = (s.exists() && (s.data().name as string)) || 'Someone';
    } catch { nameCache[u] = 'Someone'; }
  }));
  return { ...nameCache };
}

/* ---------- groups ---------- */

function toGroup(id: string, d: any): Group {
  return {
    id,
    name: d.name,
    emoji: d.emoji || '📸',
    unlockAt: (d.unlockAt as Timestamp)?.toMillis?.() ?? 0,
    createdBy: d.createdBy,
    members: d.members || [],
    code: d.code || '',
  };
}

export function subscribeMyGroups(uid: string, cb: (g: Group[]) => void, onErr: (e: Error) => void) {
  const q = query(collection(db, 'groups'), where('members', 'array-contains', uid));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => toGroup(d.id, d.data()));
    list.sort((a, b) => a.unlockAt - b.unlockAt);
    cb(list);
    list.forEach(scheduleUnlockNotification);
  }, onErr);
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() {
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

export async function createGroup(uid: string, name: string, emoji: string, unlockAt: Date): Promise<Group> {
  let code = newCode();
  for (let i = 0; i < 5; i++) {
    const exists = await getDoc(doc(db, 'invites', code));
    if (!exists.exists()) break;
    code = newCode();
  }
  const gref = doc(collection(db, 'groups'));
  const batch = writeBatch(db);
  batch.set(gref, {
    name, emoji, code,
    unlockAt: Timestamp.fromDate(unlockAt),
    createdBy: uid,
    members: [uid],
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, 'invites', code), { groupId: gref.id, createdBy: uid });
  await batch.commit();
  return { id: gref.id, name, emoji, code, unlockAt: unlockAt.getTime(), createdBy: uid, members: [uid] };
}

export async function joinByCode(uid: string, raw: string): Promise<string> {
  const code = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const inv = await getDoc(doc(db, 'invites', code));
  if (!inv.exists()) throw new Error('No capsule found with that code.');
  const gid = inv.data().groupId as string;
  // Already a member? Then reading works and we're done.
  try {
    const g = await getDoc(doc(db, 'groups', gid));
    if (g.exists()) return gid;
  } catch { /* not a member yet */ }
  await updateDoc(doc(db, 'groups', gid), { members: arrayUnion(uid) });
  return gid;
}

/* ---------- snaps ---------- */

export function subscribeSnaps(gid: string, cb: (s: Snap[]) => void, onErr: (e: Error) => void) {
  const q = query(collection(db, 'groups', gid, 'snaps'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id, by: x.by, kind: x.kind, path: x.path, caption: x.caption || '',
        at: (x.createdAt as Timestamp)?.toMillis?.() ?? Date.now(),
      };
    }));
  }, onErr);
}

export async function sendSnap(
  uid: string, gid: string, media: Media, caption: string, onProgress?: (p: number) => void,
) {
  const sref = doc(collection(db, 'groups', gid, 'snaps'));
  const contentType = media.mimeType || (media.kind === 'video' ? 'video/mp4' : 'image/jpeg');
  const ext = contentType.includes('quicktime') ? 'mov' : contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'bin';
  const path = `groups/${gid}/${uid}_${sref.id}.${ext}`;

  const blob: Blob = await (await fetch(media.uri)).blob();
  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, path), blob, { contentType });
    task.on('state_changed',
      (s) => onProgress?.(s.totalBytes ? s.bytesTransferred / s.totalBytes : 0),
      reject,
      () => resolve());
  });
  await setDoc(sref, { by: uid, kind: media.kind, path, caption, createdAt: serverTimestamp() });
}

/* ---------- chat messages (visible right away; only snaps are sealed) ---------- */

function toMsg(id: string, x: any): Msg {
  return { id, by: x.by, text: x.text, at: (x.createdAt as Timestamp)?.toMillis?.() ?? Date.now() };
}

export function subscribeMsgs(gid: string, cb: (m: Msg[]) => void, onErr: (e: Error) => void) {
  const q = query(collection(db, 'groups', gid, 'msgs'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (s) => cb(s.docs.map((d) => toMsg(d.id, d.data()))), onErr);
}

export function subscribeLastMsg(gid: string, cb: (m: Msg | null) => void) {
  const q = query(collection(db, 'groups', gid, 'msgs'), orderBy('createdAt', 'desc'), limit(1));
  return onSnapshot(q, (s) => cb(s.docs[0] ? toMsg(s.docs[0].id, s.docs[0].data()) : null), () => cb(null));
}

export async function sendMsg(uid: string, gid: string, text: string) {
  await addDoc(collection(db, 'groups', gid, 'msgs'), { by: uid, text, createdAt: serverTimestamp() });
}

const urlCache: Record<string, string> = {};
export async function mediaUrl(path: string) {
  if (!urlCache[path]) urlCache[path] = await getDownloadURL(ref(storage, path));
  return urlCache[path];
}

/* ---------- unlock notification (local, no server needed) ---------- */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
  }),
});

export async function askNotificationPermission() {
  try {
    const cur = await Notifications.getPermissionsAsync();
    if (!cur.granted) await Notifications.requestPermissionsAsync();
  } catch { /* fine */ }
}

async function scheduleUnlockNotification(g: Group) {
  if (g.unlockAt <= Date.now()) return;
  const key = `capsule:notif:${g.id}:${g.unlockAt}`;
  try {
    if (await AsyncStorage.getItem(key)) return;
    await Notifications.scheduleNotificationAsync({
      content: { title: `${g.emoji} ${g.name} is open!`, body: 'Your capsule just unlocked. Go look back at it together.' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(g.unlockAt) },
    });
    await AsyncStorage.setItem(key, '1');
  } catch { /* notifications are a bonus */ }
}
