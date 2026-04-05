import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '@/firebase-applet-config.json';

// Firebase yapılandırmasını güvenli bir şekilde başlatıyoruz
let app;
try {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
} catch (error) {
  console.error("Firebase başlatılamadı! Yapılandırma dosyasını kontrol edin.", error);
  // Uygulamanın çökmesini engellemek için null atıyoruz, App.tsx bunu kontrol edecek
  app = null;
}

export const auth = app ? getAuth(app) : null as any;
export const db = app ? getFirestore(app, firebaseConfig.firestoreDatabaseId) : null as any;
export const googleProvider = new GoogleAuthProvider();
