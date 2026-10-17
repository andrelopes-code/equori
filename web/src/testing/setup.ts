import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

import { setViewport } from "@/testing/viewport";

beforeEach(() => {
  // jsdom does not implement scrollTo; the router restores scroll on navigation.
  window.scrollTo = () => undefined;
  setViewport(1280);
});

afterEach(() => {
  cleanup();
});
