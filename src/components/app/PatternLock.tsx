import { useEffect, useRef, useState } from "react";

const SIZE = 210;
const pos = (i: number) => ({ x: 35 + (i % 3) * 70, y: 35 + Math.floor(i / 3) * 70 });

/** Cuadrícula de 9 puntos para dibujar un patrón con dedo o mouse. */
export function PatternInput({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const ref = useRef<SVGSVGElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const hit = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * SIZE, y = ((e.clientY - r.top) / r.height) * SIZE;
    setCursor({ x, y });
    return [...Array(9).keys()].find((i) => Math.hypot(pos(i).x - x, pos(i).y - y) < 24);
  };

  return (
    <div className="space-y-2">
      <svg
        ref={ref} viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-52 w-52 touch-none select-none rounded-lg border bg-muted"
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          const i = hit(e); setDrawing(true); onChange(i === undefined ? [] : [i]);
        }}
        onPointerMove={(e) => {
          if (!drawing) return;
          const i = hit(e);
          if (i !== undefined && !value.includes(i)) onChange([...value, i]);
        }}
        onPointerUp={() => { setDrawing(false); setCursor(null); }}
      >
        <PatternLines seq={value} />
        {drawing && cursor && value.length > 0 && (
          <line x1={pos(value[value.length - 1]).x} y1={pos(value[value.length - 1]).y} x2={cursor.x} y2={cursor.y}
            className="stroke-primary" strokeWidth={5} strokeLinecap="round" opacity={0.5} />
        )}
        <Dots active={value} />
      </svg>
      <div className="text-xs text-muted-foreground">
        {value.length ? `${value.length} puntos` : "Dibuja el patrón"}{" "}
        {value.length > 0 && <button type="button" className="ml-2 underline" onClick={() => onChange([])}>Borrar</button>}
      </div>
    </div>
  );
}

function Dots({ active }: { active: number[] }) {
  return <>{[...Array(9).keys()].map((i) => (
    <g key={i}>
      <circle cx={pos(i).x} cy={pos(i).y} r={10} className={active.includes(i) ? "fill-primary" : "fill-muted-foreground/40"} />
      {active[0] === i && <circle cx={pos(i).x} cy={pos(i).y} r={16} className="fill-none stroke-primary" strokeWidth={2} />}
    </g>
  ))}</>;
}

function PatternLines({ seq }: { seq: number[] }) {
  return <>{seq.slice(1).map((p, k) => (
    <line key={k} x1={pos(seq[k]).x} y1={pos(seq[k]).y} x2={pos(p).x} y2={pos(p).y}
      className="stroke-primary" strokeWidth={5} strokeLinecap="round" />
  ))}</>;
}

/** Reproduce el patrón animado desde el punto inicial hasta el final. */
export function PatternReplay({ seq }: { seq: number[] }) {
  const [n, setN] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setN((v) => (v >= seq.length + 2 ? 1 : v + 1)), 500);
    return () => clearInterval(t);
  }, [seq.length]);
  const shown = seq.slice(0, Math.min(n, seq.length));
  return (
    <div className="space-y-1">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-40 w-40 rounded-lg border bg-muted">
        <PatternLines seq={shown} />
        <Dots active={shown} />
      </svg>
      <div className="text-xs text-muted-foreground">Inicio: punto {seq[0] + 1} · Fin: punto {seq[seq.length - 1] + 1}</div>
    </div>
  );
}

export type LockType = "none" | "pin" | "pattern" | "password";
export function encodeLock(type: LockType, text: string, pattern: number[]) {
  if (type === "pin" && text) return `PIN:${text}`;
  if (type === "password" && text) return `CLAVE:${text}`;
  if (type === "pattern" && pattern.length) return `PATRON:${pattern.join(",")}`;
  return "";
}
export function decodeLock(code: string): { type: LockType; text: string; pattern: number[] } {
  if (code.startsWith("PATRON:")) return { type: "pattern", text: "", pattern: code.slice(7).split(",").map(Number) };
  if (code.startsWith("PIN:")) return { type: "pin", text: code.slice(4), pattern: [] };
  if (code.startsWith("CLAVE:")) return { type: "password", text: code.slice(6), pattern: [] };
  return { type: "password", text: code, pattern: [] };
}
