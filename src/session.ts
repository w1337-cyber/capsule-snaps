import { createContext, useContext } from 'react';
import type { Group, Media } from './api';

export type RootStack = {
  Camera: { preselect?: string } | undefined;
  Preview: { media: Media[]; preselect?: string };
  SendTo: { media: Media[]; caption: string; preselect?: string };
  Chat: undefined;
  Memories: undefined;
  NewChat: undefined;
  NewGroup: undefined;
  Join: undefined;
  Thread: { id: string };
  Viewer: { groupId: string; start: number };
};

export type Session = {
  uid: string;
  name: string;
  groups: Group[];
  groupsLoaded: boolean;
  setName: (n: string) => void;
};

export const SessionCtx = createContext<Session>(null as unknown as Session);
export const useSession = () => useContext(SessionCtx);
