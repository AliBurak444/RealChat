import { useState, useRef } from 'react';
import { Send, Image as ImageIcon, Smile } from 'lucide-react';

interface MessageInputProps {
  onSendMessage: (text: string) => void;
}

export default function MessageInput({ onSendMessage }: MessageInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim()) return;
    onSendMessage(text);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  return (
    <form onSubmit={handleSubmit} className="relative flex items-end gap-3 max-w-5xl mx-auto w-full">
      <div className="flex-1 relative bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-2xl focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:border-blue-500/50 transition-all shadow-2xl">
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder="Mesajınızı yazın... (Görsel için /imagine prompt)"
          className="w-full p-4 bg-transparent border-none focus:ring-0 text-sm resize-none max-h-48 scrollbar-hide text-zinc-100 placeholder:text-zinc-600"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />
        <div className="flex items-center justify-between px-4 pb-3">
          <div className="flex items-center gap-3">
            <button 
              type="button" 
              onClick={() => setText(prev => prev + '/imagine ')}
              className="p-1.5 text-zinc-500 hover:text-blue-400 transition-colors bg-zinc-800/50 rounded-lg border border-zinc-700/50"
            >
              <ImageIcon className="w-4 h-4" />
            </button>
            <button 
              type="button" 
              onClick={() => setText(prev => prev + '🙂')}
              className="p-1.5 text-zinc-500 hover:text-yellow-400 transition-colors bg-zinc-800/50 rounded-lg border border-zinc-700/50"
            >
              <Smile className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-zinc-600 font-mono">Shift + Enter for new line</p>
        </div>
      </div>
      <button
        type="submit"
        disabled={!text.trim()}
        className="p-4 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-900/50 disabled:text-zinc-800 text-white rounded-2xl transition-all shadow-xl shadow-blue-900/20 border border-white/5 active:scale-90 group"
      >
        <Send className={`w-5 h-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${text.trim() ? 'text-white' : 'text-zinc-800'}`} />
      </button>
    </form>
  );
}
