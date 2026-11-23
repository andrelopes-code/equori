import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { compileFunction } from "node:vm";

import { act, renderHook } from "@testing-library/react";
import { useLayoutEffect, useReducer, useRef } from "react";
import { expect, test } from "vitest";

import { skipEqualValues } from "@/features/spreadsheets/editor/univer-equal-values";

interface Source<T> {
  subscribe: (observer: (value: T) => void) => { unsubscribe: () => void };
}

type UseObservable = <T>(source: Source<T>, initial: T) => T;

test("draws again when Univer emits another value", () => {
  const { next, result, draws } = observed<boolean>(false);

  act(() => {
    next(true);
  });

  expect(result.current).toBe(true);
  expect(draws()).toBe(2);
});

test("does not draw again when Univer emits the value on screen", () => {
  const { next, result, draws } = observed<boolean>(false);

  act(() => {
    next(false);
    next(false);
  });

  expect(result.current).toBe(false);
  expect(draws()).toBe(1);
});

test("draws again when Univer emits an object changed in place", () => {
  const list: string[] = [];
  const { next, draws } = observed(list);

  act(() => {
    list.push("rule");
    next(list);
  });

  expect(draws()).toBe(2);
});

test("refuses a source whose useObservable has another text", () => {
  expect(() => skipEqualValues("function useObservable() {}")).toThrow(
    "useObservable of @univerjs/ui changed (ADR 038, E14)",
  );
});

function observed<T>(initial: T) {
  const useObservable = patchedHook();
  const observers = new Set<(value: T) => void>();
  const source: Source<T> = {
    subscribe: (observer) => {
      observers.add(observer);

      return { unsubscribe: () => observers.delete(observer) };
    },
  };
  let count = 0;

  const { result } = renderHook(() => {
    count++;

    return useObservable(source, initial);
  });

  function next(value: T) {
    observers.forEach((observer) => {
      observer(value);
    });
  }

  return { next, result, draws: () => count };
}

// The hook alone, cut out of the installed module: the whole module takes a minute to load on a
// busy machine.
function patchedHook(): UseObservable {
  const source = skipEqualValues(readFileSync(univerUI(), "utf8"));
  const start = source.indexOf("function useObservable(");
  const end = source.indexOf("\n}\n", start) + 2;
  const compile = compileFunction(
    `${source.slice(start, end)}\nreturn useObservable;`,
    ["useRef", "useReducer", "useLayoutEffect", "unwrap"],
  ) as (...scope: unknown[]) => UseObservable;

  return compile(useRef, useReducer, useLayoutEffect, (o: unknown) => o);
}

// @univerjs/ui is a dependency of the presets, not of the application: it is resolved from them.
function univerUI(): string {
  const presets = createRequire(import.meta.url).resolve(
    "@univerjs/preset-sheets-core",
  );

  return createRequire(presets)
    .resolve("@univerjs/ui")
    .replace("/lib/cjs/", "/lib/es/");
}
