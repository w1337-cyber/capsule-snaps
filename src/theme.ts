// Light, Snapchat-style chat UI with an orange accent. Camera, preview and viewer stay black.
export const C = {
  bg: '#ffffff',
  soft: '#f2f3f5',
  line: '#e7e8eb',
  text: '#16181d',
  muted: '#8a8d93',
  faint: '#b4b6bb',
  accent: '#ff6a13',
  accentSoft: '#fff4ec',
  accentDark: '#b84300',
  open: '#16a34a',
  openSoft: '#ecfdf3',
  chat: '#0ea5e9',
  danger: '#dc2626',
};

const PALETTE = ['#f23c57', '#0ea5e9', '#9b55e5', '#16a34a', '#ff6a13', '#e5367f', '#0f9d9a', '#4f46e5'];
export function colorOf(id: string) {
  let h = 0;
  for (const ch of id || 'x') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export const EMOJIS = ['🎆', '📸', '🌙', '🔥', '🌴', '🎉', '❄️', '🍾'];

export function timeLeft(ms: number) {
  let d = Math.max(0, ms - Date.now());
  const D = Math.floor(d / 864e5); d -= D * 864e5;
  const H = Math.floor(d / 36e5); d -= H * 36e5;
  const M = Math.floor(d / 6e4); d -= M * 6e4;
  return { D, H, M, S: Math.floor(d / 1e3) };
}
export function shortLeft(ms: number) {
  const l = timeLeft(ms);
  return l.D > 0 ? `${l.D}d` : l.H > 0 ? `${l.H}h` : l.M > 0 ? `${l.M}m` : `${l.S}s`;
}
export function longLeft(ms: number) {
  const l = timeLeft(ms);
  return l.D > 0 ? `${l.D}d ${l.H}h ${l.M}m` : `${l.H}h ${l.M}m ${l.S}s`;
}
export function ago(ms: number) {
  const d = (Date.now() - ms) / 1000;
  if (d < 60) return 'now';
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  if (d < 604800) return `${Math.floor(d / 86400)}d`;
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
export function fmtDate(ms: number) {
  return new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
export function fmtDay(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}
export function fmtShort(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
