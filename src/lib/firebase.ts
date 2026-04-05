import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '@/firebase-applet-config.json';

// Firebase yapılandırmasını güvenli bir şekilde başlatıyoruz
let app;
try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  console.error("Firebase başlatılamadı! Yapılandırma dosyasını kontrol edin.", error);
  // Boş bir uygulama nesnesi oluşturarak diğer servislerin çökmesini engelliyoruz (ancak çalışmayacaklar)
  app = {} as any;
}

export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();
