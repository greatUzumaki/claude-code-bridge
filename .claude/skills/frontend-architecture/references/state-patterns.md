# State Patterns & Anti-Patterns

## State classification decision tree

```
Is the data owned by the server (could another client change it)?
  → YES: it is SERVER STATE. Use a query/cache library. Do not mirror it in a store.
Does it belong in a shareable/bookmarkable view (filters, tab, selected id, page)?
  → YES: it is URL STATE. Put it in path/query params.
Is it used by exactly one component (and its render-only children)?
  → YES: it is LOCAL STATE. Keep it local.
Is it cross-cutting and read by many distant components (theme, session, flags)?
  → YES: it is SHARED CLIENT STATE. Use context (low-frequency) or a store with selectors.
```

When unsure between local and shared, start local. Lift only when a second consumer actually appears (YAGNI).

## Derived state — do not store what you can compute

Storing values that can be derived from existing state creates two sources of truth that drift.

```
// Anti-pattern: synced state
const [items, setItems] = useState([])
const [count, setCount] = useState(0)        // drifts from items
useEffect(() => setCount(items.length), [items])

// Correct: derive at render
const [items, setItems] = useState([])
const count = items.length                    // always correct, no effect
```

Memoize a derivation only when it is provably expensive AND on a hot path. Premature memoization adds noise and its own bugs (stale deps).

## Effect-as-setter anti-pattern

An effect whose only job is to call a setter in response to a prop/state change is almost always wrong. It causes an extra render and can loop. Prefer:
- **Derive during render** if it is a pure function of existing state.
- **Compute in the event handler** if it is a response to a user action.
- **Key-reset** to reset state when an identity changes (`<Profile key={userId} />`).

Legitimate effect uses: synchronizing with an *external* system (subscriptions, DOM measurement, timers, network not covered by a query lib).

## Prop drilling fixes (in order of preference)

1. **Move state down** — if only a deep subtree uses it, it does not belong at the top.
2. **Composition / slots** — pass the rendered element as `children` so the parent supplies data without intermediate components forwarding props.
3. **Context** — for genuinely cross-cutting, low-frequency values read in many places.
4. **Store with selectors** — for cross-cutting, frequently-updated values where context would cause re-render storms.

Reaching for context/store at level 2 of drilling is overkill; reaching for it at level 5 is overdue.

## Global store hygiene

- Split stores by domain (`authStore`, `cartStore`) rather than one mega-store.
- Read with selectors so a component re-renders only when its slice changes.
- Keep actions/mutations colocated with the slice they mutate.
- Do not put server-cache data in the store — let the query layer own it.

## Forms

- Keep in-progress input as local state (or a form library's field state), not global.
- Validate on blur/submit, not on every keystroke, for better UX and fewer renders.
- Treat submit as an async action with explicit loading/error/success states; never swallow the error.

## Re-render triage

When a UI re-renders too much:
1. Is state too high? Move it down.
2. Unstable references passed as props/deps? Stabilize (the value, not reflexively `useMemo` everything).
3. Context carrying a frequently-changing value? Split the context or move to a selector store.
4. Large list re-rendering wholesale? Virtualize and key correctly.
