import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'chat' | 'camera' | 'memories' | 'search' | 'newchat' | 'back' | 'close' | 'send' | 'info'
  | 'text' | 'lock' | 'group' | 'key' | 'gallery' | 'video' | 'flip' | 'flash' | 'flashOff' | 'play' | 'check' | 'share';

export function Icon({ name, size = 24, color = '#000' }: { name: IconName; size?: number; color?: string }) {
  const p = { stroke: color, strokeWidth: 2.3, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const body = (() => {
    switch (name) {
      case 'chat': return <Path {...p} d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.1A8 8 0 1 1 20 12z" />;
      case 'camera': return <><Path {...p} d="M3 8.5A2.5 2.5 0 0 1 5.5 6h2l1.5-2h6l1.5 2h2A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" /><Circle {...p} cx={12} cy={12.5} r={3.6} /></>;
      case 'memories': return <><Rect {...p} x={4} y={5} width={16} height={15} rx={3} /><Path {...p} d="M8 3v4M16 3v4M4 10h16" /></>;
      case 'search': return <><Circle {...p} strokeWidth={2.7} cx={11} cy={11} r={7} /><Path {...p} strokeWidth={2.7} d="m20 20-3.5-3.5" /></>;
      case 'newchat': return <><Path {...p} d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.1A8 8 0 1 1 20 12z" /><Path {...p} d="M12 9v6M9 12h6" /></>;
      case 'back': return <Path {...p} strokeWidth={2.8} d="m15 5-7 7 7 7" />;
      case 'close': return <Path {...p} strokeWidth={2.8} d="M6 6l12 12M18 6 6 18" />;
      case 'send': return <Path fill={color} d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12 2-12 2z" />;
      case 'info': return <><Circle {...p} cx={12} cy={12} r={9} /><Path {...p} d="M12 11v6M12 7.5v.5" /></>;
      case 'text': return <Path {...p} strokeWidth={2.8} d="M5 6h14M12 6v13" />;
      case 'lock': return <><Rect {...p} strokeWidth={2.6} x={5} y={11} width={14} height={10} rx={2} /><Path {...p} strokeWidth={2.6} d="M8 11V7a4 4 0 0 1 8 0v4" /></>;
      case 'group': return <><Circle {...p} cx={9} cy={8} r={3.5} /><Path {...p} d="M2.5 20a6.5 6.5 0 0 1 13 0" /><Circle {...p} cx={17} cy={9} r={2.7} /><Path {...p} d="M16 14.2a5 5 0 0 1 5.5 5.8" /></>;
      case 'key': return <><Circle {...p} cx={8} cy={15} r={4} /><Path {...p} d="m11 12 9-9M17 6l3 3M15 8l2 2" /></>;
      case 'gallery': return <><Rect {...p} x={6} y={3} width={13} height={16} rx={2.5} /><Path {...p} d="M4 7v11a3 3 0 0 0 3 3h9" /></>;
      case 'video': return <><Rect {...p} x={2.5} y={6} width={13} height={12} rx={3} /><Path {...p} d="m15.5 10.5 6-3.5v10l-6-3.5z" /></>;
      case 'flip': return <><Path {...p} d="M4 9a8 8 0 0 1 14-3l2 2" /><Path {...p} d="M20 4v4h-4" /><Path {...p} d="M20 15a8 8 0 0 1-14 3l-2-2" /><Path {...p} d="M4 20v-4h4" /></>;
      case 'flash': return <Path {...p} fill={color} d="M13 2 4 14h7l-1 8 9-12h-7z" />;
      case 'flashOff': return <><Path {...p} d="M13 2 4 14h7l-1 8 9-12h-7z" /><Path {...p} d="M3 3l18 18" /></>;
      case 'play': return <Path fill={color} d="M7 4v16l13-8z" />;
      case 'check': return <Path {...p} strokeWidth={3.6} d="m5 12 5 5 9-10" />;
      case 'share': return <><Path {...p} d="M12 3v12M7 8l5-5 5 5" /><Path {...p} d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></>;
    }
  })();
  return <Svg width={size} height={size} viewBox="0 0 24 24">{body}</Svg>;
}
