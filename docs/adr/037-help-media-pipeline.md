# ADR 037: Help figures and videos are built by a tool, never made by hand

- Status: accepted
- Date: 2026-11-18

## Context

The help pages show the screens they describe: figures with the place of a step marked, and a video of the steps (`docs/specs/2026-11-17-help-design.md`). The first figures and the first video were made by hand, and the owner rejected them on 2026-11-18:

- A screen capture of 1280 px was scaled to 62% and cut at one device pixel per CSS pixel. The text of the figure was blurred on every screen.
- The place of each mark was a percentage typed after reading a capture. Marks stood beside their element.
- The video was a recording of a live session (Playwright `recordVideo`): fixed at 1 Mbit/s, with the load of each page, the jumps of the scroll and a cut at the nearest key frame.

A method by hand fails again on the next page. The media needs a method that gives the same result on every run and that refuses a wrong result.

Alternatives read:

| Alternative | Why not |
|---|---|
| Screen recording of a live session (Playwright `recordVideo`, OBS) | The frames are whatever the session painted in real time: loads, dropped frames and scroll jumps are in the file. The bitrate of `recordVideo` is fixed. |
| Frame control of the live page (`HeadlessExperimental.beginFrame`, virtual time; the method of puppeteer-capture) | Deterministic, but it needs `chrome-headless-shell` with experimental flags, works on Linux only and still records every transition of the application. |
| Remotion | Renders a video from code, frame by frame, as this ADR does. Its licence is paid above a company size, and it brings React rendering infrastructure the task does not need. |
| A hosted demo tool (Arcade, Supademo, Scribe) | The media would be produced and edited outside the repository and could not be rebuilt by a contributor or checked by a test. |

## Decision

`tools/help-media` is the only way a figure or a video of the help is made. It is a Node package of its own, beside `web/`, with one dependency: Playwright, pinned (`tools/help-media/package.json`). It adds nothing to the web build.

1. **A tutorial is a declaration.** `tutorials/<id>.mjs` lists beats: the element a step points at, the action that follows, the figure it yields. It holds no coordinate and no delay.
2. **The data is a tape.** `record` signs in to the demo book once and stores every read of the API in `tutorials/<id>.tape.json`. `build` answers the application from the tape, with the clock fixed at the time of the recording. The answers that carry a preference of the recorded account (appearance, language) are rewritten to the variant being built. `record` refuses every request that writes, the sign-in apart. A tutorial declares in `reads` the requests with a body that change nothing (the preview of a rule); `record` sends each to the instance and stores its answer under the hash of its body, and `build` answers the same body from the tape. A tutorial stops before the request that writes, and may type in a field or choose a file of `tutorials/files/` on the way (amended 2026-11-18).
3. **The application is the production build.** `build` serves `web/dist` itself. No development server and no backend takes part.
4. **A figure is a cut, never a scaling.** The page is rendered at 1280 by 800 CSS pixels and two device pixels per CSS pixel. A figure is the 640 by 400 window around its element, 1280 by 800 device pixels. A page draws it at 640 CSS pixels or less, so its text is never enlarged. For a figure outside a dialog, the page region is held at 640 CSS pixels, the width it has beside the assistant pane: the page reflows and the figure spans its whole width, so no figure is a slice of a wider page. An element that fills the narrowed page, or does not fit in it, is cut from the page at its full width (amended 2026-11-18).
5. **A mark is measured.** The place of a mark is the box the browser reports for the element, relative to the window of the figure, written to `media.json`. The page positions the mark from that file.
6. **A frame is taken at rest.** Transitions, animations and the caret are off. A capture is taken when no answer is pending and two captures in a row are equal byte for byte.
7. **A video is composed, not recorded.** Each frame is drawn from the stills of the beats and a timeline: the whole screen, a pointer that travels to the element, the mark of the step, a ring on the click, a cross-fade to the next still. Frame n is a function of the tutorial. The frames are encoded as VP9 at constant quality, 1920 by 1200, 30 frames per second, by the ffmpeg that Playwright installs.
8. **A build refuses a wrong result.** It fails, and writes no manifest, when: an element is missing, hidden or covered; the element does not fit in the figure; the mark is smaller than 24 px or larger than 70% of the figure; the mark differs between the two schemes; a read is missing from the tape; a video exceeds 2.5 MB; the folder of the media exceeds 40 MB.
9. **Every variant is built.** Each figure and video exists per language and per scheme (`<id>.<language>.<scheme>.png`). The files of a tutorial stand in a folder of its name, since a folder of `web/src` holds at most 40 files (amended 2026-11-18). A page in English shows the application in English.
10. **The result is checked without a browser.** `check` compares every file with the hash in `media.json`, the size of every figure, the bounds of every mark, and the figures each Markdown page names. `help-pages.test.ts` holds the same link between pages and media.

## Consequences

- A change of a screen is followed by `make help-media`; a change of the data a tutorial reads, by `make help-media-record`.
- A build on the same machine and the same Chromium yields the same figures, byte for byte. Another machine can differ in font rasterization; the hashes of `media.json` show it.
- The media grows the binary: about 100 KB per figure variant and 1.7 MB per video variant; 38 MB for the five pages of 2026-11-18. `check` holds the folder under 40 MB.
- Playwright is pinned at a release whose ffmpeg encodes VP9: 1.64.0, ffmpeg 1013. The ffmpeg of 1.63.0 encodes VP8 only; the first videos were encoded by an ffmpeg that another installation had left in the cache of the machine, which a clean installation showed on 2026-11-18. A change of the pin is followed by a build in a clean checkout.
- A video is VP9 in WebM. Safari plays it from 14.1 on macOS and from 17.4 on iOS and iPadOS. The steps and their figures are the same content for a browser that does not.
- Playwright and its Chromium are needed only by a contributor who rebuilds help media. CI and the release build do not install them; `make help-media-check` runs in `make static`, in the CI job `static` and before a push.
