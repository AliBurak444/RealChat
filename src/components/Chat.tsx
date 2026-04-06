import { useState, useEffect, useRef } from 'react';
import type { User } from 'firebase/auth';
import { UserProfile, ChatRoom, Message } from '../types';
import { db, auth } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  doc,
  updateDoc,
  arrayUnion,
  increment,
  getDoc,
  getDocFromServer
} from 'firebase/firestore';
import Sidebar from './Sidebar';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import CallModal from './CallModal';
import { ModelType, ChatMode, generateResponse, generateImage, generateMusic } from '../lib/gemini';
import { Zap, Brain, LogOut, Menu, X, Plus, User as UserIcon, Phone, Users, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Persona, getPersona, updatePersona } from '../services/PersonaManager';
import SettingsModal from './SettingsModal';

const MESSAGE_LIMIT = 100;

interface ChatProps {
  user: User;
  profile: UserProfile;
}

export default function Chat({ user, profile }: ChatProps) {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [modelType, setModelType] = useState<ModelType>('flash');
  const [mode, setMode] = useState<ChatMode>('good');
  const [persona, setPersona] = useState<Persona>('joyful');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = async (text: string) => {
    if (!activeRoom) return;
    
    try {
      await addDoc(collection(db, `rooms/${activeRoom.id}/messages`), {
        roomId: activeRoom.id,
        senderId: user.uid,
        senderName: profile.displayName,
        text,
        type: 'text',
        createdAt: serverTimestamp(),
      });

      setIsTyping(true);

      const aiResponse = await generateResponse(
        text,
        modelType,
        profile.displayName,
        mode,
        persona,
        messages.map(m => ({ role: m.senderId === user.uid ? 'user' : 'model', parts: [{ text: m.text }] })),
        activeRoom.aiRole
      );

      await addDoc(collection(db, `rooms/${activeRoom.id}/messages`), {
        roomId: activeRoom.id,
        senderId: 'gemini-ai',
        senderName: 'RealChat AI',
        text: aiResponse,
        type: 'text',
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Send message error:", error);
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();
  }, []);

  const handleFileUpload = async (file: File) => {
    if (!activeRoom) return;
    setIsTyping(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        const aiResponse = await generateResponse(
          file.type.startsWith('image/') ? 'Bu görseli analiz et.' : 'Bu belgenin özetini çıkar.',
          modelType,
          profile.displayName,
          mode,
          persona,
          [],
          activeRoom.aiRole
        );
        await addDoc(collection(db, `rooms/${activeRoom.id}/messages`), {
          roomId: activeRoom.id,
          senderId: 'gemini-ai',
          senderName: 'RealChat AI',
          text: aiResponse,
          type: 'text',
          createdAt: serverTimestamp(),
        });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("File analysis error:", error);
    } finally {
      setIsTyping(false);
    }
  };

  const summarizeGroupChat = async () => {
    if (!activeRoom) return;
    setIsTyping(true);
    const chatSummary = await generateResponse(
      "Ben yokken neler konuşuldu, özet geç.",
      modelType,
      profile.displayName,
      mode,
      persona,
      messages.map(m => ({ role: m.senderId === user.uid ? 'user' : 'model', parts: [{ text: m.text }] })),
      activeRoom.aiRole
    );
    await addDoc(collection(db, `rooms/${activeRoom.id}/messages`), {
      roomId: activeRoom.id,
      senderId: 'gemini-ai',
      senderName: 'RealChat AI',
      text: chatSummary,
      type: 'text',
      createdAt: serverTimestamp(),
    });
    setIsTyping(false);
  };

  const handleAddMember = async (userId: string) => {
    if (!activeRoom) return;
    try {
      await addDoc(collection(db, 'invitations'), {
        roomId: activeRoom.id,
        roomName: activeRoom.name,
        senderId: user.uid,
        receiverId: userId,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setIsAddMemberModalOpen(false);
      setUserSearchQuery('');
    } catch (error) {
      console.error("Add member error:", error);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!activeRoom) return;
    try {
      await updateDoc(doc(db, 'rooms', activeRoom.id), {
        members: activeRoom.members.filter(id => id !== userId)
      });
    } catch (error) {
      console.error("Remove member error:", error);
    }
  };

  useEffect(() => {
    const q = query(
      collection(db, 'rooms'),
      where('members', 'array-contains', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const roomsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatRoom));
      setRooms(roomsData);
    });
    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => doc.data() as UserProfile);
      setAllUsers(users);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!activeRoom) return;
    const q = query(
      collection(db, `rooms/${activeRoom.id}/messages`),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs.slice(-MESSAGE_LIMIT));
    });
    return () => unsubscribe();
  }, [activeRoom]);

  useEffect(() => {
    const loadPersona = async () => {
      const p = await getPersona(user.uid);
      setPersona(p);
    };
    loadPersona();
  }, [user.uid]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-blue-500/30">
      <Sidebar 
        user={user} 
        activeRoom={activeRoom} 
        setActiveRoom={setActiveRoom} 
        rooms={rooms}
      />
      
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Header */}
        <header className="h-24 border-b border-white/5 flex items-center justify-between px-8 bg-zinc-950/50 backdrop-blur-2xl z-50">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 hover:bg-zinc-800 rounded-xl transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-black tracking-tight text-white">
                  {activeRoom?.name || 'Oda Seçin'}
                </h2>
                {activeRoom?.aiRole && (
                  <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-500 text-[10px] rounded-full font-bold uppercase tracking-wider border border-yellow-500/30">
                    Rol: {activeRoom.aiRole}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
                <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">Aktif</span>
                {activeRoom && (
                  <>
                    <span className="text-zinc-800">•</span>
                    <button 
                      onClick={() => setIsMembersModalOpen(true)}
                      className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-full transition-all border border-blue-500/20"
                    >
                      <Users className="w-3 h-3" />
                      <span className="text-[10px] font-bold">{activeRoom.members.length}</span>
                    </button>
                    <span className="text-zinc-800">•</span>
                    <button 
                      onClick={() => setIsAddMemberModalOpen(true)}
                      className="text-[10px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-[0.2em] transition-all hover:scale-105"
                    >
                      Kişi Ekle
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-zinc-950/40 backdrop-blur-md rounded-2xl border border-white/5 shadow-inner">
              {modelType === 'flash' ? (
                <><Zap className="w-4 h-4 text-blue-500 fill-blue-500/20" /> <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Hızlı Mod</span></>
              ) : (
                <><Brain className="w-4 h-4 text-purple-500 fill-purple-500/20" /> <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Derin Mod</span></>
              )}
            </div>

            <button 
              onClick={() => setIsSettingsModalOpen(true)}
              className="p-2 bg-zinc-950/50 backdrop-blur-md rounded-xl border border-white/5 text-zinc-500 hover:text-white"
            >
              <Settings className="w-5 h-5" />
            </button>
            
            {activeRoom && (
              <button 
                onClick={() => setIsCallModalOpen(true)}
                className="p-2.5 bg-zinc-800/40 hover:bg-green-900/20 text-zinc-600 hover:text-green-400 rounded-xl transition-all border border-white/5 group shadow-lg"
                title="Sesli Arama"
              >
                <Phone className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </button>
            )}

            <button 
              onClick={() => auth.signOut()}
              className="p-2.5 bg-zinc-800/40 hover:bg-red-900/20 text-zinc-600 hover:text-red-400 rounded-xl transition-all border border-white/5 group shadow-lg"
              title="Çıkış Yap"
            >
              <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>
          </div>

          <SettingsModal 
            isOpen={isSettingsModalOpen}
            onClose={() => setIsSettingsModalOpen(false)}
            persona={persona}
            setPersona={setPersona}
            userId={user.uid}
            isTranslating={isTranslating}
            setIsTranslating={setIsTranslating}
            mode={mode}
            setMode={setMode}
            isPermanentMemoryEnabled={activeRoom?.isPermanentMemoryEnabled || false}
            setIsPermanentMemoryEnabled={(p) => setActiveRoom(r => r ? {...r, isPermanentMemoryEnabled: p} : null)}
            modelType={modelType}
            setModelType={setModelType}
            roomId={activeRoom?.id}
          />
        </header>

        {/* Messages or Welcome Screen */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide flex flex-col">
          {activeRoom ? (
            <>
              <MessageList messages={messages} currentUser={user} profile={profile} />
              {isTyping && (
                <div className="flex items-center gap-2 text-xs text-zinc-500 animate-pulse">
                  <Brain className="w-4 h-4" />
                  <span>RealChat düşünüyor...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
              <div className="w-24 h-24 bg-zinc-900/50 rounded-[2.5rem] flex items-center justify-center mb-8 border border-white/5 shadow-2xl">
                <Brain className="w-12 h-12 text-blue-500 animate-pulse" />
              </div>
              <h1 className="text-4xl font-black text-white mb-4 tracking-tighter">RealChat AI</h1>
              <p className="text-zinc-500 max-w-sm font-medium leading-relaxed">
                Hoş geldin patron. Başlamak için soldan bir oda seç veya yeni bir tane oluştur.
              </p>
            </div>
          )}
        </main>

        {activeRoom && (
          <MessageInput 
            onSendMessage={handleSendMessage}
          />
        )}
      </div>

      {/* Members Modal */}
      <AnimatePresence>
        {isMembersModalOpen && activeRoom && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-white/5 bg-zinc-950/50">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xl font-black text-white tracking-tight">Oda Üyeleri</h3>
                  <button onClick={() => setIsMembersModalOpen(false)} className="p-2 hover:bg-zinc-800 rounded-xl transition-colors">
                    <X className="w-5 h-5 text-zinc-500" />
                  </button>
                </div>
                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{activeRoom.members.length} Üye</p>
              </div>
              
              <div className="p-4 max-h-[400px] overflow-y-auto scrollbar-hide">
                {allUsers.filter(u => activeRoom.members.includes(u.uid)).map(u => (
                  <div key={u.uid} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-zinc-800/40 transition-all group border border-transparent hover:border-white/5">
                    <div className="w-12 h-12 rounded-xl bg-zinc-950/50 border border-white/5 flex items-center justify-center overflow-hidden shadow-inner">
                      {u.photoURL ? <img src={u.photoURL} className="w-full h-full object-cover" /> : <UserIcon className="w-6 h-6 text-zinc-700" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-white truncate">{u.displayName}</p>
                      <p className="text-[10px] text-zinc-600 truncate font-mono">{u.email}</p>
                    </div>
                    {u.uid === activeRoom.createdBy ? (
                      <span className="px-2 py-1 bg-blue-500/10 text-blue-500 text-[8px] font-black uppercase rounded-lg border border-blue-500/20">Kurucu</span>
                    ) : (
                      (user.uid === activeRoom.createdBy || user.uid === u.uid) && (
                        <button 
                          onClick={() => handleRemoveMember(u.uid)}
                          className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[8px] font-black uppercase rounded-lg border border-red-500/20 transition-colors"
                        >
                          {user.uid === u.uid ? 'Ayrıl' : 'Çıkar'}
                        </button>
                      )
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Member Modal */}
      <AnimatePresence>
        {isAddMemberModalOpen && activeRoom && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-white/5 bg-zinc-950/50">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-black text-white tracking-tight">Kişi Ekle</h3>
                  <button onClick={() => setIsAddMemberModalOpen(false)} className="p-2 hover:bg-zinc-800 rounded-xl transition-colors">
                    <X className="w-5 h-5 text-zinc-500" />
                  </button>
                </div>
                
                <div className="relative">
                  <input
                    type="text"
                    placeholder="İsim veya e-posta ile ara..."
                    className="w-full px-4 py-4 bg-zinc-950/50 border border-white/5 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-zinc-700"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                  />
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2 pr-2 scrollbar-hide mt-4">
                  {allUsers
                    .filter(u => !activeRoom.members.includes(u.uid))
                    .filter(u => 
                      u.displayName.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
                      u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
                    )
                    .length === 0 ? (
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700 text-center py-12 italic">
                      {userSearchQuery ? 'Sonuç bulunamadı patron.' : 'Eklenecek yeni kimse yok patron.'}
                    </p>
                  ) : (
                    allUsers
                      .filter(u => !activeRoom.members.includes(u.uid))
                      .filter(u => 
                        u.displayName.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
                        u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
                      )
                      .map((u) => (
                        <button
                          key={u.uid}
                          onClick={() => handleAddMember(u.uid)}
                          className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-zinc-800/40 transition-all group border border-transparent hover:border-white/5 shadow-sm"
                        >
                          <div className="w-12 h-12 rounded-xl bg-zinc-950/50 border border-white/5 flex items-center justify-center overflow-hidden shadow-inner">
                            {u.photoURL ? <img src={u.photoURL} className="w-full h-full object-cover" /> : <UserIcon className="w-6 h-6 text-zinc-700" />}
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <p className="text-sm font-black text-white truncate">{u.displayName}</p>
                            <p className="text-[10px] text-zinc-600 truncate font-mono">{u.email}</p>
                          </div>
                          <div className="w-10 h-10 bg-zinc-950/50 group-hover:bg-blue-600 rounded-xl flex items-center justify-center transition-all border border-white/5 group-hover:border-blue-500 shadow-lg">
                            <Plus className="w-5 h-5 text-zinc-700 group-hover:text-white transition-colors" />
                          </div>
                        </button>
                      ))
                  )}
                </div>
              </div>

              <div className="p-8 bg-zinc-900/40 border-t border-white/5">
                <button 
                  onClick={() => {
                    setIsAddMemberModalOpen(false);
                    setUserSearchQuery('');
                  }}
                  className="w-full py-4 bg-zinc-800/60 hover:bg-zinc-700/80 text-zinc-300 font-black uppercase tracking-widest text-xs rounded-2xl transition-all border border-white/5 shadow-xl active:scale-[0.98]"
                >
                  Kapat
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <CallModal 
        isOpen={isCallModalOpen} 
        onClose={() => setIsCallModalOpen(false)} 
        roomName={activeRoom?.name || ''} 
        mode={mode} 
        roomId={activeRoom?.id || ''}
        userId={user.uid}
        userName={profile.displayName}
      />
    </div>
  );
}
