/**
 * Chat.tsx
 * A local-first chat client. Conversations live only in this browser's
 * localStorage; SilkLLM never stores your chat content. You choose how long a
 * chat is kept before it auto-dissolves. Streams responses from any text model.
 */

// File: silkllm-frontend/src/pages/user/Chat.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Plus, Trash2, Send, Square, ShieldCheck, PanelLeft, X, Copy, Pencil, RefreshCw,
  Type, Image as ImageIcon, AudioLines, Video, Sliders, Paperclip } from "lucide-react";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Markdown from "@/components/Markdown";
import { modelsApi, generateApi, mediaApi } from "@/services/api";

type Role = "user" | "assistant" | "system";
// Multimodal input parts (vision). Assistant replies are always plain strings.
type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };
// `kind` records how an assistant message was produced (text or a media modality)
// so it can be regenerated the same way.
interface Msg { role: Role; content: string | ContentPart[]; kind?: "text" | "image" | "audio" | "video"; }

// Extract the plain text of a message (for copy, titles, and prompts).
function messageText(content: string | ContentPart[]): string {
  if (typeof content === "string") return content;
  return content.filter((p) => p.type === "text").map((p) => (p as any).text).join(" ");
}
function messageImages(content: string | ContentPart[]): string[] {
  if (typeof content === "string") return [];
  return content.filter((p) => p.type === "image_url").map((p) => (p as any).image_url.url);
}
interface Conversation { id: string; title: string; model: string; createdAt: number; updatedAt: number; messages: Msg[]; }
interface ChatStore { version: number; expiryDays: number; conversations: Conversation[]; }

const KEY = "silk_chats";
// Approx localStorage budget in UTF-16 code units (~5 MB quota, 2 bytes each).
// Used to show a usage bar and warn before the browser refuses to save.
const STORAGE_BUDGET = 2_500_000;

type Mode = "text" | "image" | "audio" | "video";
const MODES: { key: Mode; label: string; icon: React.ReactNode; placeholder: string }[] = [
  { key: "text",  label: "Text",  icon: <Type size={13} />,       placeholder: "Message SilkLLM..." },
  { key: "image", label: "Image", icon: <ImageIcon size={13} />,  placeholder: "Describe an image to generate..." },
  { key: "audio", label: "Audio", icon: <AudioLines size={13} />, placeholder: "Enter text to turn into speech..." },
  { key: "video", label: "Video", icon: <Video size={13} />,      placeholder: "Describe a video to generate..." },
];

// Turn a returned image (URL or raw base64) into a markdown image the renderer
// can display and offer a download for.
function toImageContent(img: string): string {
  const src = /^https?:\/\//.test(img) || img.startsWith("data:") ? img : `data:image/png;base64,${img}`;
  return `![image](${src})`;
}

// OpenAI's fixed voice set (ElevenLabs speakers are fetched from the API).
const OPENAI_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];

interface VoiceSettings { stability: number; similarity_boost: number; style: number; use_speaker_boost: boolean; }
const DEFAULT_VOICE_SETTINGS: VoiceSettings = { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true };

function audioMime(fmt: string): string {
  const map: Record<string, string> = {
    mp3: "audio/mpeg", mpeg: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg",
    m4a: "audio/mp4", aac: "audio/aac", flac: "audio/flac", opus: "audio/ogg",
  };
  const f = (fmt || "mp3").toLowerCase();
  return map[f] || `audio/${f}`;
}

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

function SliderRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] text-warm-grey mb-1">
        <span>{label}</span><span>{value.toFixed(2)}</span>
      </div>
      <input type="range" min={0} max={1} step={0.05} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full accent-silk-gold" />
    </div>
  );
}

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
  const fileRef = useRef<HTMLInputElement>(null);
  // Pending image attachments (data URIs) for the next vision message.
  const [attachments, setAttachments] = useState<{ url: string; name: string }[]>([]);

  const { data: allModels } = useQuery({
    queryKey: ["chat-models"],
    queryFn: () => modelsApi.list().then((r) => r.data.models),
  });
  const [mode, setMode] = useState<Mode>("text");
  const [model, setModel] = useState<string>("");

  // Models available for the current mode (grouped by modality).
  const modeModels = useMemo(
    () => (allModels || []).filter((m: any) => (m.modality || "text") === mode),
    [allModels, mode],
  );
  // Keep the selected model valid whenever the mode or catalogue changes.
  useEffect(() => {
    if (modeModels.length && !modeModels.some((m: any) => m.id === model)) {
      setModel(modeModels[0].id);
    }
  }, [modeModels, model]);

  // Group the current mode's models by provider for the picker.
  const modelsByProvider = useMemo(() => {
    const g: Record<string, any[]> = {};
    for (const m of modeModels) (g[m.provider_id] ||= []).push(m);
    return g;
  }, [modeModels]);

  // Voice controls (audio mode).
  const selectedModel = useMemo(() => modeModels.find((m: any) => m.id === model), [modeModels, model]);
  const isElevenlabs = selectedModel?.provider_id === "elevenlabs";
  const [voice, setVoice] = useState<string>("alloy");
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);

  const { data: elVoices } = useQuery({
    queryKey: ["el-voices"],
    queryFn: () => mediaApi.voices("elevenlabs").then((r) => r.data.voices as any[]),
    enabled: mode === "audio" && isElevenlabs,
    staleTime: 5 * 60_000,
    retry: false,
  });

  // Keep the selected speaker valid for the chosen provider.
  useEffect(() => {
    if (mode !== "audio") return;
    if (isElevenlabs) {
      if (elVoices?.length && !elVoices.some((v) => v.voice_id === voice)) setVoice(elVoices[0].voice_id);
    } else if (!OPENAI_VOICES.includes(voice)) {
      setVoice("alloy");
    }
  }, [mode, isElevenlabs, elVoices, voice]);

  useEffect(() => {
    // Persist; if the browser refuses (quota exceeded, e.g. from generated media),
    // evict the oldest chats first (FIFO) until it fits, then sync state.
    let toStore = store;
    let evicted = 0;
    for (;;) {
      try {
        localStorage.setItem(KEY, JSON.stringify(toStore));
        break;
      } catch {
        if (toStore.conversations.length === 0) {
          toast.error("Local storage is full and could not be freed.");
          break;
        }
        const oldest = toStore.conversations.reduce((a, b) => (a.createdAt <= b.createdAt ? a : b));
        toStore = { ...toStore, conversations: toStore.conversations.filter((c) => c.id !== oldest.id) };
        evicted += 1;
      }
    }
    if (evicted > 0) {
      toast.error(`Storage was full. Removed ${evicted} oldest chat${evicted > 1 ? "s" : ""} to make room.`);
      setStore(toStore);
    }
  }, [store]);

  // Storage usage, for the progress bar and low-space warning.
  const usedChars = useMemo(() => JSON.stringify(store).length, [store]);
  const storagePct = Math.min(100, Math.round((usedChars / STORAGE_BUDGET) * 100));
  const storageMB = ((usedChars * 2) / 1048576).toFixed(2);
  const budgetMB = ((STORAGE_BUDGET * 2) / 1048576).toFixed(1);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [activeId, liveText, store]);

  // Image attachments only apply to text (vision) chat.
  useEffect(() => { if (mode !== "text") setAttachments([]); }, [mode]);

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

  // Generate an image, audio clip, or video from a prompt and append it as an
  // assistant message whose content the Markdown renderer displays inline.
  async function runMediaGeneration(
    convId: string, kind: Exclude<Mode, "text">, prompt: string,
    opts?: { modelId?: string; voice?: string; voiceSettings?: VoiceSettings; elevenlabs?: boolean },
  ) {
    setStreaming(true);
    setLiveText("");
    const useModel = opts?.modelId || (allModels || []).find((m: any) => (m.modality || "text") === kind)?.id;
    try {
      let content = "";
      if (kind === "image") {
        const { data } = await mediaApi.image({ prompt, model: useModel });
        const parts = (data.images || []).filter(Boolean).map(toImageContent);
        content = parts.join("\n") || "(no image was returned)";
      } else if (kind === "audio") {
        const { data } = await mediaApi.audio({
          prompt, model: useModel, voice: opts?.voice,
          voice_settings: opts?.elevenlabs ? opts?.voiceSettings : undefined,
        });
        content = data.audio_b64 ? `data:${audioMime(data.format)};base64,${data.audio_b64}` : "(no audio was returned)";
      } else {
        const { data } = await mediaApi.video({ prompt, model: useModel });
        content = data.video_url || "(no video was returned)";
      }
      updateConversation(convId, (c) => ({
        ...c, messages: c.messages.concat({ role: "assistant", content, kind }), updatedAt: Date.now(),
      }));
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.message || "Generation failed";
      updateConversation(convId, (c) => ({
        ...c, messages: c.messages.concat({ role: "assistant", content: `Error: ${detail}`, kind }), updatedAt: Date.now(),
      }));
    } finally {
      setStreaming(false);
    }
  }

  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imgs.length === 0) { toast.error("Only image files can be attached for now."); return; }
    for (const f of imgs) {
      if (f.size > 8 * 1024 * 1024) { toast.error(`${f.name} is larger than 8 MB.`); continue; }
      const url = await readFileAsDataUrl(f);
      setAttachments((a) => [...a, { url, name: f.name }]);
    }
  }

  async function send() {
    if ((!input.trim() && attachments.length === 0) || streaming) return;
    if (mode !== "text" && modeModels.length === 0) {
      toast.error(`No ${mode} models are available right now.`);
      return;
    }
    let convId = activeId;
    if (!convId) {
      const c: Conversation = { id: uid(), title: input.slice(0, 40), model, createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
      setStore((s) => ({ ...s, conversations: [c, ...s.conversations] }));
      convId = c.id;
      setActiveId(convId);
    }
    const prompt = input.trim();
    // Build multimodal content when images are attached (vision input).
    const content: string | ContentPart[] = attachments.length > 0
      ? [
          ...(prompt ? [{ type: "text", text: prompt } as ContentPart] : []),
          ...attachments.map((a) => ({ type: "image_url", image_url: { url: a.url } } as ContentPart)),
        ]
      : prompt;
    const userMsg: Msg = { role: "user", content };
    const history = (store.conversations.find((c) => c.id === convId)?.messages || []).concat(userMsg);
    updateConversation(convId!, (c) => ({
      ...c, messages: history, updatedAt: Date.now(),
      title: c.messages.length === 0 ? (prompt || "Image chat").slice(0, 40) : c.title,
    }));
    setInput("");
    setAttachments([]);
    if (mode === "text") {
      await runGeneration(convId!, history);
    } else {
      await runMediaGeneration(convId!, mode, prompt, { modelId: model, voice, voiceSettings, elevenlabs: isElevenlabs });
    }
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  }

  // Regenerate the assistant reply at `index`: discard it (and anything after)
  // then re-run the same kind of generation from the preceding messages.
  function regenerate(index: number) {
    if (streaming || !activeId) return;
    const conv = store.conversations.find((c) => c.id === activeId);
    if (!conv) return;
    const kind = conv.messages[index]?.kind || "text";
    const history = conv.messages.slice(0, index);
    updateConversation(activeId, (c) => ({ ...c, messages: history, updatedAt: Date.now() }));
    if (kind === "text") {
      runGeneration(activeId, history);
    } else {
      const prompt = messageText(history[history.length - 1]?.content || "");
      runMediaGeneration(activeId, kind, prompt, { voice, voiceSettings, elevenlabs: isElevenlabs });
    }
  }

  // Edit a user message: load it back into the composer and trim the
  // conversation to before it, so sending produces a fresh exchange.
  function editMessage(index: number) {
    if (streaming || !activeId) return;
    const conv = store.conversations.find((c) => c.id === activeId);
    if (!conv) return;
    setInput(messageText(conv.messages[index].content));
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

      {/* Local storage usage */}
      <div className="mt-3 pt-3 border-t border-muted-metal/40">
        <div className="flex justify-between text-[10px] text-warm-grey mb-1">
          <span>Storage used</span>
          <span>{storageMB} / {budgetMB} MB</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-cloud-grey dark:bg-deep-charcoal overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${storagePct}%`, background: storagePct >= 85 ? "#ef4444" : storagePct >= 60 ? "#FAC059" : "#D29A2D" }} />
        </div>
        {storagePct >= 85 && (
          <p className="text-[10px] text-red-400 mt-1">
            Almost full. Delete old chats or media. When full, the oldest chats are removed automatically.
          </p>
        )}
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
            <select className="input py-1.5 text-sm w-auto max-w-[150px] sm:max-w-[220px] shrink-0 md:flex-none disabled:opacity-50"
              value={model} onChange={(e) => setModel(e.target.value)} disabled={modeModels.length === 0}>
              {modeModels.length === 0
                ? <option value="">No {mode} models</option>
                : Object.entries(modelsByProvider).map(([prov, list]) => (
                    <optgroup key={prov} label={prov}>
                      {(list as any[]).map((m: any) => (
                        <option key={m.id} value={m.id}>{m.display_name}{m.is_free ? " (free)" : ""}</option>
                      ))}
                    </optgroup>
                  ))}
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
                    m.role === "user" ? "bg-silk-gold text-white break-words" : "bg-cloud-grey dark:bg-deep-charcoal text-deep-charcoal dark:text-cloud-grey"
                  }`}>
                    {m.role === "user" ? (
                      <div className="space-y-2">
                        {messageImages(m.content).length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {messageImages(m.content).map((src, k) => (
                              <img key={k} src={src} alt="attachment" className="max-h-40 rounded-lg object-cover" />
                            ))}
                          </div>
                        )}
                        {messageText(m.content) && <span className="whitespace-pre-wrap">{messageText(m.content)}</span>}
                      </div>
                    ) : (
                      <Markdown text={m.content as string} />
                    )}
                  </div>
                  {/* Per-message actions: always visible on touch, hover-revealed on desktop */}
                  <div className={`flex items-center gap-0.5 mt-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity ${
                    m.role === "user" ? "flex-row-reverse" : ""
                  }`}>
                    <ActionBtn onClick={() => copyText(messageText(m.content))} title="Copy"><Copy size={14} /></ActionBtn>
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
                <div className="max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-2.5 text-sm bg-cloud-grey dark:bg-deep-charcoal text-deep-charcoal dark:text-cloud-grey">
                  {liveText ? <Markdown text={liveText} /> : (
                    <span className="text-warm-grey inline-flex items-center gap-2">
                      <RefreshCw size={13} className="animate-spin" />
                      {mode === "text" ? "Thinking..." : `Generating ${mode}...`}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-muted-metal/40">
            {/* Generation mode switcher */}
            <div className="flex items-center gap-1 px-3 pt-2 overflow-x-auto">
              {MODES.map((md) => (
                <button
                  key={md.key}
                  onClick={() => setMode(md.key)}
                  disabled={streaming}
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap transition-colors disabled:opacity-50 ${
                    mode === md.key
                      ? "bg-silk-gold/15 text-silk-gold"
                      : "text-warm-grey hover:text-silk-gold hover:bg-cloud-grey dark:hover:bg-deep-charcoal"
                  }`}
                >
                  {md.icon} {md.label}
                </button>
              ))}
            </div>

            {/* Audio speaker + voice settings */}
            {mode === "audio" && modeModels.length > 0 && (
              <div className="px-3 pt-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-[11px] text-warm-grey">Speaker</label>
                  <select value={voice} onChange={(e) => setVoice(e.target.value)}
                    className="input py-1 text-xs w-auto max-w-[220px]">
                    {isElevenlabs
                      ? (elVoices || []).map((v) => (
                          <option key={v.voice_id} value={v.voice_id}>
                            {v.name}{v.labels?.gender ? ` (${v.labels.gender})` : ""}
                          </option>
                        ))
                      : OPENAI_VOICES.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  {isElevenlabs && (
                    <button onClick={() => setShowVoiceSettings((s) => !s)}
                      className="text-[11px] text-silk-gold hover:underline inline-flex items-center gap-1">
                      <Sliders size={12} /> Voice settings
                    </button>
                  )}
                  {isElevenlabs && !elVoices && (
                    <span className="text-[10px] text-muted-metal">Loading speakers...</span>
                  )}
                </div>
                {isElevenlabs && showVoiceSettings && (
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-cloud-grey dark:bg-deep-charcoal">
                    <SliderRow label="Stability" value={voiceSettings.stability}
                      onChange={(v) => setVoiceSettings((s) => ({ ...s, stability: v }))} />
                    <SliderRow label="Similarity" value={voiceSettings.similarity_boost}
                      onChange={(v) => setVoiceSettings((s) => ({ ...s, similarity_boost: v }))} />
                    <SliderRow label="Style" value={voiceSettings.style}
                      onChange={(v) => setVoiceSettings((s) => ({ ...s, style: v }))} />
                    <label className="flex items-center gap-2 text-xs text-warm-grey sm:col-span-3">
                      <input type="checkbox" checked={voiceSettings.use_speaker_boost}
                        onChange={(e) => setVoiceSettings((s) => ({ ...s, use_speaker_boost: e.target.checked }))}
                        className="accent-silk-gold" />
                      Speaker boost
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* Attached image previews (vision input) */}
            {attachments.length > 0 && (
              <div className="px-3 pt-2 flex flex-wrap gap-2">
                {attachments.map((a, i) => (
                  <div key={i} className="relative group/att">
                    <img src={a.url} alt={a.name} className="h-14 w-14 object-cover rounded-lg border border-muted-metal/40" />
                    <button
                      onClick={() => setAttachments((prev) => prev.filter((_, k) => k !== i))}
                      className="absolute -top-1.5 -right-1.5 bg-slate-dark text-cloud-grey rounded-full p-0.5 border border-muted-metal/50"
                      title="Remove"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="px-3 pb-3 pt-2 flex items-end gap-2">
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              {mode === "text" && (
                <button onClick={() => fileRef.current?.click()}
                  className="btn-secondary shrink-0 px-2.5" title="Attach image (vision)">
                  <Paperclip size={16} />
                </button>
              )}
              <textarea
                ref={textareaRef}
                className="input flex-1 resize-none max-h-32"
                rows={1}
                placeholder={MODES.find((x) => x.key === mode)?.placeholder}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              />
              {streaming ? (
                mode === "text" ? (
                  <button onClick={() => { stopRef.current = true; }} className="btn-secondary shrink-0" title="Stop">
                    <Square size={16} />
                  </button>
                ) : (
                  <button disabled className="btn-primary shrink-0 opacity-60 cursor-wait" title="Generating">
                    <RefreshCw size={16} className="animate-spin" />
                  </button>
                )
              ) : (
                <button
                  onClick={send}
                  disabled={(!input.trim() && attachments.length === 0) || (mode !== "text" && modeModels.length === 0)}
                  className="btn-primary shrink-0 disabled:opacity-50"
                  title="Send"
                >
                  <Send size={16} />
                </button>
              )}
            </div>

            {mode !== "text" && (
              <p className="px-3 pb-2 text-[10px] text-muted-metal">
                {modeModels.length === 0
                  ? `No ${mode} models are enabled yet. An admin can enable one under Model Control.`
                  : `Generates ${mode} from your prompt. Results are kept only in this browser.`}
              </p>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

// EOF silkllm-frontend/src/pages/user/Chat.tsx
