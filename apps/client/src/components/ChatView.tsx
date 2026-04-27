import { useState, useRef, useEffect } from "react";
import { Send, Paperclip, AtSign } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import type { Session } from "../types";

interface ChatViewProps {
  session: Session | null;
  onSendMessage: (content: string) => Promise<void>;
  onNewChat: () => void;
  streamingText: string;
  isStreaming: boolean;
}

export function ChatView({ session, onSendMessage, onNewChat, streamingText, isStreaming }: ChatViewProps) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change or streaming text updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages, streamingText]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [input]);

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    if (!session) {
      onNewChat();
      return;
    }

    setSending(true);
    setInput("");
    try {
      await onSendMessage(trimmed);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Empty state
  if (!session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <h1 className="text-4xl font-semibold text-text-primary mb-2">What should we work on?</h1>
        <p className="text-text-muted text-sm mb-10">Start a new conversation, or pick a previous chat from the sidebar.</p>
        <div className="w-full max-w-3xl">
          <div className="bg-bg-card border border-border-secondary rounded-2xl p-4 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Hermes, @ add files, / commands, $ skills"
              className="w-full bg-transparent text-text-primary placeholder-text-muted text-sm resize-none outline-none min-h-[40px]"
              rows={1}
            />
            <div className="flex items-center justify-between mt-3 border-t border-border-primary pt-2.5">
              <div className="flex items-center gap-2 text-xs">
                <button className="flex items-center gap-1 px-2 py-1 rounded-md text-text-muted hover:bg-bg-hover transition-colors">
                  <Paperclip size={13} />
                </button>
                <button className="flex items-center gap-1 px-2 py-1 rounded-md text-text-muted hover:bg-bg-hover transition-colors">
                  ⊘ Default permissions
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">Local OpenAI</span>
                <span className="text-xs text-text-muted">5.3-Codex Medium</span>
                <button
                  onClick={() => { onNewChat(); handleSubmit(); }}
                  disabled={!input.trim()}
                  className="p-1.5 rounded-full bg-text-muted/20 hover:bg-text-muted/30 text-text-secondary disabled:opacity-30 transition-colors"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
            <div className="mt-2 border-t border-border-primary pt-2 text-xs text-text-muted px-1">
              Work in a project
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active chat
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-primary">
      <div className="px-8 pt-5 pb-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 text-[13px] text-text-secondary">
          <div className="flex items-center gap-2">
            <span className="font-medium text-text-primary leading-6">{session.title || "New chat"}</span>
            <span className="text-text-muted leading-6">···</span>
          </div>
        </div>
      </div>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-8 py-3">
        <div className="max-w-4xl mx-auto space-y-5">
          {session.messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* Streaming assistant message */}
          {isStreaming && streamingText && (
            <MessageBubble
              message={{
                id: "streaming",
                role: "assistant",
                content: streamingText,
                timestamp: new Date().toISOString(),
                model: undefined,
              }}
            />
          )}

          {/* Thinking indicator */}
          {isStreaming && !streamingText && (
            <div className="flex items-center gap-2 text-text-muted text-sm py-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:0.1s]" />
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:0.2s]" />
              </div>
              <span>Hermes is thinking...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="px-8 pb-3">
        <div className="max-w-4xl mx-auto">
          <div className="bg-[#1d2533] border border-[#313a4b] rounded-2xl px-4 pt-3 pb-2.5 shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              disabled={isStreaming}
              className="w-full bg-transparent text-text-primary placeholder-text-muted text-sm resize-none outline-none min-h-[34px] disabled:opacity-50"
              rows={1}
            />
            <div className="flex items-center justify-between mt-2.5 border-t border-border-primary pt-2">
              <div className="flex items-center gap-1.5">
                <button className="w-5 h-5 rounded text-text-muted hover:bg-bg-hover transition-colors">
                  <PlusMini />
                </button>
                <InputHint icon={<AtSign size={12} />} label="Default permissions" />
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-[#273041] text-[11px] text-[#ced8ea]">Local OpenAI</span>
                <span className="text-xs text-text-muted">5.3-Codex Medium</span>
                <button
                  onClick={handleSubmit}
                  disabled={!input.trim() || sending || isStreaming}
                  className="p-1.5 rounded-full bg-text-muted/20 hover:bg-text-muted/30 text-text-secondary disabled:opacity-30 transition-colors"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InputHint({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-text-muted">
      {icon}
      {label}
    </span>
  );
}

function PlusMini() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="mx-auto">
      <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
