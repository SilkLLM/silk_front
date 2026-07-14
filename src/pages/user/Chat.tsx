/**
 * Chat.tsx
 * A local-first chat client. Conversations live only in this browser's
 * localStorage; SilkLLM never stores your chat content. You choose how long a
 * chat is kept before it auto-dissolves. Streams responses from any text model.
 */

// File: silkllm-frontend/src/pages/user/Chat.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Plus, Trash2, Send, Square, ShieldCheck, PanelLeft, X, Copy, Pencil, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Markdown from "@/components/Markdown";
import { modelsApi, generateApi } from "@/services/api";

type Role = "user" | "assistant" | "system";
interface Msg { role: Role; content: string; }
interface Conversation { id: string; title: string; model: string; createdAt: number; updatedAt: number; messages: Msg[]; }
interface ChatStore { version: number; expiryDays: number; conversations: Conversation[]; }

const KEY = "silk_chats";
const EXPIRY_OPTIONS = [
  { label: "This session", days: 0 },
  { label: "1 day", days: 1 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "Never", days: -1 },
];

function loadStore(): ChatStore {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "");
    if (raw && Array.isArray(raw.conversations)) return raw;
  } catch { /* ignore */ }
  return { version: 1, expiryDays: 7, conversations: [] };
}

function purge(store: ChatStore): ChatStore {
  if (store.expiryDays < 0) return store; // never
  if (store.expiryDays === 0) return { ...store, conversations: [] }; // session-only
  const cutoff = Date.now() - store.expiryDays * 86_400_000;
  return { ...store, conversations: store.conversations.filter((c) => c.updatedAt >= cutoff) };
}

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

function ActionBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="p-1.5 rounded-md text-warm-grey hover:text-silk-gold hover:bg-cloud-grey dark:hover:bg-deep-charcoal transition-colors"
    >
      {children}
    </button>
  );
}

export default function Chat() {
  const [store, setStore] = useState<ChatStore>(() => purge(loadStore()));
  const [activeId, setActiveId] = useState<string | null>(store.conversations[0]?.id || null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [liveText, setLiveText] = useState("");
  const stopRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: models } = useQuery({
    queryKey: ["chat-models"],
    queryFn: () => modelsApi.list().then((r) => r.data.models.filter((m: any) => (m.modality || "text") === "text")),
  });
  const [model, setModel] = useState<string>("");
  useEffect(() => { if (!model && models?.length) setModel(models[0].id); }, [models, model]);

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(store)); }, [store]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [activeId, liveText, store]);

  const active = useMemo(() => store.conversations.find((c) => c.id === activeId) || null, [store, activeId]);

  function newChat() {
    const c: Conversation = { id: uid(), title: "New chat", model, createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
    setStore((s) => ({ ...s, conversations: [c, ...s.conversations] }));
    setActiveId(c.id);
  }

  function deleteChat(id: string) {
    setStore((s) => ({ ...s, conversations: s.conversations.filter((c) => c.id !== id) }));
    if (activeId === id) setActiveId(null);
  }

  function updateConversation(id: string, updater: (c: Conversation) => Conversation) {
    setStore((s) => ({ ...s, conversations: s.conversations.map((c) => (c.id === id ? updater(c) : c)) }));
  }

  // Stream a completion for the given history and append the assistant reply to
  // the conversation. The conversation's messages must already equal `history`.
  async function runGeneration(convId: string, history: Msg[]) {
    setStreaming(true);
    setLiveText("");
    stopRef.current = false;

    let acc = "";
    await generateApi.streamGenerate(
      { messages: history.map((m) => ({ role: m.role, content: m.content })), model, stream: true },
      (chunk) => { if (!stopRef.current) { acc += chunk; setLiveText(acc); } },
      (err) => { acc = acc || `Error: ${err}`; },
      () => {},
    );

    updateConversation(convId, (c) => ({
      ...c, messages: c.messages.concat({ role: "assistant", content: acc || "(no response)" }), updatedAt: Date.now(),
    }));
    setLiveText("");
    setStreaming(false);
  }

  async function send() {
    if (!input.trim() || streaming) return;
    let convId = activeId;
    if (!convId) {
      const c: Conversation = { id: uid(), title: input.slice(0, 40), model, createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
      setStore((s) => ({ ...s, conversations: [c, ...s.conversations] }));
      convId = c.id;
      setActiveId(convId);
    }
    const userMsg: Msg = { role: "user", content: input.trim() };
    const history = (store.conversations.find((c) => c.id === convId)?.messages || []).concat(userMsg);
    updateConversation(convId!, (c) => ({
      ...c, messages: history, updatedAt: Date.now(),
      title: c.messages.length === 0 ? input.slice(0, 40) : c.title,
    }));
    setInput("");
    await runGeneration(convId!, history);
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  }

  // Regenerate the assistant reply at `index`: discard it (and anything after)
  // then re-run generation from the preceding messages.
  function regenerate(index: number) {
    if (streaming || !activeId) return;
    const conv = store.conversations.find((c) => c.id === activeId);
    if (!conv) return;
    const history = conv.messages.slice(0, index);
    updateConversation(activeId, (c) => ({ ...c, messages: history, updatedAt: Date.now() }));
    runGeneration(activeId, history);
  }

  // Edit a user message: load it back into the composer and trim the
  // conversation to before it, so sending produces a fresh exchange.
  function editMessage(index: number) {
    if (streaming || !activeId) return;
    const conv = store.conversations.find((c) => c.id === activeId);
    if (!conv) return;
    setInput(conv.messages[index].content);
    updateConversation(activeId, (c) => ({ ...c, messages: c.messages.slice(0, index), updatedAt: Date.now() }));
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function deleteMessage(index: number) {
    if (streaming || !activeId) return;
    updateConversation(activeId, (c) => ({ ...c, messages: c.messages.filter((_, i) => i !== index), updatedAt: Date.now() }));
  }

  // Shared conversation list, used in both the desktop sidebar and the mobile drawer.
  // onPick is called after selecting/creating a chat so the mobile drawer can close.
  const conversationList = (onPick: () => void) => (
    <>
      <button onClick={() => { newChat(); onPick(); }} className="btn-primary w-full flex items-center justify-center gap-2 text-sm">
        <Plus size={16} /> New chat
      </button>
      <div className="flex-1 overflow-y-auto mt-3 space-y-1">
        {store.conversations.length === 0 && <p className="text-xs text-warm-grey px-2">No chats yet.</p>}
        {store.conversations.map((c) => (
          <div key={c.id}
            className={`group flex items-center gap-2 px-2.5 py-2.5 rounded-lg cursor-pointer text-sm ${
              c.id === activeId ? "bg-silk-gold/10 text-silk-gold" : "text-warm-grey hover:bg-cloud-grey dark:hover:bg-deep-charcoal"
            }`}
            onClick={() => { setActiveId(c.id); onPick(); }}
          >
            <MessageSquare size={14} className="shrink-0" />
            <span className="flex-1 truncate">{c.title}</span>
            <button onClick={(e) => { e.stopPropagation(); deleteChat(c.id); }}
              className="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-warm-grey hover:text-red-400 p-1 -m-1">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-muted-metal/40">
        <label className="text-[11px] text-warm-grey flex items-center gap-1 mb-1">
          <ShieldCheck size={12} className="text-silk-gold" /> Keep chats for
        </label>
        <select className="input text-xs py-1.5" value={store.expiryDays}
          onChange={(e) => setStore((s) => ({ ...s, expiryDays: parseInt(e.target.value) }))}>
          {EXPIRY_OPTIONS.map((o) => <option key={o.days} value={o.days}>{o.label}</option>)}
        </select>
        <p className="text-[10px] text-muted-metal mt-1.5">Stored only in this browser. We never keep your chats.</p>
      </div>
    </>
  );

  return (
    <DashboardLayout>
      <div className="flex gap-4 h-[calc(100vh-8rem)]">
        {/* Conversation list (desktop) */}
        <div className="hidden md:flex w-64 flex-col card p-3 shrink-0">
          {conversationList(() => {})}
        </div>

        {/* Conversation list (mobile drawer) */}
        {drawerOpen && (
          <div className="md:hidden fixed inset-0 z-[60]">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[85%] bg-white dark:bg-slate-dark border-r border-muted-metal/40 p-3 flex flex-col shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-deep-charcoal dark:text-cloud-grey">Your chats</span>
                <button onClick={() => setDrawerOpen(false)} className="text-warm-grey hover:text-silk-gold p-1 -m-1">
                  <X size={18} />
                </button>
              </div>
              {conversationList(() => setDrawerOpen(false))}
            </div>
          </div>
        )}

        {/* Chat pane */}
        <div className="flex-1 min-w-0 flex flex-col card p-0 overflow-hidden">
          <div className="flex items-center gap-2 px-3 sm:px-4 py-3 border-b border-muted-metal/40">
            <button onClick={() => setDrawerOpen(true)}
              className="md:hidden relative text-warm-grey hover:text-silk-gold p-1 -m-1 shrink-0" title="Your chats">
              <PanelLeft size={20} />
              {store.conversations.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-silk-gold text-white text-[9px] font-semibold rounded-full min-w-[15px] h-[15px] px-0.5 flex items-center justify-center">
                  {store.conversations.length}
                </span>
              )}
            </button>
            <MessageSquare size={16} className="text-silk-gold hidden md:block shrink-0" />
            <span className="md:hidden flex-1 truncate text-sm font-medium text-deep-charcoal dark:text-cloud-grey">
              {active?.title || "New chat"}
            </span>
            <select className="input py-1.5 text-sm w-auto max-w-[150px] sm:max-w-[220px] shrink-0 md:flex-none"
              value={model} onChange={(e) => setModel(e.target.value)}>
              {(models || []).map((m: any) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
            </select>
            <button onClick={newChat} className="md:hidden text-silk-gold p-1 -m-1 shrink-0" title="New chat"><Plus size={20} /></button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {!active || active.messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <MessageSquare size={30} className="text-muted-metal mb-3" />
                <p className="text-warm-grey text-sm">Start a conversation. Your chats stay on this device.</p>
              </div>
            ) : (
              active.messages.map((m, i) => (
                <div key={i} className={`group flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === "user" ? "bg-silk-gold text-white whitespace-pre-wrap break-words" : "bg-cloud-grey dark:bg-deep-charcoal text-deep-charcoal dark:text-cloud-grey"
                  }`}>
                    {m.role === "user" ? m.content : <Markdown text={m.content} />}
                  </div>
                  {/* Per-message actions: always visible on touch, hover-revealed on desktop */}
                  <div className={`flex items-center gap-0.5 mt-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity ${
                    m.role === "user" ? "flex-row-reverse" : ""
                  }`}>
                    <ActionBtn onClick={() => copyText(m.content)} title="Copy"><Copy size={14} /></ActionBtn>
                    {m.role === "user" ? (
                      <ActionBtn onClick={() => editMessage(i)} title="Edit"><Pencil size={14} /></ActionBtn>
                    ) : (
                      <ActionBtn onClick={() => regenerate(i)} title="Regenerate"><RefreshCw size={14} /></ActionBtn>
                    )}
                    <ActionBtn onClick={() => deleteMessage(i)} title="Delete"><Trash2 size={14} /></ActionBtn>
                  </div>
                </div>
              ))
            )}
            {streaming && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm bg-cloud-grey dark:bg-deep-charcoal text-deep-charcoal dark:text-cloud-grey">
                  {liveText ? <Markdown text={liveText} /> : <span className="text-warm-grey">Thinking...</span>}
                </div>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-muted-metal/40 flex items-end gap-2">
            <textarea
              ref={textareaRef}
              className="input flex-1 resize-none max-h-32"
              rows={1}
              placeholder="Message SilkLLM..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            {streaming ? (
              <button onClick={() => { stopRef.current = true; }} className="btn-secondary shrink-0" title="Stop">
                <Square size={16} />
              </button>
            ) : (
              <button onClick={send} disabled={!input.trim()} className="btn-primary shrink-0 disabled:opacity-50" title="Send">
                <Send size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

// EOF silkllm-frontend/src/pages/user/Chat.tsx
