import { useEffect } from "react";

const EVENT = "equori:ask-assistant";

// A page hands a question to the assistant: the shell opens the panel and the panel places the
// question in its composer. Nothing is sent (help spec, HP12).
export function askAssistant(question: string): void {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: question }));
}

export function useAssistantAsk(onAsk: (question: string) => void): void {
  useEffect(() => {
    const listen = (event: Event) => {
      if (event instanceof CustomEvent && typeof event.detail === "string") {
        onAsk(event.detail);
      }
    };

    window.addEventListener(EVENT, listen);

    return () => {
      window.removeEventListener(EVENT, listen);
    };
  }, [onAsk]);
}
