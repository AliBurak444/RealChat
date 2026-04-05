import { useState, useEffect } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import Auth from './components/Auth';
import Chat from './components/Chat';
import { UserProfile } from './types';
import { Loader2, X } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setUser(user);
        if (user) {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setProfile(userDoc.data() as UserProfile);
          } else {
            const newProfile: UserProfile = {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || 'Anonim',
              photoURL: user.photoURL || `https://ui-avatars.com/api/?name=${user.email}`,
              role: user.email === 'aliburakmumcuoglu31@gmail.com' ? 'admin' : 'user',
              createdAt: serverTimestamp(),
            };
            await setDoc(doc(db, 'users', user.uid), newProfile);
            setProfile(newProfile);
          }
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error("Auth state change error:", error);
      } finally {
        setLoading(false);
      }
    }, (error) => {
      console.error("Auth observer error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (!auth || !db) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 p-8 text-center">
        <div className="w-20 h-20 bg-red-900/20 rounded-3xl flex items-center justify-center mb-6 border border-red-500/20">
          <X className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-2xl font-black text-white mb-4">Yapılandırma Hatası</h1>
        <p className="text-zinc-500 max-w-md">
          Firebase yapılandırması yüklenemedi. Lütfen <code className="bg-zinc-900 px-2 py-1 rounded">firebase-applet-config.json</code> dosyasının doğru olduğundan ve GitHub'a yüklendiğinden emin olun.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-zinc-950 text-zinc-100 font-sans">
      {user && profile ? (
        <Chat user={user} profile={profile} />
      ) : (
        <Auth />
      )}
    </div>
  );
}
