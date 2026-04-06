import { useState, useEffect } from 'react';
import { ChatRoom, UserProfile } from '../types';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, onSnapshot, deleteDoc, doc, writeBatch, getDocs, where, updateDoc, arrayUnion } from 'firebase/firestore';
import { Plus, Hash, User as UserIcon, X, Check, Users, Trash2, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarProps {
  rooms: ChatRoom[];
  activeRoom: ChatRoom | null;
  setActiveRoom: (room: ChatRoom) => void;
  user: any;
  onClose?: () => void;
}

export default function Sidebar({ rooms, activeRoom, setActiveRoom, user, onClose }: SidebarProps) {
  const [newRoomName, setNewRoomName] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [invitations, setInvitations] = useState<any[]>([]);
  const [isInvitesOpen, setIsInvitesOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs
        .map(doc => doc.data() as UserProfile)
        .filter(u => u.uid !== user.uid);
      setAllUsers(usersData);
    });
    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    const q = query(collection(db, 'invitations'), where('receiverId', '==', user.uid), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setInvitations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user.uid]);

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;

    try {
      const roomData = {
        name: newRoomName.trim(),
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        members: [user.uid],
        mode: 'good',
        messageCount: 0
      };
      const roomRef = await addDoc(collection(db, 'rooms'), roomData);
      
      if (selectedUsers.length > 0) {
        const batch = writeBatch(db);
        selectedUsers.forEach(uid => {
          const inviteRef = doc(collection(db, 'invitations'));
          batch.set(inviteRef, {
            roomId: roomRef.id,
            roomName: newRoomName.trim(),
            senderId: user.uid,
            receiverId: uid,
            status: 'pending',
            createdAt: serverTimestamp()
          });
        });
        await batch.commit();
      }

      setNewRoomName('');
      setSelectedUsers([]);
      setIsModalOpen(false);
    } catch (error) {
      console.error("Room creation error:", error);
    }
  };

  const handleDeleteRoom = (roomId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRoomToDelete(roomId);
  };

  const handleAcceptInvite = async (invite: any) => {
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'rooms', invite.roomId), {
        members: arrayUnion(user.uid)
      });
      batch.update(doc(db, 'invitations', invite.id), {
        status: 'accepted'
      });
      await batch.commit();
    } catch (error) {
      console.error("Accept invite error:", error);
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    try {
      await updateDoc(doc(db, 'invitations', inviteId), {
        status: 'declined'
      });
    } catch (error) {
      console.error("Decline invite error:", error);
    }
  };

  const toggleUserSelection = (uid: string) => {
    setSelectedUsers(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950/60 backdrop-blur-2xl border-r border-white/5 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-white pointer-events-none opacity-20" />
      <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-purple-500/5 pointer-events-none" />
      
      <div className="relative z-10 flex flex-col h-full">
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-zinc-900/40 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-xl shadow-blue-900/40 rotate-3 transition-transform hover:rotate-0">
              <Hash className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tighter text-white">RealChat</h1>
          </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-2.5 bg-zinc-800/40 hover:bg-zinc-700/60 text-zinc-400 hover:text-white rounded-xl transition-all border border-white/5 shadow-lg">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
        {invitations.length > 0 && (
          <div className="mb-6">
            <button 
              onClick={() => setIsInvitesOpen(!isInvitesOpen)}
              className="w-full flex items-center justify-between p-3 bg-blue-600/20 border border-blue-500/30 rounded-xl text-blue-400 hover:bg-blue-600/30 transition-all"
            >
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 animate-bounce" />
                <span className="text-xs font-bold uppercase tracking-widest">Gelen İstekler</span>
              </div>
              <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black">{invitations.length}</span>
            </button>
            
            <AnimatePresence>
              {isInvitesOpen && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mt-2 space-y-2"
                >
                  {invitations.map(invite => (
                    <div key={invite.id} className="p-3 bg-zinc-900/80 border border-white/5 rounded-xl flex flex-col gap-2">
                      <p className="text-xs text-zinc-300"><span className="font-bold text-white">{invite.roomName}</span> odasına davet edildin.</p>
                      <div className="flex gap-2">
                        <button onClick={() => handleAcceptInvite(invite)} className="flex-1 py-1.5 bg-green-600/20 hover:bg-green-600/40 text-green-400 text-[10px] font-black uppercase rounded-lg transition-all">Kabul Et</button>
                        <button onClick={() => handleDeclineInvite(invite.id)} className="flex-1 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-[10px] font-black uppercase rounded-lg transition-all">Reddet</button>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em]">Odalar</h3>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="p-1.5 bg-zinc-800/40 hover:bg-zinc-700/60 text-zinc-400 hover:text-white rounded-lg transition-all border border-white/5 shadow-lg"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1">
            {rooms.length === 0 ? (
              <div className="px-3 py-10 text-center border border-dashed border-white/5 rounded-2xl bg-zinc-950/20 backdrop-blur-sm space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700">Henüz oda yok patron.</p>
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="w-full py-3 bg-zinc-800/40 hover:bg-zinc-700/60 text-zinc-300 font-black uppercase tracking-widest text-[10px] rounded-xl transition-all border border-white/5"
                >
                  Oda Oluştur
                </button>
              </div>
            ) : (
              rooms.map((room) => (
                <div
                  key={room.id}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                    activeRoom?.id === room.id 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' 
                      : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200'
                  }`}
                >
                  <button
                    onClick={() => {
                      setActiveRoom(room);
                      if (onClose) onClose();
                    }}
                    className="flex-1 flex items-center gap-3 truncate"
                  >
                    <div className={`w-2 h-2 rounded-full ${activeRoom?.id === room.id ? 'bg-white' : 'bg-zinc-700 group-hover:bg-zinc-500'}`} />
                    <span className="truncate text-left">{room.name}</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 opacity-50 text-[10px]">
                      <Users className="w-3 h-3" />
                      <span>{room.members.length}</span>
                    </div>
                    <div 
                      onClick={(e) => handleDeleteRoom(room.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all z-20 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="p-6 border-t border-white/5 bg-zinc-900/40 backdrop-blur-md">
        <div className="flex items-center gap-4 p-3 bg-zinc-950/40 rounded-2xl border border-white/5 shadow-inner">
          <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-white/5 flex items-center justify-center overflow-hidden shadow-lg">
            {user.photoURL ? (
              <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <UserIcon className="w-6 h-6 text-zinc-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-white truncate tracking-tight">{user.displayName || 'Kullanıcı'}</p>
            <p className="text-[10px] text-zinc-600 truncate font-mono">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Room Creation Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-zinc-900/60 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl relative z-10"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between bg-zinc-900/40">
                <h2 className="text-2xl font-black text-white tracking-tight">Yeni Oda Oluştur</h2>
                <button onClick={() => {
                  setIsModalOpen(false);
                  setUserSearchQuery('');
                }} className="p-2.5 bg-zinc-800/40 hover:bg-zinc-700/60 text-zinc-500 hover:text-white rounded-xl transition-all border border-white/5">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">Oda Adı</label>
                  <input
                    type="text"
                    placeholder="Örn: Proje X Ekibi"
                    className="w-full px-4 py-4 bg-zinc-950/50 border border-white/5 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-zinc-700"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Kişi Ekle</label>
                    <span className="text-[10px] text-zinc-700 font-mono">{selectedUsers.length} seçildi</span>
                  </div>
                  <input
                    type="text"
                    placeholder="İsim veya e-posta ile ara..."
                    className="w-full px-4 py-3 bg-zinc-950/50 border border-white/5 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all mb-2 placeholder:text-zinc-700"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                  />
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                    {allUsers
                      .filter(u => 
                        u.displayName.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
                        u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
                      )
                      .length === 0 ? (
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700 text-center py-6 italic">
                        {userSearchQuery ? 'Sonuç bulunamadı patron.' : 'Ekleyebileceğin kimse yok patron.'}
                      </p>
                    ) : (
                      allUsers
                        .filter(u => 
                          u.displayName.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
                          u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
                        )
                        .map((u) => (
                          <button
                            key={u.uid}
                            onClick={() => toggleUserSelection(u.uid)}
                            className={`w-full flex items-center gap-4 p-3 rounded-2xl transition-all border ${
                              selectedUsers.includes(u.uid) 
                                ? 'bg-blue-600/10 border-blue-600/30' 
                                : 'hover:bg-zinc-800/40 border-transparent hover:border-white/5'
                            }`}
                          >
                            <div className="w-10 h-10 rounded-xl bg-zinc-950/50 border border-white/5 flex items-center justify-center overflow-hidden shadow-inner">
                              {u.photoURL ? <img src={u.photoURL} className="w-full h-full object-cover" /> : <UserIcon className="w-5 h-5 text-zinc-700" />}
                            </div>
                            <div className="flex-1 text-left min-w-0">
                              <p className="text-xs font-black text-white truncate">{u.displayName}</p>
                              <p className="text-[10px] text-zinc-600 truncate font-mono">{u.email}</p>
                            </div>
                            {selectedUsers.includes(u.uid) && (
                              <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/40">
                                <Check className="w-4 h-4 text-white" />
                              </div>
                            )}
                          </button>
                        ))
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-zinc-900/50 border-t border-zinc-800 flex gap-3">
                <button 
                  onClick={() => {
                    setIsModalOpen(false);
                    setUserSearchQuery('');
                  }}
                  className="flex-1 py-4 bg-zinc-800/60 hover:bg-zinc-700/80 text-zinc-300 font-black uppercase tracking-widest text-xs rounded-2xl transition-all border border-white/5"
                >
                  İptal
                </button>
                <button 
                  onClick={handleCreateRoom}
                  disabled={!newRoomName.trim()}
                  className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all shadow-xl shadow-blue-900/20 active:scale-[0.98]"
                >
                  Oluştur
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {roomToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-sm bg-zinc-900/60 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl relative z-10"
            >
              <div className="p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-xl font-black text-white tracking-tight">Odayı Sil</h2>
                <p className="text-sm text-zinc-400">Bu odayı silmek istediğine emin misin patron? Bu işlem geri alınamaz.</p>
              </div>
              <div className="p-6 bg-zinc-900/50 border-t border-zinc-800 flex gap-3">
                <button 
                  onClick={() => setRoomToDelete(null)}
                  className="flex-1 py-3 bg-zinc-800/60 hover:bg-zinc-700/80 text-zinc-300 font-black uppercase tracking-widest text-xs rounded-2xl transition-all border border-white/5"
                >
                  İptal
                </button>
                <button 
                  onClick={async () => {
                    if (!roomToDelete) return;
                    try {
                      const messagesRef = collection(db, `rooms/${roomToDelete}/messages`);
                      const messagesSnapshot = await getDocs(messagesRef);
                      const batch = writeBatch(db);
                      messagesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
                      batch.delete(doc(db, 'rooms', roomToDelete));
                      await batch.commit();
                      setRoomToDelete(null);
                      if (activeRoom?.id === roomToDelete) {
                        setActiveRoom(null as any);
                      }
                    } catch (error) {
                      console.error("Delete room error:", error);
                    }
                  }}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all shadow-xl shadow-red-900/20 active:scale-[0.98]"
                >
                  Sil
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
