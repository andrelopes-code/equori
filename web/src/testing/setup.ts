import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

import { setViewport } from "@/testing/viewport";

beforeEach(() => {
  setViewport(1280);
});

afterEach(() => {
  cleanup();
});
