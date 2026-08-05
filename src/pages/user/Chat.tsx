/**
 * Chat.tsx
 * A local-first chat client. Conversations live only in this browser's
 * localStorage; SilkLLM never stores your chat content. You choose how long a
 * chat is kept before it auto-dissolves. Streams responses from any text model,
 * and generates image, audio and video from the same composer.
 *
 * The layout takes the shell's full height (`fullBleed`) and owns its own
 * scrolling, so the message list scrolls independently of the composer.
 */

// File: silkllm-frontend/src/pages/user/Chat.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AudioLines, Copy, Image as ImageIcon, MessageSquare, Paperclip, PanelLeft,
  Pencil, Plus, RefreshCw, Send, ShieldCheck, Sliders, Sparkles, Square,
  Trash2, Type, Video, X,
} from "lucide-react";
import toast from "react-hot-toast";
import clsx from "clsx";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Markdown from "@/components/Markdown";
import { modelsApi, generateApi, mediaApi } from "@/services/api";
import {
  Button, Checkbox, EmptyState, Field, IconButton, Input, Meter, Modal, Select,
} from "@/components/ui";

type Role = "user" | "assistant" | "system";
// Multimodal input parts (vision). Assistant replies are always plain strings.
type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };
// `kind` records how an assistant message was produced (text or a media modality)
// so it can be regenerated the same way.
interface Msg { role: Role; content: string | ContentPart[]; kind?: "text" | "image" | "audio" | "video"; }

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
const STORAGE_BUDGET = 2_500_000;

type Mode = "text" | "image" | "audio" | "video";
const MODES: { key: Mode; label: string; icon: React.ReactNode; placeholder: string }[] = [
  { key: "text",  label: "Text",  icon: <Type size={13} />,       placeholder: "Message SilkLLM..." },
  { key: "image", label: "Image", icon: <ImageIcon size={13} />,  placeholder: "Describe an image to generate..." },
  { key: "audio", label: "Audio", icon: <AudioLines size={13} />, placeholder: "Enter text to turn into speech..." },
  { key: "video", label: "Video", icon: <Video size={13} />,      placeholder: "Describe a video to generate..." },
];

function toImageContent(img: string): string {
  const src = /^https?:\/\//.test(img) || img.startsWith("data:") ? img : `data:image/png;base64,${img}`;
  return `![image](${src})`;
}

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
  if (store.expiryDays < 0) return store;
  if (store.expiryDays === 0) return { ...store, conversations: [] };
  const cutoff = Date.now() - store.expiryDays * 86_400_000;
  return { ...store, conversations: store.conversations.filter((c) => c.updatedAt >= cutoff) };
}

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

// How tall the composer may grow before it starts scrolling internally, in px.
// Roughly ten lines at the composer's font size.
const COMPOSER_MAX_HEIGHT = 220;

/**
 * Grow a textarea to fit its content, up to a ceiling, then let it scroll.
 *
 * The height has to be reset to "auto" before reading scrollHeight, otherwise
 * the element can only ever grow: scrollHeight is clamped by the height already
 * set on it, so deleting lines would leave the box oversized.
 */
function useAutoGrow(
  ref: React.RefObject<HTMLTextAreaElement>,
  value: string,
  maxHeight = COMPOSER_MAX_HEIGHT,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [ref, value, maxHeight]);
}

function SliderRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex justify-between text-2xs text-ink-2 mb-1.5">
        <span>{label}</span><span className="num">{value.toFixed(2)}</span>
      </div>
      <input
        type="range" min={0} max={1} step={0.05} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 accent-accent cursor-pointer"
      />
    </div>
  );
}

export default function Chat() {
  const qc = useQueryClient();
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
  const audioFileRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<{ url: string; name: string }[]>([]);
  const [sourceAudio, setSourceAudio] = useState<{ name: string; file: File } | null>(null);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneName, setCloneName] = useState("");
  const [cloneSamples, setCloneSamples] = useState<File[]>([]);
  const [cloning, setCloning] = useState(false);

  // Keep the composer sized to whatever has been typed, including after send()
  // clears it and after editMessage() loads a message back in.
  useAutoGrow(textareaRef, input);

  const { data: allModels } = useQuery({
    queryKey: ["chat-models"],
    queryFn: () => modelsApi.list().then((r) => r.data.models),
  });
  const [mode, setMode] = useState<Mode>("text");
  const [provider, setProvider] = useState<string>("");
  const [model, setModel] = useState<string>("");

  const modeModels = useMemo(
    () => (allModels || []).filter((m: any) => {
      if ((m.modality || "text") !== mode) return false;
      if (mode === "audio" && /_sts|sts_/.test(m.id)) return false;
      return true;
    }),
    [allModels, mode],
  );

  // Picking a provider first, then a model within it, replaces one long
  // flat list (hundreds of models across nine providers) with two short
  // ones. The model field is the API's "provider" - it was read as
  // "provider_id" here before, which doesn't exist on the response, so
  // every model silently grouped into one bogus bucket.
  const providers = useMemo(
    () => Array.from(new Set<string>(modeModels.map((m: any) => m.provider as string))).sort(),
    [modeModels],
  );

  useEffect(() => {
    if (providers.length && !providers.includes(provider)) {
      setProvider(providers[0]);
    }
  }, [providers, provider]);

  const providerModels = useMemo(
    () => modeModels.filter((m: any) => m.provider === provider),
    [modeModels, provider],
  );

  useEffect(() => {
    if (providerModels.length && !providerModels.some((m: any) => m.id === model)) {
      setModel(providerModels[0].id);
    }
  }, [providerModels, model]);

  const selectedModel = useMemo(() => providerModels.find((m: any) => m.id === model), [providerModels, model]);
  const isElevenlabs = selectedModel?.provider === "elevenlabs";
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

  const usedChars = useMemo(() => JSON.stringify(store).length, [store]);
  const storagePct = Math.min(100, Math.round((usedChars / STORAGE_BUDGET) * 100));
  const storageMB = ((usedChars * 2) / 1048576).toFixed(2);
  const budgetMB = ((STORAGE_BUDGET * 2) / 1048576).toFixed(1);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [activeId, liveText, store]);

  useEffect(() => { if (mode !== "text") setAttachments([]); }, [mode]);
  useEffect(() => { if (mode !== "audio") setSourceAudio(null); }, [mode]);

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

  async function runVoiceConversion(convId: string, file: File, targetVoice: string) {
    setStreaming(true);
    setLiveText("");
    try {
      const form = new FormData();
      form.append("audio", file);
      form.append("voice", targetVoice);
      form.append("seconds", "10");
      if (showVoiceSettings) {
        form.append("stability", String(voiceSettings.stability));
        form.append("similarity_boost", String(voiceSettings.similarity_boost));
        form.append("style", String(voiceSettings.style));
        form.append("use_speaker_boost", String(voiceSettings.use_speaker_boost));
      }
      const { data } = await mediaApi.speechToSpeech(form);
      const content = data.audio_b64 ? `data:${audioMime(data.format)};base64,${data.audio_b64}` : "(no audio was returned)";
      updateConversation(convId, (c) => ({
        ...c, messages: c.messages.concat({ role: "assistant", content, kind: "audio" }), updatedAt: Date.now(),
      }));
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.message || "Voice conversion failed";
      updateConversation(convId, (c) => ({
        ...c, messages: c.messages.concat({ role: "assistant", content: `Error: ${detail}`, kind: "audio" }), updatedAt: Date.now(),
      }));
    } finally {
      setStreaming(false);
    }
  }

  async function doCloneVoice() {
    if (!cloneName.trim() || cloneSamples.length === 0) {
      toast.error("Give the voice a name and at least one sample.");
      return;
    }
    setCloning(true);
    try {
      const form = new FormData();
      form.append("name", cloneName.trim());
      cloneSamples.forEach((f) => form.append("files", f));
      const { data } = await mediaApi.cloneVoice(form);
      toast.success(`Voice "${cloneName.trim()}" cloned.`);
      setCloneOpen(false); setCloneName(""); setCloneSamples([]);
      await qc.invalidateQueries({ queryKey: ["el-voices"] });
      if (data.voice_id) setVoice(data.voice_id);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Cloning failed");
    } finally {
      setCloning(false);
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
    // Speech-to-speech: an uploaded source clip takes over audio mode.
    if (mode === "audio" && sourceAudio && !streaming) {
      let cid = activeId;
      if (!cid) {
        const c: Conversation = { id: uid(), title: "Voice change", model, createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
        setStore((s) => ({ ...s, conversations: [c, ...s.conversations] }));
        cid = c.id; setActiveId(cid);
      }
      const label = `Voice change: ${sourceAudio.name}`;
      const history = (store.conversations.find((c) => c.id === cid)?.messages || []).concat({ role: "user", content: label });
      updateConversation(cid!, (c) => ({ ...c, messages: history, updatedAt: Date.now(), title: c.messages.length === 0 ? label.slice(0, 40) : c.title }));
      const file = sourceAudio.file;
      setSourceAudio(null);
      await runVoiceConversion(cid!, file, voice);
      return;
    }
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

  // Conversation list, shared between the desktop rail and the mobile drawer.
  const conversationList = (onPick: () => void) => (
    <>
      <div className="p-3 shrink-0">
        <Button variant="primary" className="w-full" icon={<Plus size={15} />} onClick={() => { newChat(); onPick(); }}>
          New chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        {store.conversations.length === 0 && (
          <p className="text-xs text-ink-3 px-3 py-4 text-center">No chats yet.</p>
        )}
        {store.conversations.map((c) => (
          <div
            key={c.id}
            onClick={() => { setActiveId(c.id); onPick(); }}
            className={clsx(
              "group flex items-center gap-2 px-2.5 h-9 rounded-lg cursor-pointer text-sm transition-colors",
              c.id === activeId ? "bg-accent/10 text-accent-ink" : "text-ink-2 hover:text-ink hover:bg-ink/[0.05]",
            )}
          >
            <MessageSquare size={14} className="shrink-0" />
            <span className="flex-1 truncate">{c.title}</span>
            <button
              onClick={(e) => { e.stopPropagation(); deleteChat(c.id); }}
              aria-label={`Delete ${c.title}`}
              className="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-ink-3 hover:text-danger p-1 -m-1 transition-opacity shrink-0"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t border-line p-3 space-y-3">
        <div>
          <label className="text-2xs text-ink-2 flex items-center gap-1.5 mb-1.5">
            <ShieldCheck size={12} className="text-accent-ink" /> Keep chats for
          </label>
          <Select
            className="h-8 text-xs"
            value={store.expiryDays}
            onChange={(e) => setStore((s) => ({ ...s, expiryDays: parseInt(e.target.value) }))}
          >
            {EXPIRY_OPTIONS.map((o) => <option key={o.days} value={o.days}>{o.label}</option>)}
          </Select>
          <p className="text-2xs text-ink-3 mt-1.5 leading-relaxed">
            Stored only in this browser. We never keep your chats.
          </p>
        </div>

        <div>
          <div className="flex justify-between text-2xs text-ink-3 mb-1.5 num">
            <span>Storage</span>
            <span>{storageMB} / {budgetMB} MB</span>
          </div>
          <Meter
            value={storagePct}
            size="sm"
            tone={storagePct >= 85 ? "danger" : storagePct >= 60 ? "warn" : "accent"}
          />
          {storagePct >= 85 && (
            <p className="text-2xs text-danger mt-1.5 leading-relaxed">
              Almost full. Delete old chats or media - when full, the oldest chats are removed automatically.
            </p>
          )}
        </div>
      </div>
    </>
  );

  const activeMode = MODES.find((x) => x.key === mode);

  return (
    <DashboardLayout fullBleed>
      <div className="flex h-full min-h-0">
        {/* Conversation rail (desktop) */}
        <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-line bg-surface">
          {conversationList(() => {})}
        </aside>

        {/* Conversation drawer (mobile) */}
        {drawerOpen && (
          <div className="md:hidden fixed inset-0 z-[60]">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-fade-in" onClick={() => setDrawerOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[85%] bg-surface border-r border-line shadow-overlay flex flex-col animate-slide-in-left">
              <div className="flex items-center justify-between px-3 h-14 border-b border-line shrink-0">
                <span className="text-sm font-semibold text-ink">Your chats</span>
                <IconButton label="Close" size={32} onClick={() => setDrawerOpen(false)}><X size={16} /></IconButton>
              </div>
              {conversationList(() => setDrawerOpen(false))}
            </div>
          </div>
        )}

        {/* Conversation pane */}
        <div className="flex-1 min-w-0 flex flex-col bg-page">
          {/* Pane header */}
          <div className="flex items-center gap-2 gutter h-14 shrink-0 border-b border-line bg-surface">
            <IconButton label="Your chats" className="md:hidden relative" onClick={() => setDrawerOpen(true)}>
              <PanelLeft size={18} />
              {store.conversations.length > 0 && (
                <span className="absolute top-1 right-1 min-w-[15px] h-[15px] px-0.5 rounded-full bg-accent text-on-accent text-[9px] font-bold flex items-center justify-center num">
                  {store.conversations.length}
                </span>
              )}
            </IconButton>

            <span className="flex-1 min-w-0 truncate text-sm font-medium text-ink">
              {active?.title || "New chat"}
            </span>

            <Select
              className="h-9 text-xs w-auto max-w-[100px] sm:max-w-[140px] shrink-0"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              disabled={providers.length === 0}
              aria-label="Provider"
            >
              {providers.length === 0
                ? <option value="">No {mode} providers</option>
                : providers.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>

            <Select
              className="h-9 text-xs w-auto max-w-[160px] sm:max-w-[240px] shrink-0"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={providerModels.length === 0}
              aria-label="Model"
            >
              {providerModels.length === 0
                ? <option value="">No models</option>
                : providerModels.map((m: any) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name}{m.is_free ? " (free)" : ""}
                    </option>
                  ))}
            </Select>

            <IconButton label="New chat" className="md:hidden" onClick={newChat}><Plus size={18} /></IconButton>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
            <div className="mx-auto w-full max-w-3xl gutter py-6 space-y-5">
              {!active || active.messages.length === 0 ? (
                <div className="pt-16">
                  <EmptyState
                    icon={<MessageSquare size={19} />}
                    title="Start a conversation"
                    hint="Pick a model above and send a message. Everything stays on this device - switch modes below to generate images, speech or video."
                  />
                </div>
              ) : (
                active.messages.map((m, i) => (
                  <div key={i} className={clsx("group flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
                    <div className={clsx(
                      "max-w-[88%] sm:max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                      m.role === "user"
                        ? "bg-accent text-on-accent break-words rounded-br-md"
                        : "bg-surface border border-line text-ink rounded-bl-md",
                    )}>
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
                    <div className={clsx(
                      "flex items-center gap-0.5 mt-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity",
                      m.role === "user" && "flex-row-reverse",
                    )}>
                      <IconButton label="Copy" size={28} onClick={() => copyText(messageText(m.content))}><Copy size={13} /></IconButton>
                      {m.role === "user" ? (
                        <IconButton label="Edit" size={28} onClick={() => editMessage(i)}><Pencil size={13} /></IconButton>
                      ) : (
                        <IconButton label="Regenerate" size={28} onClick={() => regenerate(i)}><RefreshCw size={13} /></IconButton>
                      )}
                      <IconButton label="Delete" size={28} tone="danger" onClick={() => deleteMessage(i)}><Trash2 size={13} /></IconButton>
                    </div>
                  </div>
                ))
              )}

              {streaming && (
                <div className="flex justify-start">
                  <div className="max-w-[88%] sm:max-w-[85%] rounded-2xl rounded-bl-md px-4 py-3 text-sm bg-surface border border-line text-ink">
                    {liveText ? <Markdown text={liveText} /> : (
                      <span className="text-ink-2 inline-flex items-center gap-2">
                        <RefreshCw size={13} className="animate-spin" />
                        {mode === "text" ? "Thinking..." : `Generating ${mode}...`}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Composer */}
          <div className="shrink-0 border-t border-line bg-surface">
            <div className="mx-auto w-full max-w-3xl gutter py-3">
              {/* Mode switcher */}
              <div className="flex items-center gap-1 mb-2.5 overflow-x-auto scroll-x">
                {MODES.map((md) => (
                  <button
                    key={md.key}
                    onClick={() => setMode(md.key)}
                    disabled={streaming}
                    aria-pressed={mode === md.key}
                    className={clsx(
                      "inline-flex items-center gap-1.5 text-xs font-medium px-3 h-7 rounded-full whitespace-nowrap transition-colors disabled:opacity-50",
                      mode === md.key
                        ? "bg-accent/12 text-accent-ink"
                        : "text-ink-2 hover:text-ink hover:bg-ink/[0.05]",
                    )}
                  >
                    {md.icon} {md.label}
                  </button>
                ))}
              </div>

              {/* Audio controls */}
              {mode === "audio" && modeModels.length > 0 && (
                <div className="mb-2.5 rounded-xl border border-line bg-sunken p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="text-2xs text-ink-2">Speaker</label>
                    <Select
                      className="h-8 text-xs w-auto max-w-[220px]"
                      value={voice}
                      onChange={(e) => setVoice(e.target.value)}
                    >
                      {isElevenlabs
                        ? (elVoices || []).map((v) => (
                            <option key={v.voice_id} value={v.voice_id}>
                              {v.name}{v.labels?.gender ? ` (${v.labels.gender})` : ""}
                            </option>
                          ))
                        : OPENAI_VOICES.map((v) => <option key={v} value={v}>{v}</option>)}
                    </Select>

                    {isElevenlabs && (
                      <>
                        <button
                          onClick={() => setShowVoiceSettings((s) => !s)}
                          className="text-2xs text-accent-ink hover:underline inline-flex items-center gap-1"
                        >
                          <Sliders size={12} /> Voice settings
                        </button>
                        <span className="w-px h-3.5 bg-line" />
                        <button
                          onClick={() => audioFileRef.current?.click()}
                          className="text-2xs text-accent-ink hover:underline inline-flex items-center gap-1"
                          title="Convert an audio clip into this speaker's voice"
                        >
                          <AudioLines size={12} /> Convert audio
                        </button>
                        <button
                          onClick={() => setCloneOpen(true)}
                          className="text-2xs text-accent-ink hover:underline inline-flex items-center gap-1"
                          title="Clone a new voice from samples"
                        >
                          <Sparkles size={12} /> Clone voice
                        </button>
                        {!elVoices && <span className="text-2xs text-ink-3">Loading speakers...</span>}
                      </>
                    )}
                    <input
                      ref={audioFileRef} type="file" accept="audio/*,video/*" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) setSourceAudio({ name: f.name, file: f }); e.target.value = ""; }}
                    />
                  </div>

                  {sourceAudio && (
                    <div className="mt-2.5 flex items-center gap-2 text-xs text-ink-2 rounded-lg border border-line bg-surface px-3 py-2">
                      <AudioLines size={14} className="text-accent-ink shrink-0" />
                      <span className="flex-1 truncate">
                        Convert <span className="font-medium text-ink">{sourceAudio.name}</span> to the selected speaker. Press send.
                      </span>
                      <IconButton label="Remove clip" size={26} tone="danger" onClick={() => setSourceAudio(null)}><X size={13} /></IconButton>
                    </div>
                  )}

                  {isElevenlabs && showVoiceSettings && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-line">
                      <SliderRow label="Stability" value={voiceSettings.stability}
                        onChange={(v) => setVoiceSettings((s) => ({ ...s, stability: v }))} />
                      <SliderRow label="Similarity" value={voiceSettings.similarity_boost}
                        onChange={(v) => setVoiceSettings((s) => ({ ...s, similarity_boost: v }))} />
                      <SliderRow label="Style" value={voiceSettings.style}
                        onChange={(v) => setVoiceSettings((s) => ({ ...s, style: v }))} />
                      <div className="sm:col-span-3">
                        <Checkbox
                          checked={voiceSettings.use_speaker_boost}
                          onChange={(v) => setVoiceSettings((s) => ({ ...s, use_speaker_boost: v }))}
                          label="Speaker boost"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Attachments */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2.5">
                  {attachments.map((a, i) => (
                    <div key={i} className="relative">
                      <img src={a.url} alt={a.name} className="h-14 w-14 object-cover rounded-lg border border-line" />
                      <button
                        onClick={() => setAttachments((prev) => prev.filter((_, k) => k !== i))}
                        aria-label={`Remove ${a.name}`}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-raised border border-line text-ink-2 hover:text-danger flex items-center justify-center shadow-xs"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Input row */}
              <div className="flex items-end gap-2">
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                {mode === "text" && (
                  <IconButton label="Attach an image" size={40} onClick={() => fileRef.current?.click()}
                    className="border border-line bg-surface">
                    <Paperclip size={16} />
                  </IconButton>
                )}
                <textarea
                  ref={textareaRef}
                  className="input flex-1 resize-none py-2.5 leading-6"
                  rows={1}
                  style={{ minHeight: 40, maxHeight: COMPOSER_MAX_HEIGHT }}
                  placeholder={activeMode?.placeholder}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                />
                {streaming ? (
                  mode === "text" ? (
                    <IconButton label="Stop generating" size={40} onClick={() => { stopRef.current = true; }}
                      className="border border-line bg-surface">
                      <Square size={15} />
                    </IconButton>
                  ) : (
                    <Button variant="primary" disabled className="h-10 w-10 !px-0" title="Generating">
                      <RefreshCw size={16} className="animate-spin" />
                    </Button>
                  )
                ) : (
                  <Button
                    variant="primary"
                    className="h-10 w-10 !px-0"
                    title="Send"
                    aria-label="Send"
                    onClick={send}
                    disabled={
                      (!input.trim() && attachments.length === 0 && !(mode === "audio" && sourceAudio)) ||
                      (mode !== "text" && modeModels.length === 0)
                    }
                  >
                    <Send size={16} />
                  </Button>
                )}
              </div>

              <p className="text-2xs text-ink-3 mt-2 leading-relaxed">
                {mode !== "text"
                  ? (modeModels.length === 0
                      ? `No ${mode} models are enabled yet. An admin can enable one under Model Control.`
                      : `Generates ${mode} from your prompt. Results are kept only in this browser.`)
                  : "Enter to send, Shift+Enter for a new line."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Voice cloning */}
      <Modal
        open={cloneOpen}
        onClose={() => !cloning && setCloneOpen(false)}
        title="Clone a voice"
        description="Upload one or more clean samples - about a minute of clear speech works well. The new voice becomes available as a speaker."
        icon={<Sparkles size={17} />}
        footer={
          <>
            <Button variant="ghost" disabled={cloning} onClick={() => setCloneOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={cloning}
              disabled={!cloneName.trim() || cloneSamples.length === 0}
              onClick={doCloneVoice}
              icon={<Sparkles size={14} />}
            >
              Clone voice
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Voice name" required>
            <Input value={cloneName} onChange={(e) => setCloneName(e.target.value)} placeholder="e.g. My voice" />
          </Field>
          <Field
            label="Samples"
            required
            hint={cloneSamples.length > 0
              ? `${cloneSamples.length} sample${cloneSamples.length > 1 ? "s" : ""} selected`
              : "Audio files only."}
          >
            <input
              type="file" accept="audio/*" multiple
              className="input text-xs py-2 file:mr-3 file:rounded-md file:border-0 file:bg-accent/12 file:px-2.5 file:py-1 file:text-xs file:text-accent-ink file:font-medium"
              onChange={(e) => setCloneSamples(Array.from(e.target.files || []))}
            />
          </Field>
        </div>
      </Modal>
    </DashboardLayout>
  );
}

// EOF silkllm-frontend/src/pages/user/Chat.tsx
