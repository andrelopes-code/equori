import { describe, expect, it } from "vitest";

import { videoTime } from "@/features/help/video/video-time";

describe("the time of the help video", () => {
  it("writes minutes and two digits of seconds", () => {
    expect(videoTime(0, "en")).toBe("0:00");
    expect(videoTime(4.9, "pt-BR")).toBe("0:04");
    expect(videoTime(83.2, "en")).toBe("1:23");
  });
});
