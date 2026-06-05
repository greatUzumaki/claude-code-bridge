# Accessibility Checklist & Patterns (WCAG 2.1 AA baseline)

## Reviewable checklist

**Structure & semantics**
- [ ] Page has one `<h1>`; headings descend without skipping levels.
- [ ] Landmarks present: `<header>`, `<nav>`, `<main>`, `<footer>`. One `<main>` per page.
- [ ] Lists use `<ul>/<ol>/<li>`; tables use `<table>` with `<th scope>`.
- [ ] Interactive elements are `<button>`/`<a>`, never `<div onClick>`. Links navigate; buttons act.

**Keyboard**
- [ ] Everything operable by keyboard alone (Tab/Shift+Tab/Enter/Space/arrows).
- [ ] Visible focus indicator on every focusable element (never `outline: none` without a replacement).
- [ ] Logical tab order matches visual order; no positive `tabindex`.
- [ ] No keyboard traps. Modals trap focus while open and restore it on close.

**Forms**
- [ ] Every control has a programmatic label (`<label for>`, `aria-label`, or `aria-labelledby`).
- [ ] Required/invalid states conveyed beyond color; errors linked via `aria-describedby`.
- [ ] Group related controls with `<fieldset>/<legend>`.

**Visual**
- [ ] Text contrast ≥ 4.5:1 (≥ 3:1 for large text and UI component boundaries).
- [ ] Information not conveyed by color alone (add icon/text).
- [ ] Layout works at 200% zoom and 320px width without loss of content.
- [ ] `prefers-reduced-motion` respected for animation.

**Media & images**
- [ ] Meaningful images have descriptive `alt`; decorative images have `alt=""`.
- [ ] Icon-only controls have an accessible name.
- [ ] Video has captions; audio has transcript.

**Dynamic content**
- [ ] Live updates announced via `aria-live` (polite for status, assertive for errors).
- [ ] Route changes move focus and update the document title.

## Common ARIA patterns

Reach for ARIA only to enhance native semantics. Rule: **no ARIA is better than bad ARIA.** A native element is always preferable to a div with roles.

### Modal dialog
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby` (title id).
- On open: move focus into the dialog (first focusable or the dialog itself). Trap Tab within.
- On close: return focus to the trigger. `Esc` closes.
- Mark background content inert (`inert` attribute or `aria-hidden` on siblings).

### Disclosure (show/hide)
- Trigger is a `<button>` with `aria-expanded="true|false"` and `aria-controls="<panel id>"`.

### Tabs
- Tablist `role="tablist"`; each tab `role="tab"` with `aria-selected` and `aria-controls`.
- Panels `role="tabpanel"` with `aria-labelledby`.
- Arrow keys move between tabs; only the active tab is in the tab order (roving tabindex).

### Combobox / autocomplete
- Input `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`.
- Options `role="option"` with `aria-selected`. Arrow keys navigate; Enter selects; Esc closes.

### Menu button
- Button `aria-haspopup="menu"` + `aria-expanded`. Menu `role="menu"`, items `role="menuitem"`.
- Arrow keys navigate, Esc closes and returns focus.

## Testing
- Tab through the whole page with no mouse — can you reach and use everything?
- Run an automated checker (axe) for contrast/labels, but know it catches ~30–40%; manual keyboard + screen-reader passes find the rest.
- Test with an actual screen reader on the critical flows (VoiceOver/NVDA).
