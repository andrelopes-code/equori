import { useCallback, useEffect, useRef, useState } from "react";

import { useStableCallback } from "@/ui/use-stable-callback";

// The part of the Web Speech API's SpeechRecognition the composer uses; the DOM library of
// TypeScript does not declare it.
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((event: {
        resultIndex: number;
        results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
      }) => void)
    | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type RecognitionClass = new () => Recognition;

function recognitionClass(): RecognitionClass | undefined {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionClass;
    webkitSpeechRecognition?: RecognitionClass;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

// Whether this browser can dictate; Firefox has no recognition engine.
export function speechSupported(): boolean {
  return recognitionClass() !== undefined;
}

export interface SpeechInput {
  // False where the browser has no recognition engine (Firefox): the composer offers no dictation.
  supported: boolean;
  listening: boolean;
  toggle: () => void;
}

// Dictation through the browser's own speech recognition, in the app's language. Each final
// phrase goes to onText; the engine may send the audio to the browser's vendor, which the
// panel's notice states.
export function useSpeechInput(
  lang: string,
  onText: (text: string) => void,
): SpeechInput {
  const [listening, setListening] = useState(false);
  const engine = useRef<Recognition | null>(null);
  const deliver = useStableCallback(onText);

  useEffect(
    () => () => {
      engine.current?.abort();
    },
    [],
  );

  const toggle = useCallback(() => {
    if (engine.current !== null) {
      engine.current.stop();
      return;
    }
    const Engine = recognitionClass();
    if (Engine === undefined) return;
    const r = new Engine();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result?.isFinal === true) {
          const text = result[0].transcript.trim();
          if (text !== "") deliver(text);
        }
      }
    };
    const end = () => {
      engine.current = null;
      setListening(false);
    };
    r.onend = end;
    r.onerror = end;
    engine.current = r;
    r.start();
    setListening(true);
  }, [lang, deliver]);

  return { supported: speechSupported(), listening, toggle };
}
