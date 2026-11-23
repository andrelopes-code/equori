const refresh = /state\.value = value;\s+refresh\(\);/;

// The source of @univerjs/ui with one function changed: useObservable skips an emitted value equal
// to the one on screen. It drew its component again on every emission. A move between cells emits
// about 135 values, nearly all equal, and the whole toolbar was drawn again for them. Only a
// primitive is skipped: Univer also emits objects it changed in place.
export function skipEqualValues(source: string): string {
  if (!refresh.test(source))
    throw new Error("useObservable of @univerjs/ui changed (ADR 038, E14)");

  return source.replace(
    refresh,
    (found) =>
      `if (Object(value) !== value && Object.is(state.value, value)) return; ${found}`,
  );
}
