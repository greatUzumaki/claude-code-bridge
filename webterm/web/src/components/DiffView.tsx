import { diffLines } from "diff";

// Drop a single trailing newline so the last line isn't rendered as a phantom empty row.
function splitLines(v: string): string[] {
  const s = v.endsWith("\n") ? v.slice(0, -1) : v;
  return s.split("\n");
}

// ── Unified (inline) ────────────────────────────────────────────────────────
type UniRow = { type: "same" | "add" | "del"; text: string; lo?: number; ln?: number };

function unifiedRows(oldText: string, newText: string): UniRow[] {
  const rows: UniRow[] = [];
  let lo = 0;
  let ln = 0;
  for (const c of diffLines(oldText, newText)) {
    const lines = splitLines(c.value);
    if (c.added) {
      for (const t of lines) rows.push({ type: "add", text: t, ln: ++ln });
    } else if (c.removed) {
      for (const t of lines) rows.push({ type: "del", text: t, lo: ++lo });
    } else {
      for (const t of lines) {
        rows.push({ type: "same", text: t, lo: ++lo, ln: ++ln });
      }
    }
  }
  return rows;
}

// ── Split (side-by-side) ────────────────────────────────────────────────────
// left = NEW, right = OLD. A removed block immediately followed by an added block is a
// replacement → its lines are zipped onto the same rows so the panes stay aligned.
type SplitRow = {
  type: "same" | "add" | "del" | "mod";
  left?: string;
  right?: string;
  lnew?: number;
  lold?: number;
};

function splitRows(oldText: string, newText: string): SplitRow[] {
  const changes = diffLines(oldText, newText);
  const rows: SplitRow[] = [];
  let lold = 0;
  let lnew = 0;
  for (let i = 0; i < changes.length; i++) {
    const c = changes[i];
    const lines = splitLines(c.value);
    if (!c.added && !c.removed) {
      for (const t of lines) rows.push({ type: "same", left: t, right: t, lnew: ++lnew, lold: ++lold });
      continue;
    }
    if (c.removed) {
      const next = changes[i + 1];
      if (next?.added) {
        const adds = splitLines(next.value);
        const n = Math.max(lines.length, adds.length);
        for (let k = 0; k < n; k++) {
          const left = k < adds.length ? adds[k] : undefined;
          const right = k < lines.length ? lines[k] : undefined;
          rows.push({
            type: "mod",
            left,
            right,
            lnew: left !== undefined ? ++lnew : undefined,
            lold: right !== undefined ? ++lold : undefined,
          });
        }
        i++; // consumed the paired added block
      } else {
        for (const t of lines) rows.push({ type: "del", right: t, lold: ++lold });
      }
      continue;
    }
    // pure addition
    for (const t of lines) rows.push({ type: "add", left: t, lnew: ++lnew });
  }
  return rows;
}

const lnCls = "select-none shrink-0 w-10 pr-2 text-right text-muted/60 tabular-nums";

// Per-side cell classes for the split view (left = new/green, right = old/red).
function splitCellCls(side: "left" | "right", r: SplitRow): string {
  const text = side === "left" ? r.left : r.right;
  const filled =
    side === "left"
      ? (r.type === "add" || r.type === "mod") && r.left !== undefined
      : (r.type === "del" || r.type === "mod") && r.right !== undefined;
  const empty = text === undefined;
  return [
    "flex flex-1 min-w-0 whitespace-pre border-border",
    side === "left" ? "border-r" : "",
    empty ? "bg-white/[0.02]" : filled ? (side === "left" ? "bg-green-500/15" : "bg-red-500/15") : "",
    filled ? (side === "left" ? "text-green-200" : "text-red-200") : "text-text",
  ].join(" ");
}

export function DiffView({
  oldText,
  newText,
  mode,
}: {
  oldText: string;
  newText: string;
  mode: "unified" | "split";
}) {
  if (mode === "unified") {
    const rows = unifiedRows(oldText, newText);
    return (
      <div className="h-full overflow-auto font-mono text-[12px] leading-5">
        {rows.map((r, i) => (
          <div
            key={i}
            className={[
              "flex whitespace-pre",
              r.type === "add"
                ? "bg-green-500/15 text-green-200"
                : r.type === "del"
                  ? "bg-red-500/15 text-red-200"
                  : "text-text",
            ].join(" ")}
          >
            <span className={lnCls}>{r.lo ?? ""}</span>
            <span className={lnCls}>{r.ln ?? ""}</span>
            <span className="w-4 shrink-0 select-none text-center text-muted">
              {r.type === "add" ? "+" : r.type === "del" ? "−" : " "}
            </span>
            <span className="flex-1 pr-3">{r.text || " "}</span>
          </div>
        ))}
      </div>
    );
  }

  const rows = splitRows(oldText, newText);
  return (
    <div className="h-full overflow-auto font-mono text-[12px] leading-5">
      {rows.map((r, i) => (
        <div key={i} className="flex min-w-max">
          <div className={splitCellCls("left", r)}>
            <span className={lnCls}>{r.lnew ?? ""}</span>
            <span className="flex-1 pr-3">{r.left ?? ""}</span>
          </div>
          <div className={splitCellCls("right", r)}>
            <span className={lnCls}>{r.lold ?? ""}</span>
            <span className="flex-1 pr-3">{r.right ?? ""}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
