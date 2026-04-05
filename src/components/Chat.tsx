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
  getDoc
} from 'firebase/firestore';
import Sidebar from './Sidebar';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import { ModelType, generateResponse, generateImage } from '../lib/gemini';
import { Zap, Brain, LogOut, Menu, X, Plus, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChatProps {
  user: User;
  profile: UserProfile;
}

export default function Chat({ user, profile }: ChatProps) {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [modelType, setModelType] = useState<ModelType>('flash');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleDeleteAccount = async () => {
    if (!auth.currentUser) return;
    
    try {
      // 1. Delete Firestore user document
      await deleteDoc(doc(db, 'users', auth.currentUser.uid));
      
      // 2. Delete Auth user
      await deleteUser(auth.currentUser);
      
      setIsDeleteAccountModalOpen(false);
    } catch (error: any) {
      console.error('Hesap silme hatası:', error);
      if (error.code === 'auth/requires-recent-login') {
        alert('Bu işlem için yakın zamanda giriş yapmış olmanız gerekiyor. Lütfen çıkış yapıp tekrar girin.');
      } else {
        alert('Hesap silinirken bir hata oluştu: ' + error.message);
      }
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAllUsers(snapshot.docs.map(doc => doc.data() as UserProfile));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    const q = query(collection(db, 'rooms'), where('members', 'array-contains', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const roomsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatRoom));
      setRooms(roomsData);
      
      if (activeRoom) {
        const updatedActiveRoom = roomsData.find(r => r.id === activeRoom.id);
        if (updatedActiveRoom) {
          setActiveRoom(updatedActiveRoom);
        }
      } else if (roomsData.length > 0) {
        setActiveRoom(roomsData[0]);
      }
    });
    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    if (!activeRoom) return;
    const q = query(
      collection(db, `rooms/${activeRoom.id}/messages`),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)));
    });
    return () => unsubscribe();
  }, [activeRoom]);

  const handleSendMessage = async (text: string) => {
    if (!activeRoom) return;

    const messageData = {
      roomId: activeRoom.id,
      senderId: user.uid,
      senderName: profile.displayName,
      text,
      type: 'text',
      createdAt: serverTimestamp(),
    };

    await addDoc(collection(db, `rooms/${activeRoom.id}/messages`), messageData);

    // AI Response logic - Respond to every message unless it's from AI
    if (user.uid !== 'gemini-ai') {
      setIsTyping(true);
      const history = messages.slice(-10).map(m => ({
        role: m.senderId === user.uid ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));

      try {
        const aiResponse = await generateResponse(text, modelType, profile.displayName, history);
        
        await addDoc(collection(db, `rooms/${activeRoom.id}/messages`), {
          roomId: activeRoom.id,
          senderId: 'gemini-ai',
          senderName: 'RealChat AI',
          text: aiResponse,
          type: 'text',
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        console.error("AI Error:", error);
      } finally {
        setIsTyping(false);
      }
    }

    // Image generation logic
    if (text.startsWith('/imagine ')) {
      const prompt = text.replace('/imagine ', '');
      try {
        const imageUrl = await generateImage(prompt);
        if (imageUrl) {
          await addDoc(collection(db, `rooms/${activeRoom.id}/messages`), {
            roomId: activeRoom.id,
            senderId: 'gemini-ai',
            senderName: 'RealChat AI',
            text: `İşte istediğin görsel patron: ${prompt}`,
            type: 'image',
            imageUrl,
            createdAt: serverTimestamp(),
          });
        }
      } catch (error) {
        console.error("Image Gen Error:", error);
      }
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar Overlay for Mobile */}
      {!isSidebarOpen && (
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="fixed top-4 left-4 z-50 p-2 bg-zinc-800 rounded-lg lg:hidden"
        >
          <Menu className="w-6 h-6" />
        </button>
      )}

      <div className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-40 w-72 bg-zinc-900 border-r border-zinc-800 transition-transform lg:relative lg:translate-x-0`}>
        <Sidebar 
          rooms={rooms} 
          activeRoom={activeRoom} 
          setActiveRoom={setActiveRoom} 
          user={user}
          onClose={() => setIsSidebarOpen(false)}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0 bg-zinc-950 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-grid-white pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-transparent to-zinc-950 pointer-events-none" />
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.15, 0.1] 
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600 rounded-full blur-[120px] pointer-events-none" 
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.3, 1],
            opacity: [0.1, 0.2, 0.1] 
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute -bottom-24 -right-24 w-96 h-96 bg-purple-600 rounded-full blur-[120px] pointer-events-none" 
        />

        {/* Header */}
        <header className="h-24 border-b border-white/5 flex items-center justify-between px-8 bg-zinc-950/40 backdrop-blur-2xl sticky top-0 z-30 shadow-2xl">
          <div className="flex items-center gap-6">
            <div className="lg:hidden">
              {!isSidebarOpen && (
                <button 
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-2.5 bg-zinc-800/40 hover:bg-zinc-700/60 rounded-xl transition-all border border-white/5 shadow-lg"
                >
                  <Menu className="w-6 h-6 text-white" />
                </button>
              )}
            </div>
            <div className="flex flex-col">
              <h2 className="font-black text-xl text-white tracking-tight truncate max-w-[200px] lg:max-w-md">
                {activeRoom?.name || 'Oda Seçin'}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
                <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">Aktif</span>
                {activeRoom && (
                  <>
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

            <div className="flex bg-zinc-950/50 backdrop-blur-md p-1 rounded-xl border border-white/5">
              <button 
                onClick={() => setModelType('flash')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${modelType === 'flash' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Hızlı
              </button>
              <button 
                onClick={() => setModelType('thinking')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${modelType === 'thinking' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Derin
              </button>
            </div>
            
            <button 
              onClick={() => setIsDeleteAccountModalOpen(true)}
              className="p-2.5 bg-zinc-800/40 hover:bg-red-900/20 text-zinc-600 hover:text-red-400 rounded-xl transition-all border border-white/5 group shadow-lg"
              title="Hesabı Sil"
            >
              <Trash2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>

            <button 
              onClick={() => auth.signOut()}
              className="p-2.5 bg-zinc-800/40 hover:bg-red-900/20 text-zinc-600 hover:text-red-400 rounded-xl transition-all border border-white/5 group shadow-lg"
              title="Çıkış Yap"
            >
              <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </header>

        {/* Messages or Welcome Screen */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide flex flex-col">
          {activeRoom ? (
            <>
              <MessageList messages={messages} currentUser={user} />
              {isTyping && (
                <div className="flex items-center gap-2 text-xs text-zinc-500 animate-pulse">
                  <Brain className="w-4 h-4" />
                  <span>RealChat düşünüyor...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 relative z-10">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-32 h-32 bg-blue-600/20 rounded-[3rem] flex items-center justify-center border border-blue-500/20 shadow-2xl shadow-blue-900/20"
              >
                <Zap className="w-16 h-16 text-blue-500 animate-pulse" />
              </motion.div>
              <div className="space-y-3">
                <h2 className="text-4xl font-black text-white tracking-tighter">Hoş Geldin Patron!</h2>
                <p className="text-zinc-500 max-w-md mx-auto font-medium">
                  Sistem aktif ve emirlerini bekliyor. Sohbet etmeye başlamak için soldan bir oda seç veya yeni bir tane oluştur.
                </p>
              </div>
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all shadow-xl shadow-blue-900/20 active:scale-95"
              >
                Odaları Göster
              </button>
            </div>
          )}
        </main>

        {/* Input */}
        <footer className="p-8 bg-zinc-950/40 backdrop-blur-2xl border-t border-white/5 relative z-30">
          <MessageInput onSendMessage={handleSendMessage} />
        </footer>
      </div>

      {/* Add Member Modal */}
      <AnimatePresence>
        {isAddMemberModalOpen && activeRoom && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-zinc-900/60 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl relative z-10"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between bg-zinc-900/40">
                <h2 className="text-2xl font-black text-white tracking-tight">Kişi Ekle</h2>
                <button onClick={() => {
                  setIsAddMemberModalOpen(false);
                  setUserSearchQuery('');
                }} className="p-2.5 bg-zinc-800/40 hover:bg-zinc-700/60 text-zinc-500 hover:text-white rounded-xl transition-all border border-white/5">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">Kişi Ara</label>
                  <input
                    type="text"
                    placeholder="İsim veya e-posta ile ara..."
                    className="w-full px-4 py-4 bg-zinc-950/50 border border-white/5 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-zinc-700"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                  />
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
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
                          onClick={async () => {
                            try {
                              await updateDoc(doc(db, 'rooms', activeRoom.id), {
                                members: arrayUnion(u.uid)
                              });
                            } catch (err) {
                              console.error("Add member error:", err);
                            }
                          }}
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
    </div>
  );
}
