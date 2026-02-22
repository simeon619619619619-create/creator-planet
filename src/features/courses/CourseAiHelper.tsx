import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, Bot, User, Loader2 } from 'lucide-react';
import { sendStudentMentorMessage } from '../ai-manager/geminiService';
import { AIMessage } from '../../core/types';
import { useAuth } from '../../core/contexts/AuthContext';
import AiResponseText from '../../components/ui/AiResponseText';

interface CourseAiHelperProps {
  courseId: string;
  currentLesson?: { id: string; title: string } | null;
  currentModule?: string | null;
}

const CourseAiHelper: React.FC<CourseAiHelperProps> = ({
  courseId,
  currentLesson,
  currentModule,
}) => {
  const { user, profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      role: 'model',
      text: "Hi! I'm your Course AI Helper. I'm here to assist you with this course. Ask me anything about the lessons, concepts, or if you need clarification on any topic!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !user) return;

    const userMsg: AIMessage = { role: 'user', text: input, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    const originalInput = input;
    setInput('');
    setIsTyping(true);

    try {
      // Convert messages to API format
      const historyForApi = messages.map((m) => ({ role: m.role, text: m.text }));

      // Call AI service with student-specific context (course progress, creator prompt, user name)
      const response = await sendStudentMentorMessage(originalInput, historyForApi, user.id, courseId, profile?.full_name);

      const aiMsg: AIMessage = {
        role: 'model',
        text: response || "I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      console.error('Course AI Helper error:', error);
      const errorMsg: AIMessage = {
        role: 'model',
        text: "I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 transition-all hover:scale-110 flex items-center gap-2"
          aria-label="Open AI Helper"
        >
          <MessageCircle size={24} />
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[500px] z-50 bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-indigo-600 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot size={20} />
              <h3 className="font-semibold">Course AI Helper</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-indigo-700 p-1 rounded transition-colors"
              aria-label="Close chat"
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    msg.role === 'model'
                      ? 'bg-indigo-100 text-indigo-600'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {msg.role === 'model' ? <Bot size={18} /> : <User size={18} />}
                </div>
                <div
                  className={`max-w-[80%] p-3 rounded-2xl ${
                    msg.role === 'model'
                      ? 'bg-white text-slate-800 rounded-tl-none border border-slate-200 shadow-sm'
                      : 'bg-indigo-600 text-white rounded-tr-none'
                  }`}
                >
                  {msg.role === 'model' ? (
                    <AiResponseText text={msg.text} />
                  ) : (
                    <p className="text-sm leading-relaxed">{msg.text}</p>
                  )}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <Bot size={18} />
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl rounded-tl-none border border-slate-200 flex gap-1">
                  <span
                    className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  ></span>
                  <span
                    className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  ></span>
                  <span
                    className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  ></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-slate-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Ask me anything about this course..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Send message"
              >
                {isTyping ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CourseAiHelper;
