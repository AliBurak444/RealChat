import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PhoneOff, Mic, MicOff, Loader2 } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { AudioStreamer, AudioPlayer, AudioMixer } from '../lib/audioUtils';
import { WebRTCManager } from '../lib/WebRTCManager';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomName: string;
  mode: string;
  roomId: string;
  userId: string;
  userName: string;
}

export default function CallModal({ isOpen, onClose, roomName, mode, roomId, userId, userName }: CallModalProps) {
  const [isConnecting, setIsConnecting] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [voice, setVoice] = useState<'Zephyr' | 'Puck' | 'Kore'>('Zephyr');
  const [error, setError] = useState<string | null>(null);
  const [isHostState, setIsHostState] = useState(false);
  const isHostRef = useRef(false);
  
  const sessionRef = useRef<any>(null);
  const streamerRef = useRef<AudioStreamer | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const rtcManagerRef = useRef<WebRTCManager | null>(null);
  const mixerRef = useRef<AudioMixer | null>(null);
  const inputTranscriptionRef = useRef<string>('');
  const outputTranscriptionRef = useRef<string>('');
  const audioElementsRef = useRef<HTMLAudioElement[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      setError("API Anahtarı bulunamadı!");
      setIsConnecting(false);
      return;
    }

    const ai = new GoogleGenAI({ apiKey });
    playerRef.current = new AudioPlayer();
    mixerRef.current = new AudioMixer();

    const saveTranscription = async (text: string, sender: 'user' | 'ai') => {
      if (!text.trim()) return;
      try {
        await addDoc(collection(db, `rooms/${roomId}/messages`), {
          roomId,
          senderId: sender === 'user' ? userId : 'gemini-ai',
          senderName: sender === 'user' ? userName : 'RealChat AI',
          text: text.trim(),
          type: 'text',
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.error("Failed to save transcription:", err);
      }
    };

    const setupSession = async () => {
      try {
        const sessionDocRef = doc(db, `rooms/${roomId}/liveSession/session`);
        const sessionDoc = await getDoc(sessionDocRef);
        
        let hostStatus = false;
        if (!sessionDoc.exists() || sessionDoc.data().status === 'ended') {
          hostStatus = true;
          await setDoc(sessionDocRef, {
            hostId: userId,
            status: 'active',
            createdAt: serverTimestamp()
          });
        } else {
          hostStatus = sessionDoc.data().hostId === userId;
        }
        
        if (isMounted) {
          setIsHostState(hostStatus);
          isHostRef.current = hostStatus;
        }

        const rtcManager = new WebRTCManager(roomId, userId, hostStatus);
        rtcManagerRef.current = rtcManager;

        const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mixerRef.current!.addStream('local', localStream);
        rtcManager.addLocalStream(localStream);

        rtcManager.onTrack((stream, peerId) => {
          if (hostStatus) {
            mixerRef.current!.addStream(peerId, stream);
          }
          const audio = new Audio();
          audio.srcObject = stream;
          audio.play();
          audioElementsRef.current.push(audio);
        });

        await rtcManager.start();

        if (hostStatus) {
          const systemInstruction = mode === 'soft' 
            ? "Sen çok yumuşak, nazik ve anlayışlı bir asistansın. Sana ne söylenirse söylensin (küfür bile edilse) asla kızmazsın, hep alttan alır ve tatlı bir dille cevap verirsin."
            : mode === 'angry'
            ? "Sen çok sinirli, asabi ve tahammülsüz bir asistansın. Her şeye ters cevap verirsin, sürekli şikayet edersin."
            : "Sen yardımsever ve arkadaş canlısı bir asistansın.";

          const sessionPromise = ai.live.connect({
            model: "gemini-3.1-flash-live-preview",
            callbacks: {
              onopen: () => {
                if (!isMounted) return;
                setIsConnecting(false);
                
                const aiStream = playerRef.current!.getStream();
                if (aiStream) {
                  rtcManager.addLocalStream(aiStream);
                }

                streamerRef.current = new AudioStreamer((base64) => {
                  if (!isMuted) {
                    sessionPromise.then(session => {
                      session.sendRealtimeInput({
                        audio: { data: base64, mimeType: 'audio/pcm;rate=16000' }
                      });
                    });
                  }
                }, mixerRef.current!.getMixedStream());
                streamerRef.current.start();
              },
              onmessage: async (message: LiveServerMessage) => {
                const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                if (base64Audio && playerRef.current) {
                  playerRef.current.playBase64Pcm(base64Audio);
                }

                const textPart = message.serverContent?.modelTurn?.parts?.find(p => p.text)?.text;
                if (textPart) {
                  outputTranscriptionRef.current += textPart;
                }

                if (message.serverContent?.inputTranscription) {
                  const text = message.serverContent.inputTranscription.text || '';
                  inputTranscriptionRef.current += text;
                  if (message.serverContent.inputTranscription.finished) {
                    saveTranscription(inputTranscriptionRef.current, 'user');
                    inputTranscriptionRef.current = '';
                  }
                }

                if (message.serverContent?.outputTranscription) {
                  const text = message.serverContent.outputTranscription.text || '';
                  outputTranscriptionRef.current += text;
                  if (message.serverContent.outputTranscription.finished) {
                    saveTranscription(outputTranscriptionRef.current, 'ai');
                    outputTranscriptionRef.current = '';
                  }
                }

                if (message.serverContent?.turnComplete || message.serverContent?.interrupted) {
                  if (inputTranscriptionRef.current.trim()) {
                    saveTranscription(inputTranscriptionRef.current, 'user');
                    inputTranscriptionRef.current = '';
                  }
                  if (outputTranscriptionRef.current.trim()) {
                    saveTranscription(outputTranscriptionRef.current, 'ai');
                    outputTranscriptionRef.current = '';
                  }
                }
              },
              onerror: (err) => {
                console.error("Live API Error:", err);
                if (isMounted) setError("Bağlantı hatası oluştu.");
              },
              onclose: () => {
                if (inputTranscriptionRef.current.trim()) {
                  saveTranscription(inputTranscriptionRef.current, 'user');
                  inputTranscriptionRef.current = '';
                }
                if (outputTranscriptionRef.current.trim()) {
                  saveTranscription(outputTranscriptionRef.current, 'ai');
                  outputTranscriptionRef.current = '';
                }
                if (isMounted) onClose();
              }
            },
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
              },
              systemInstruction,
              inputAudioTranscription: {},
              outputAudioTranscription: {},
            },
          });
          
          sessionRef.current = await sessionPromise;
        } else {
          // Guest mode
          if (isMounted) setIsConnecting(false);
          
          // Listen for host ending session
          const unsubSession = onSnapshot(sessionDocRef, (doc) => {
            if (!doc.exists() || doc.data().status === 'ended') {
              if (isMounted) onClose();
            }
          });
          
          // Store unsub to cleanup
          (rtcManager as any)._unsubSession = unsubSession;
        }
      } catch (err) {
        console.error("Connection error:", err);
        if (isMounted) {
          setError("Bağlantı kurulamadı.");
          setIsConnecting(false);
        }
      }
    };

    setupSession();

    return () => {
      isMounted = false;
      if (streamerRef.current) streamerRef.current.stop();
      if (playerRef.current) playerRef.current.stop();
      if (sessionRef.current) sessionRef.current.close();
      if (rtcManagerRef.current) {
        if ((rtcManagerRef.current as any)._unsubSession) {
          (rtcManagerRef.current as any)._unsubSession();
        }
        rtcManagerRef.current.stop();
      }
      if (mixerRef.current) mixerRef.current.stop();
      audioElementsRef.current.forEach(a => {
        a.pause();
        a.srcObject = null;
      });
      
      // If host leaves, end session
      if (isHostRef.current) {
        setDoc(doc(db, `rooms/${roomId}/liveSession/session`), { status: 'ended' }, { merge: true });
      }
    };
  }, [isOpen, mode, onClose, roomId, userId, userName, isMuted, voice]);

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="w-full max-w-md bg-zinc-900/80 border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl flex flex-col items-center p-8 relative"
        >
          {/* Pulsing background effect */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`w-64 h-64 rounded-full blur-3xl transition-all duration-1000 ${isConnecting ? 'bg-blue-500/20 animate-pulse' : 'bg-green-500/20'}`} />
          </div>

          <div className="relative z-10 flex flex-col items-center w-full">
            <h2 className="text-xl font-black text-white tracking-tight mb-2">{roomName}</h2>
            {isHostState && (
              <div className="flex items-center gap-4 mb-8">
                <select 
                  value={voice} 
                  onChange={(e) => setVoice(e.target.value as any)}
                  className="bg-zinc-800 text-white text-xs rounded-lg px-3 py-1.5 border border-white/10"
                >
                  <option value="Zephyr">Zephyr</option>
                  <option value="Puck">Puck</option>
                  <option value="Kore">Kore</option>
                </select>
              </div>
            )}
            <p className="text-sm text-zinc-400 font-medium mb-12">
              {isConnecting ? 'Bağlanıyor...' : error ? 'Hata' : isHostState ? 'Gemini Live ile Görüşme (Kurucu)' : 'Gemini Live ile Görüşme (Katılımcı)'}
            </p>

            <div className="relative mb-16">
              <div className="w-32 h-32 rounded-full bg-zinc-800 border-4 border-zinc-700 flex items-center justify-center shadow-2xl relative z-10">
                {isConnecting ? (
                  <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                ) : error ? (
                  <PhoneOff className="w-12 h-12 text-red-500" />
                ) : (
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
                    <div className="w-16 h-16 bg-white/20 rounded-full animate-ping" />
                  </div>
                )}
              </div>
              {!isConnecting && !error && (
                <>
                  <div className="absolute inset-0 rounded-full border-2 border-green-500/30 animate-ping" style={{ animationDuration: '2s' }} />
                  <div className="absolute inset-[-20px] rounded-full border-2 border-green-500/20 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
                </>
              )}
            </div>

            {error && (
              <p className="text-red-400 text-sm font-medium mb-8 text-center">{error}</p>
            )}

            <div className="flex items-center gap-6">
              <button 
                onClick={toggleMute}
                disabled={isConnecting || !!error}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${
                  isMuted 
                    ? 'bg-zinc-800 text-red-500 hover:bg-zinc-700' 
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>
              
              <button 
                onClick={onClose}
                className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center text-white transition-all shadow-xl shadow-red-900/40 hover:scale-105 active:scale-95"
              >
                <PhoneOff className="w-7 h-7" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
