import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, type Auth } from 'firebase/auth';
// @ts-ignore: exported by firebase/auth's React Native build, missing from the web typings
import { getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const isConfigured = !!firebaseConfig.apiKey && !!firebaseConfig.projectId;

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let auth: Auth;
try {
  auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
} catch {
  auth = getAuth(app); // already initialized (fast refresh)
}

export { app, auth };
export const db = getFirestore(app);
export const storage = getStorage(app);
