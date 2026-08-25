/**
 * Multimodal.tsx
 * Dedicated page for image, audio and video generation - previously one
 * homepage section (Voice()) plus one /docs tab, neither reachable for
 * someone searching "text to speech api pay as you go" or "ai image
 * generation api multiple providers" who has never heard of SilkLLM.
 *
 * Facts, endpoints and code are pulled from the "Multimodal" section of
 * Docs.tsx rather than restated from memory.
 */

// File: silkllm-frontend/src/pages/public/Multimodal.tsx

import React from "react";
import { Link } from "react-router-dom";
import { AudioLines, Image as ImageIcon, Mic, Video, Wand2 } from "lucide-react";
import { PublicFooter, PublicNav } from "@/components/public/PublicChrome";
import { CodeBlock, Para, H2, DocTable, Callout, Pill, FAQItem, PageHero } from "@/components/public/Prose";
import { useSEO } from "@/lib/seo";

const MODALITIES = [
  { icon: <ImageIcon size={18} />, name: "Image generation", desc: "Generate images across providers that support it, priced per image." },
  { icon: <AudioLines size={18} />, name: "Text to speech", desc: "ElevenLabs and OpenAI TTS voices, priced per character." },
  { icon: <Mic size={18} />, name: "Voice cloning", desc: "Clone a speaker from your own audio samples, then generate speech in that voice." },
  { icon: <Wand2 size={18} />, name: "Speech to speech", desc: "Convert an existing audio clip into a chosen voice, priced per second of source audio." },
  { icon: <Video size={18} />, name: "Video generation", desc: "Video generation through the same endpoint pattern, where a provider supports it." },
];

const FAQS = [
  {
    q: "Does multimodal generation use the same balance and key as text?",
    a: "Yes. Image, audio and video share the same routing, billing and marketplace as text generation - one key, one balance, no separate signup or pricing plan.",
  },
  {
    q: "How is it priced?",
    a: "Per unit: per image, per character for text-to-speech, per second of source audio for speech-to-speech - each at the provider's real cost plus SilkLLM's standard 10% markup, same as text.",
  },
  {
    q: "Which providers can I use for voice?",
    a: "ElevenLabs, for expressive speech with cloning and speech-to-speech, and OpenAI's fixed TTS voices (alloy, echo, fable, onyx, nova, shimmer). Add your own ElevenLabs key under Admin, Providers to enable its voice models.",
  },
  {
    q: "Can I list the available voices before generating?",
    a: "Yes - list_voices() returns every speaker on your ElevenLabs account, including any you've cloned, so you can pick a voice_id before calling generate_audio.",
  },
];

const FAQ_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function Multimodal() {
  useSEO({
    title: "Image, Voice & Video Generation API — Pay As You Go | SilkLLM",
    description:
      "Generate images, text-to-speech, cloned voices and video through the same key and balance you already use for text - priced per unit, no separate plan.",
    path: "/multimodal",
    jsonLd: FAQ_JSONLD,
  });

  return (
    <div className="min-h-[100dvh] bg-page text-ink overflow-x-clip">
      <PublicNav />

      <div className="mx-auto max-w-[760px] gutter pt-28 pb-20">
        <PageHero
          eyebrow="Multimodal"
          title="One key for text, image, audio and video"
          subtitle="Every modality shares the same endpoint pattern, the same balance and the same marketplace as text generation. No separate account, no separate pricing plan."
          cta={
            <>
              <Link to="/login" className="btn-primary h-10 px-5 text-sm">Get started free</Link>
              <Link to="/docs#multimodal" className="btn-secondary h-10 px-5 text-sm">Read the API reference</Link>
            </>
          }
        />

        <H2>What you can generate</H2>
        <div className="grid sm:grid-cols-2 gap-4 my-2">
          {MODALITIES.map((m) => (
            <div key={m.name} className="rounded-xl border border-line bg-surface p-5">
              <span className="w-8 h-8 rounded-lg bg-accent/10 text-accent-ink flex items-center justify-center mb-3">{m.icon}</span>
              <p className="text-sm font-semibold text-ink">{m.name}</p>
              <p className="text-sm text-ink-2 mt-1 leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>

        <H2>Image and audio</H2>
        <CodeBlock lang="python" code={`# Image
img = client.generate_image(prompt="a silk ribbon", model="dall-e-3", n=2)
print(img.count, img.images)

# Audio (text to speech), base64
audio = client.generate_audio(prompt="Hello from SilkLLM", model="tts-1")
print(audio.format, len(audio.audio_b64))`} />

        <H2>Voices and speakers</H2>
        <Para>
          For expressive speech, pick an ElevenLabs model and speaker, and shape delivery
          with voice settings (stability, similarity, style, speaker boost). OpenAI TTS
          uses fixed voice names instead of a speaker list.
        </Para>
        <CodeBlock lang="python" code={`voices = client.list_voices()  # provider="elevenlabs" by default
for v in voices:
    print(v.voice_id, v.name, v.labels)

audio = client.generate_audio(
    prompt="Welcome to SilkLLM. One key, every model.",
    model="eleven_multilingual_v2",
    voice=voices[0].voice_id,
)`} />

        <H2>Voice cloning and speech-to-speech</H2>
        <Para>
          Clone a speaker from your own audio samples, then use it for text-to-speech or to
          convert an existing clip into that voice. Conversion is priced per second of
          source audio.
        </Para>

        <H2>Endpoints</H2>
        <DocTable
          headers={["Method", "Path", "Description"]}
          rows={[
            ["POST", "/api/generate/image", "Image generation"],
            ["POST", "/api/generate/audio", "Text to speech"],
            ["POST", "/api/generate/video", "Video generation, where supported"],
            ["GET", "/api/generate/audio/voices", "List ElevenLabs speakers"],
            ["POST", "/api/generate/audio/speech-to-speech", "Voice conversion"],
            ["POST", "/api/generate/audio/clone-voice", "Clone a voice from samples"],
          ]}
        />
        <Callout>
          Free models are billed at <Pill>$0</Pill> while an active trial covers the
          request. Once you're paying from balance, every model - free or not - is billed
          like any other; a free model's provider cost is near zero, so the charge is tiny,
          but a request still needs credit.
        </Callout>

        <H2>Frequently asked</H2>
        <div>
          {FAQS.map((f) => <FAQItem key={f.q} q={f.q} a={f.a} />)}
        </div>

        <div className="mt-14 pt-8 border-t border-line text-center">
          <p className="text-sm text-ink-2 mb-4">Generate your first image or voice clip in a minute.</p>
          <Link to="/login" className="btn-primary h-10 px-6 text-sm inline-flex">Get started free</Link>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}

// EOF silkllm-frontend/src/pages/public/Multimodal.tsx
