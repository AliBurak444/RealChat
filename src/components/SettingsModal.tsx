import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Settings } from 'lucide-react';
import { Persona, updatePersona } from '../services/PersonaManager';
import { ChatMode } from '../lib/gemini';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  persona: Persona;
  setPersona: (p: Persona) => void;
  userId: string;
  isTranslating: boolean;
  setIsTranslating: (t: boolean) => void;
  mode: ChatMode;
  setMode: (m: ChatMode) => void;
  isPermanentMemoryEnabled: boolean;
  setIsPermanentMemoryEnabled: (p: boolean) => void;
  modelType: 'flash' | 'thinking';
  setModelType: (m: 'flash' | 'thinking') => void;
  roomId?: string;
}

export default function SettingsModal({ isOpen, onClose, persona, setPersona, userId, isTranslating, setIsTranslating, mode, setMode, isPermanentMemoryEnabled, setIsPermanentMemoryEnabled, modelType, setModelType, roomId }: SettingsModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-lg bg-zinc-900 border border-white/10 rounded-3xl p-8 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Settings className="w-5 h-5" /> Ayarlar
            </h2>
            <button onClick={onClose} className="text-zinc-500 hover:text-white"><X className="w-6 h-6" /></button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-2 block">Persona</label>
              <div className="flex gap-2">
                {(['professional', 'joyful', 'critic'] as Persona[]).map(p => (
                  <button 
                    key={p}
                    onClick={async () => { setPersona(p); await updatePersona(userId, p); }}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase ${persona === p ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-2 block">Çeviri</label>
              <button 
                onClick={() => setIsTranslating(!isTranslating)}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase ${isTranslating ? 'bg-yellow-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}
              >
                {isTranslating ? 'Çeviri Açık' : 'Çeviri Kapalı'}
              </button>
            </div>
            
            <div>
              <label className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-2 block">Mod</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: 'normal', label: 'Normal' },
                  { id: 'soft', label: 'Yumuşak' },
                  { id: 'good', label: 'İyi' },
                  { id: 'angry', label: 'Kızgın' },
                  { id: 'brainstorm', label: 'Beyin Fırtınası' },
                  { id: 'game', label: 'Oyun' },
                  { id: 'debug', label: 'Hata Ayıklama' },
                  { id: 'trend', label: 'Trend' }
                ] as { id: ChatMode, label: string }[]).map(m => (
                  <button 
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase ${mode === m.id ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-2 block">Kalıcı Bilgi</label>
              <button 
                onClick={async () => {
                  const newValue = !isPermanentMemoryEnabled;
                  setIsPermanentMemoryEnabled(newValue);
                  if (roomId) {
                    try {
                      await updateDoc(doc(db, 'rooms', roomId), { isPermanentMemoryEnabled: newValue });
                    } catch (e) {
                      console.error("Failed to update permanent memory:", e);
                      setIsPermanentMemoryEnabled(!newValue); // Revert
                    }
                  }
                }}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase ${isPermanentMemoryEnabled ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}
              >
                {isPermanentMemoryEnabled ? 'Açık' : 'Kapalı'}
              </button>
            </div>

            <div>
              <label className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-2 block">Model</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => setModelType('flash')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase ${modelType === 'flash' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}
                >
                  Hızlı
                </button>
                <button 
                  onClick={() => setModelType('thinking')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase ${modelType === 'thinking' ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}
                >
                  Derin
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
