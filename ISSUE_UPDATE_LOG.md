# Issue / Update Log

This file tracks issues or updates found during work on this project and the fixes applied.
It should be updated after each fix.

## 2026-05-14

### Resolved: `npm run dev` could not find `vite`

- Status: Resolved
- Found: Running `npm run dev` failed because the local `vite` binary was unavailable.
- Cause: `node_modules` was missing even though `package-lock.json` existed.
- Fix: Ran `npm install` to install project dependencies.
- Verification: `npm run dev` starts Vite successfully at `http://127.0.0.1:5173/`.

### Resolved: React lint error from `Date.now()` during render

- Status: Resolved
- Found: `npm run lint` reported `react-hooks/purity` in `src/pages/Reservation.jsx`.
- Cause: The date input `min` value called `Date.now()` during render.
- Fix: Added a `minFreeDate` state initializer that computes tomorrow once, then reused it in the date input.
- Verification: `npm run lint` no longer reports this error.

### Resolved: React lint error from synchronous state update in effect

- Status: Resolved
- Found: `npm run lint` reported `react-hooks/set-state-in-effect` in `src/pages/Reservation.jsx`.
- Cause: The selected pack from the URL was copied into form state inside `useEffect`.
- Fix: Derived the initial pack before state initialization and used it directly in the initial form state.
- Verification: `npm run lint` passes.

### Current Verification

- `npm run build`: Passing
- `npm run lint`: Passing
- Local dev server: Running at `http://127.0.0.1:5173/`

### Resolved: Home page UI/UX needed production redesign

- Status: Resolved
- Found: The home page had weak visual hierarchy, generic cards, limited service routing, inconsistent spacing, and corrupted French display text.
- Cause: The original page used a basic section stack with minimal responsive polish and several inline presentation styles.
- Fix: Rebuilt the home page with a stronger image-led hero, clear primary actions, proof points, benefit cards, service entry cards, popular pack cards, portfolio preview, testimonials, and a final booking CTA using the existing design tokens and button system.
- Files updated: `src/pages/Home.jsx`, `src/pages/Home.css`
- Verification: `npm run lint` passes, `npm run build` passes, and the dev server returns HTTP 200 at `http://127.0.0.1:5173/`.

### Resolved: Popular pack reservation links used incorrect pack IDs

- Status: Resolved
- Found: Home page pack CTAs linked to pack IDs that did not match the reservation data.
- Cause: `Classic Propre`, `Pack Signature`, and `Duo / Couple` were linked to old IDs.
- Fix: Updated the links to `/reservation?pack=4`, `/reservation?pack=5`, and `/reservation?pack=7`.
- Verification: `npm run lint` passes and `npm run build` passes.
