// The screen of a desktop: the application is laid out as on a 1920 px monitor, so no control
// wraps and no layout for a narrow screen shows (owner, 2026-11-18). It lives apart from app.mjs
// so that the check, which runs without playwright, reads it.
export const VIEW = { width: 1920, height: 1200 };
