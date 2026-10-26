// P1 of ADR 022: the worker registers only in a secure context and only in the production build;
// the development server serves no /sw.js of its own build.
export function registerServiceWorker(env: {
  prod: boolean;
  secure: boolean;
  container: { register(url: string): Promise<unknown> } | undefined;
}): void {
  if (!env.prod || !env.secure || env.container === undefined) return;
  void env.container.register("/sw.js");
}
