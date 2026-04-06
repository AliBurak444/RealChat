import { Message, UserProfile } from '../types';
import type { User } from 'firebase/auth';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { motion } from 'motion/react';
import { db } from '../lib/firebase';
import { doc, deleteDoc } from 'firebase/firestore';

interface MessageListProps {
  messages: Message[];
  currentUser: User;
  profile: UserProfile;
}

export default function MessageList({ messages, currentUser, profile }: MessageListProps) {
  const deleteMessage = async (messageId: string, roomId: string) => {
    try {
      await deleteDoc(doc(db, `rooms/${roomId}/messages`, messageId));
    } catch (error) {
      console.error("Mesaj silme hatası:", error);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {messages.map((msg, index) => {
        const isMe = msg.senderId === currentUser.uid;
        const isAI = msg.senderId === 'gemini-ai';

        return (
          <motion.div
            key={msg.id || index}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
          >
            <div className={`flex items-center gap-3 mb-1.5 px-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
              <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                {isMe ? 'Sen' : msg.senderName}
              </span>
              <span className="text-zinc-800">•</span>
              <span className="text-[10px] font-mono text-zinc-700">
                {msg.createdAt?.toDate ? format(msg.createdAt.toDate(), 'HH:mm', { locale: tr }) : ''}
              </span>
              {(isMe || profile.role === 'admin' || profile.role === 'moderator') && (
                <button 
                  onClick={() => deleteMessage(msg.id, msg.roomId)}
                  className="text-[10px] font-black text-red-500 hover:text-red-400 uppercase tracking-widest ml-2"
                >
                  Sil
                </button>
              )}
              {msg.replyTo && (
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest ml-2 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                  {msg.replyTo} kişisine cevap verildi
                </span>
              )}
            </div>

            <div
              className={`max-w-[85%] lg:max-w-[70%] p-5 rounded-[2rem] text-sm leading-relaxed shadow-2xl transition-all hover:scale-[1.01] ${
                isMe 
                  ? 'bg-blue-600/80 backdrop-blur-md text-white rounded-tr-none shadow-blue-900/20 border border-white/10' 
                  : isAI 
                    ? 'bg-purple-900/20 backdrop-blur-md text-zinc-100 border border-purple-500/20 rounded-tl-none shadow-purple-900/10' 
                    : 'bg-zinc-900/60 backdrop-blur-md text-zinc-200 border border-white/5 rounded-tl-none shadow-black/40'
              }`}
            >
              {msg.type === 'image' && msg.imageUrl && (
                <div className="mb-3 rounded-lg overflow-hidden border border-zinc-700 shadow-lg">
                  <img src={msg.imageUrl} alt="AI Generated" className="w-full h-auto" />
                </div>
              )}
              {msg.type === 'audio' && msg.audioUrl && (
                <div className="mb-3">
                  <audio controls src={msg.audioUrl} className="w-full max-w-[250px] h-10 rounded-lg outline-none" />
                </div>
              )}
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
