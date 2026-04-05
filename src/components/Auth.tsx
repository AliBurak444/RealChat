import { useState } from 'react';
import { auth, googleProvider } from '../lib/firebase';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail 
} from 'firebase/auth';
import { LogIn, Mail, Lock, UserPlus, Github, Hash } from 'lucide-react';
import { motion } from 'motion/react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleGoogleSignIn = async () => {
    if (!auth) {
      setError("Firebase yapılandırması eksik! Lütfen yönetici ile iletişime geçin.");
      return;
    }
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Google Sign-In Error:", err);
      if (err.code === 'auth/unauthorized-domain') {
        setError(`Bu alan adı (domain) Firebase'de yetkilendirilmemiş. Lütfen Firebase Console > Authentication > Settings > Authorized Domains kısmına şu URL'yi ekleyin: ${window.location.hostname}`);
      } else {
        setError(`Giriş hatası: ${err.message} (${err.code})`);
      }
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) {
      setError("Firebase yapılandırması eksik! Lütfen yönetici ile iletişime geçin.");
      return;
    }
    setError('');
    setMessage('');
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        setMessage('Hesabınız başarıyla oluşturuldu!');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      setError('Şifre sıfırlama için e-posta adresi giriniz.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('Şifre sıfırlama e-postası gönderildi.');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-zinc-950 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-grid-white pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-transparent to-zinc-950 pointer-events-none" />
      <div className="absolute top-1/4 -left-24 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 -right-24 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse" />

      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md p-10 rounded-[3rem] bg-zinc-950/40 backdrop-blur-2xl border border-white/5 shadow-2xl relative z-10 overflow-hidden"
      >
        {/* Card Glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-600/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-600/10 rounded-full blur-[80px] pointer-events-none" />

        <div className="text-center mb-10 relative z-10">
          <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-900/40 rotate-6 transition-transform hover:rotate-0">
            <Hash className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-black tracking-tighter text-white mb-3">RealChat</h1>
          <p className="text-zinc-500 font-black uppercase tracking-[0.4em] text-[10px]">Modern & Profesyonel</p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-4 mb-6 text-xs font-bold text-red-400 bg-red-900/20 border border-red-900/30 rounded-2xl flex items-center gap-3"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
            {error}
          </motion.div>
        )}
        
        {message && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-4 mb-6 text-xs font-bold text-green-400 bg-green-900/20 border border-green-900/30 rounded-2xl flex items-center gap-3"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            {message}
          </motion.div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">E-posta</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="email"
                placeholder="ornek@mail.com"
                className="w-full pl-12 pr-4 py-4 bg-zinc-950/50 border border-zinc-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm placeholder:text-zinc-700"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Şifre</label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="password"
                placeholder="••••••••"
                className="w-full pl-12 pr-4 py-4 bg-zinc-950/50 border border-zinc-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm placeholder:text-zinc-700"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all flex items-center justify-center gap-4 shadow-xl shadow-blue-900/20 active:scale-[0.98] relative z-10"
          >
            {isLogin ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            {isLogin ? 'Giriş Yap' : 'Kayıt Ol'}
          </button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-black"><span className="bg-zinc-950/40 backdrop-blur-md px-4 text-zinc-700">Veya</span></div>
        </div>

        <button
          onClick={handleGoogleSignIn}
          className="w-full py-4 bg-white hover:bg-zinc-100 text-zinc-950 font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all flex items-center justify-center gap-4 shadow-xl active:scale-[0.98] relative z-10"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
          Google ile Devam Et
        </button>

        <div className="mt-10 flex flex-col items-center gap-4 relative z-10">
          <button onClick={() => setIsLogin(!isLogin)} className="text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:text-blue-400 transition-colors">
            {isLogin ? 'Hesabın yok mu? Kayıt ol' : 'Zaten hesabın var mı? Giriş yap'}
          </button>
          {isLogin && (
            <button onClick={handlePasswordReset} className="text-[10px] font-black uppercase tracking-widest text-zinc-800 hover:text-zinc-500 transition-colors">
              Şifremi unuttum
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
