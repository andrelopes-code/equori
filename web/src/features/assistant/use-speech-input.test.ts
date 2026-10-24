import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSpeechInput } from "@/features/assistant/use-speech-input";

interface FakeResult {
  isFinal: boolean;
  0: { transcript: string };
}

class FakeRecognition {
  static last: FakeRecognition | undefined;
  lang = "";
  continuous = false;
  interimResults = true;
  onresult:
    ((event: { resultIndex: number; results: FakeResult[] }) => void) | null =
    null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  start = vi.fn();
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn();
  constructor() {
    FakeRecognition.last = this;
  }
}

function install() {
  Object.assign(window, { SpeechRecognition: FakeRecognition });
}

afterEach(() => {
  Reflect.deleteProperty(window, "SpeechRecognition");
  FakeRecognition.last = undefined;
});

describe("useSpeechInput", () => {
  it("is unsupported without a recognition engine", () => {
    const { result } = renderHook(() => useSpeechInput("pt-BR", vi.fn()));
    expect(result.current.supported).toBe(false);
  });

  it("listens in the app's language and hands over each final phrase", () => {
    install();
    const onText = vi.fn();
    const { result } = renderHook(() => useSpeechInput("pt-BR", onText));
    expect(result.current.supported).toBe(true);
    act(() => {
      result.current.toggle();
    });
    const engine = FakeRecognition.last;
    expect(engine?.lang).toBe("pt-BR");
    expect(engine?.start).toHaveBeenCalledOnce();
    expect(result.current.listening).toBe(true);
    act(() => {
      engine?.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: false, 0: { transcript: "quanto" } }],
      });
      engine?.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: "quanto gastei" } }],
      });
    });
    expect(onText).toHaveBeenCalledExactlyOnceWith("quanto gastei");
  });

  it("stops on a second toggle", () => {
    install();
    const { result } = renderHook(() => useSpeechInput("en-US", vi.fn()));
    act(() => {
      result.current.toggle();
    });
    act(() => {
      result.current.toggle();
    });
    expect(FakeRecognition.last?.stop).toHaveBeenCalledOnce();
    expect(result.current.listening).toBe(false);
  });

  it("says the microphone is blocked when the browser denies it", () => {
    install();
    const { result } = renderHook(() => useSpeechInput("pt-BR", vi.fn()));
    act(() => {
      result.current.toggle();
    });
    act(() => {
      FakeRecognition.last?.onerror?.({ error: "not-allowed" });
      FakeRecognition.last?.onend?.();
    });
    expect(result.current.listening).toBe(false);
    expect(result.current.error).toBe("denied");
    expect(result.current.supported).toBe(true);
  });

  // Chromium builds without the speech service (Brave, Chromium on Linux) expose the API and
  // fail at once with "network": dictation is withdrawn instead of flickering on each press.
  it("withdraws dictation when the browser has no speech service", () => {
    install();
    const { result } = renderHook(() => useSpeechInput("pt-BR", vi.fn()));
    act(() => {
      result.current.toggle();
    });
    act(() => {
      FakeRecognition.last?.onerror?.({ error: "network" });
      FakeRecognition.last?.onend?.();
    });
    expect(result.current.error).toBe("unavailable");
    expect(result.current.supported).toBe(false);
  });

  it("clears the error on the next start", () => {
    install();
    const { result } = renderHook(() => useSpeechInput("pt-BR", vi.fn()));
    act(() => {
      result.current.toggle();
    });
    act(() => {
      FakeRecognition.last?.onerror?.({ error: "no-speech" });
      FakeRecognition.last?.onend?.();
    });
    expect(result.current.error).toBe("silence");
    act(() => {
      result.current.toggle();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.listening).toBe(true);
  });
});
