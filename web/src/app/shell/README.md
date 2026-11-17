# App shell

The frame around every route: top bar, navigation, menus and notices. `app-frame.tsx` is imported by `web/src/app/router.tsx`.

## Files at the root

- `app-frame.tsx`: composes the frame around the route outlet.
- `app-frame.module.css`: styles of the frame.
- `app-frame.test.tsx`: tests of the frame.

## Folders

- `account-menu/`: account menu, its book list and identity rows.
- `calculator/`: floating calculator: its window, the account text, the exact arithmetic and the place of the window (`docs/specs/2026-11-17-floating-calculator-design.md`).
- `books/`: `use-books.ts` (book list hook) and `more-books.tsx` (book list of the phone sheet).
- `command-menu/`: command menu.
- `desktop-nav/`: navigation rail of wide screens, its commands and the stored navigation preference.
- `destinations/`: destination list, route matching, press handling, icons and the uncategorized count.
- `frame-state/`: hooks that hold the state of the frame (editing, entry, extent, scroll).
- `phone-dock/`: bottom dock of phone screens and the "more" sheet.
- `phone-gate/`: gate that shows the wide-screen notice for desktop-only routes, and the width hook.
- `read-only-notice/`: notice shown to read-only members.
- `top-app-bar/`: top bar and the privacy toggle.
