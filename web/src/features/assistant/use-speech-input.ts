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
  onerror: ((event: { error: string }) => void) | null;
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

// Why the last dictation ended early: the reader blocked the microphone, the browser has no
// speech service behind its API, or no speech was heard.
export type SpeechError = "denied" | "unavailable" | "silence";

// The engine's error codes (Web Speech API, SpeechRecognitionErrorEvent.error) by what the
// reader can do about them; "aborted" is a stop the panel asked for.
function speechError(code: string): SpeechError | null {
  switch (code) {
    case "not-allowed":
      return "denied";
    case "no-speech":
      return "silence";
    case "aborted":
      return null;
    default:
      return "unavailable";
  }
}

export interface SpeechInput {
  // False where the browser has no recognition engine (Firefox): the composer offers no dictation.
  supported: boolean;
  // True once the engine proved to have no speech service: the microphone stays, struck and off.
  unavailable: boolean;
  listening: boolean;
  toggle: () => void;
}

// Dictation through the browser's own speech recognition, in the app's language. Each final
// phrase goes to onText; the engine may send the audio to the browser's vendor, which the
// panel's notice states.
export function useSpeechInput(
  lang: string,
  onText: (text: string) => void,
  onError: (error: SpeechError) => void,
): SpeechInput {
  const [listening, setListening] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const engine = useRef<Recognition | null>(null);
  const deliver = useStableCallback(onText);
  const fail = useStableCallback(onError);

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
    r.onend = () => {
      engine.current = null;
      setListening(false);
    };
    r.onerror = (event) => {
      const error = speechError(event.error);
      if (error === null) return;
      if (error === "unavailable") setUnavailable(true);
      fail(error);
    };
    engine.current = r;
    r.start();
    setListening(true);
  }, [lang, deliver, fail]);

  return { supported: speechSupported(), unavailable, listening, toggle };
}
