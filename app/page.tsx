"use client";

import {
  BatteryCharging, Check, ChevronRight, CircleHelp, Eraser, FlaskConical,
  GraduationCap, Lightbulb, MousePointer2, Pause, Play, RotateCcw, Sparkles,
  Trash2, Unplug, Volume2, Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ComponentType = "battery" | "switch" | "resistor" | "led" | "lamp" | "motor";
type Mode = "learn" | "sandbox";
type Point = { x: number; y: number };
type CircuitPart = Point & { id: string; type: ComponentType; closed?: boolean };
type Wire = { id: string; from: string; to: string };
type Pin = { id: string; partId: string; index: 0 | 1; x: number; y: number };
type Edge = { from: string; to: string; partId?: string };
type LessonContext = {
  pathParts: Set<string>; pathExists: boolean; parts: CircuitPart[];
  poweredParts: Set<string>; safeLed: boolean; correctLedPolarity: boolean;
};
type Lesson = {
  id: number; title: string; eyebrow: string; instruction: string; success: string; concept: string;
  starter: () => { parts: CircuitPart[]; wires: Wire[] };
  check: (ctx: LessonContext) => boolean;
};

const BOARD_W = 900;
const BOARD_H = 540;
const PART_W = 116;
const PART_H = 78;
const CATALOG: Record<ComponentType, { name: string; hint: string; color: string }> = {
  battery: { name: "Battery", hint: "Pushes energy", color: "#f5b82e" },
  switch: { name: "Switch", hint: "Opens the path", color: "#4bc3a8" },
  resistor: { name: "220 Ω resistor", hint: "Limits current", color: "#e88b52" },
  led: { name: "LED", hint: "Light with direction", color: "#ff6b74" },
  lamp: { name: "Lamp", hint: "Turns energy into light", color: "#7c91ff" },
  motor: { name: "Motor", hint: "Turns energy into motion", color: "#a97ce8" },
};

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
const pinId = (partId: string, index: 0 | 1) => `${partId}:${index}`;
function makePart(type: ComponentType, x: number, y: number, id = uid(type)): CircuitPart {
  return { id, type, x, y, closed: type === "switch" ? false : undefined };
}
function makeWire(from: string, to: string): Wire { return { id: uid("wire"), from, to }; }
function baseLoop(types: ComponentType[]) {
  const spacing = 620 / Math.max(1, types.length - 1);
  return {
    parts: types.map((type, index) => makePart(type, 90 + index * spacing, index % 2 ? 205 : 135, `starter-${type}-${index}`)),
    wires: [] as Wire[],
  };
}

const lessons: Lesson[] = [
  {
    id: 1, eyebrow: "First spark", title: "Light the lamp",
    instruction: "Connect the battery and lamp in a complete loop. Tap one terminal, then another, to add each wire.",
    success: "You made a closed circuit — the lamp has a complete path for current.",
    concept: "Electricity needs a path from the battery’s + terminal, through a device, and back to −.",
    starter: () => baseLoop(["battery", "lamp"]),
    check: ({ poweredParts, parts }) => parts.some((p) => p.type === "lamp" && poweredParts.has(p.id)),
  },
  {
    id: 2, eyebrow: "Take control", title: "Add a switch",
    instruction: "Wire the battery, switch and lamp into one loop. Then close the switch to turn the lamp on.",
    success: "Perfect! A closed switch completes the path; an open switch breaks it.",
    concept: "A switch controls current by opening or closing one part of the circuit.",
    starter: () => baseLoop(["battery", "switch", "lamp"]),
    check: ({ poweredParts, parts }) => parts.some((p) => p.type === "lamp" && poweredParts.has(p.id)) && parts.some((p) => p.type === "switch" && p.closed),
  },
  {
    id: 3, eyebrow: "Right direction", title: "Turn on an LED",
    instruction: "Make a loop with the battery and LED. The LED’s + side must face the battery’s + side.",
    success: "Nice work — LEDs only let current travel in one direction.",
    concept: "LED stands for light-emitting diode. A diode has polarity, so direction matters.",
    starter: () => baseLoop(["battery", "led"]),
    check: ({ poweredParts, parts, correctLedPolarity }) => correctLedPolarity && parts.some((p) => p.type === "led" && poweredParts.has(p.id)),
  },
  {
    id: 4, eyebrow: "Protect the light", title: "Make the LED safe",
    instruction: "Build a loop with the battery, resistor and LED. Keep the LED facing the right way.",
    success: "Excellent — the resistor limits the current and protects the LED.",
    concept: "A resistor reduces current. Real LEDs can burn out when too much current flows through them.",
    starter: () => baseLoop(["battery", "resistor", "led"]),
    check: ({ poweredParts, parts, safeLed, correctLedPolarity }) => safeLed && correctLedPolarity && parts.some((p) => p.type === "led" && poweredParts.has(p.id)),
  },
  {
    id: 5, eyebrow: "Energy to motion", title: "Spin the motor",
    instruction: "Connect the motor to the battery. Add a switch if you want to control it.",
    success: "The motor is spinning — electrical energy is becoming movement.",
    concept: "A motor uses magnetic forces to turn electrical energy into mechanical motion.",
    starter: () => baseLoop(["battery", "motor", "switch"]),
    check: ({ poweredParts, parts }) => parts.some((p) => p.type === "motor" && poweredParts.has(p.id)),
  },
];

function getPin(part: CircuitPart, index: 0 | 1): Pin {
  return { id: pinId(part.id, index), partId: part.id, index, x: part.x + (index === 0 ? 0 : PART_W), y: part.y + PART_H / 2 };
}

function findPath(parts: CircuitPart[], wires: Wire[]) {
  const battery = parts.find((p) => p.type === "battery");
  if (!battery) return { path: [] as Edge[], exists: false, correctLedPolarity: true };
  const edges: Edge[] = wires.map((w) => ({ from: w.from, to: w.to }));
  parts.forEach((part) => {
    if (part.type !== "battery" && (part.type !== "switch" || part.closed)) {
      edges.push({ from: pinId(part.id, 0), to: pinId(part.id, 1), partId: part.id });
    }
  });
  const start = pinId(battery.id, 1);
  const goal = pinId(battery.id, 0);
  const queue = [start];
  const seen = new Set([start]);
  const parent = new Map<string, { node: string; edge: Edge }>();
  while (queue.length) {
    const current = queue.shift()!;
    if (current === goal) break;
    for (const edge of edges) {
      const next = edge.from === current ? edge.to : edge.to === current ? edge.from : null;
      if (next && !seen.has(next)) {
        seen.add(next); parent.set(next, { node: current, edge }); queue.push(next);
      }
    }
  }
  if (!seen.has(goal)) return { path: [] as Edge[], exists: false, correctLedPolarity: true };
  const path: Edge[] = [];
  let cursor = goal;
  let correctLedPolarity = true;
  while (cursor !== start) {
    const step = parent.get(cursor)!;
    path.unshift(step.edge);
    if (step.edge.partId) {
      const part = parts.find((p) => p.id === step.edge.partId);
      if (part?.type === "led") correctLedPolarity = step.node === pinId(part.id, 0);
    }
    cursor = step.node;
  }
  return { path, exists: true, correctLedPolarity };
}

function PartSymbol({ type, active, closed }: { type: ComponentType; active: boolean; closed?: boolean }) {
  if (type === "battery") return <svg viewBox="0 0 76 44" aria-hidden="true"><path d="M12 22h18m16 0h18M30 9v26M46 15v14" className="symbol-line" /><text x="22" y="9" className="pin-sign">−</text><text x="52" y="9" className="pin-sign">+</text></svg>;
  if (type === "switch") return <svg viewBox="0 0 76 44" aria-hidden="true"><path d="M8 30h17m28 0h15" className="symbol-line" /><circle cx="25" cy="30" r="4" className="symbol-fill" /><circle cx="53" cy="30" r="4" className="symbol-fill" /><path d={closed ? "M25 28L53 28" : "M25 28L50 11"} className="switch-arm" /></svg>;
  if (type === "resistor") return <svg viewBox="0 0 76 44" aria-hidden="true"><path d="M4 22h10l5-10 8 20 8-20 8 20 8-20 6 10h15" className="symbol-line" /></svg>;
  if (type === "led") return <svg viewBox="0 0 76 44" aria-hidden="true" className={active ? "led-on" : ""}><path d="M4 22h20m28 0h20" className="symbol-line" /><path d="M24 10l25 12-25 12zM51 9v26" className="symbol-line symbol-soft-fill" /><path d="M48 9l9-7m-2 10 9-7" className="light-ray" /></svg>;
  if (type === "lamp") return <svg viewBox="0 0 76 44" aria-hidden="true" className={active ? "lamp-on" : ""}><path d="M4 22h18m32 0h18" className="symbol-line" /><circle cx="38" cy="22" r="16" className="lamp-glass" /><path d="M29 13l18 18m0-18L29 31" className="symbol-line" /></svg>;
  return <svg viewBox="0 0 76 44" aria-hidden="true"><path d="M4 22h15m38 0h15" className="symbol-line" /><circle cx="38" cy="22" r="17" className="motor-case" /><text x="38" y="29" textAnchor="middle" className="motor-m">M</text><g className={active ? "motor-rotor spinning" : "motor-rotor"}><path d="M38 7v7m0 16v7M23 22h7m16 0h7" /></g></svg>;
}

function PaletteSymbol({ type }: { type: ComponentType }) {
  return <div className="palette-symbol" style={{ "--part-color": CATALOG[type].color } as React.CSSProperties}><PartSymbol type={type} active={false} closed={false} /></div>;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("learn");
  const [lessonIndex, setLessonIndex] = useState(0);
  const [parts, setParts] = useState<CircuitPart[]>(() => lessons[0].starter().parts);
  const [wires, setWires] = useState<Wire[]>([]);
  const [selectedPin, setSelectedPin] = useState<string | null>(null);
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [running, setRunning] = useState(true);
  const [completed, setCompleted] = useState<number[]>([]);
  const [notice, setNotice] = useState("Tap two terminals to connect a wire.");
  const [dragging, setDragging] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const lesson = lessons[lessonIndex];
  const circuit = useMemo(() => findPath(parts, wires), [parts, wires]);
  const pathParts = useMemo(() => new Set(circuit.path.flatMap((edge) => edge.partId ? [edge.partId] : [])), [circuit.path]);
  const pathWires = useMemo(() => new Set(wires.filter((wire) => circuit.path.some((edge) => !edge.partId && ((edge.from === wire.from && edge.to === wire.to) || (edge.from === wire.to && edge.to === wire.from)))).map((wire) => wire.id)), [circuit.path, wires]);
  const hasResistor = parts.some((part) => part.type === "resistor" && pathParts.has(part.id));
  const ledOnPath = parts.some((part) => part.type === "led" && pathParts.has(part.id));
  const safeLed = !ledOnPath || hasResistor;
  const poweredParts = running && circuit.exists && circuit.correctLedPolarity ? pathParts : new Set<string>();
  const lessonDone = mode === "learn" && lesson.check({ pathParts, pathExists: circuit.exists, parts, poweredParts, safeLed, correctLedPolarity: circuit.correctLedPolarity });

  useEffect(() => {
    const stored = window.localStorage.getItem("spark-lab-progress");
    if (stored) try { setCompleted(JSON.parse(stored)); } catch { /* ignore invalid local data */ }
  }, []);
  useEffect(() => {
    if (!lessonDone || completed.includes(lesson.id)) return;
    const next = [...completed, lesson.id]; setCompleted(next);
    window.localStorage.setItem("spark-lab-progress", JSON.stringify(next));
  }, [completed, lesson.id, lessonDone]);
  useEffect(() => {
    if (!running) setNotice("Simulation paused. Press Run to test the circuit.");
    else if (!parts.some((p) => p.type === "battery")) setNotice("Add a battery to give the circuit energy.");
    else if (!circuit.exists) setNotice("The path is still open. Look for two terminals that need a wire.");
    else if (!circuit.correctLedPolarity) setNotice("The LED is backwards. Swap the wires on its + and − sides.");
    else if (!safeLed) setNotice("The LED lights, but too much current could damage it. Add a resistor.");
    else if (poweredParts.size) setNotice("Current is flowing! Watch the glowing wire and working components.");
  }, [circuit.correctLedPolarity, circuit.exists, parts, poweredParts.size, running, safeLed]);

  const resetLesson = useCallback((index = lessonIndex) => {
    const starter = lessons[index].starter();
    setParts(starter.parts); setWires(starter.wires); setSelectedPin(null); setSelectedPart(null); setRunning(true);
  }, [lessonIndex]);
  const loadLesson = useCallback((index: number) => {
    const safeIndex = Math.max(0, Math.min(lessons.length - 1, index));
    setMode("learn"); setLessonIndex(safeIndex);
    const starter = lessons[safeIndex].starter();
    setParts(starter.parts); setWires(starter.wires); setSelectedPin(null); setSelectedPart(null); setRunning(true);
  }, []);
  const resetBoard = useCallback(() => {
    if (mode === "sandbox") {
      setParts([]); setWires([]); setSelectedPin(null); setSelectedPart(null); setRunning(true);
      setNotice("Choose components from the parts tray and invent your own circuit.");
      return;
    }
    resetLesson();
  }, [mode, resetLesson]);

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool?: (tool: unknown, options?: unknown) => void } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      context.registerTool({ name: "load_learning_lesson", title: "Load circuit lesson", description: "Open one of the five visible beginner circuit lessons.", inputSchema: { type: "object", properties: { lessonNumber: { type: "integer", minimum: 1, maximum: 5 } }, required: ["lessonNumber"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute(input: unknown) { const lessonNumber = Number((input as { lessonNumber?: number })?.lessonNumber); if (!Number.isInteger(lessonNumber) || lessonNumber < 1 || lessonNumber > 5) throw new Error("lessonNumber must be an integer from 1 to 5"); loadLesson(lessonNumber - 1); return { loaded: lessonNumber, title: lessons[lessonNumber - 1].title }; } }, { signal: lifecycle.signal });
      context.registerTool({ name: "reset_circuit_board", title: "Reset circuit board", description: "Reset the current lesson, or clear the sandbox board.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute() { resetBoard(); return { reset: true, mode }; } }, { signal: lifecycle.signal });
    } catch { /* optional browser capability */ }
    return () => lifecycle.abort();
  }, [loadLesson, mode, resetBoard]);

  function switchMode(nextMode: Mode) {
    setMode(nextMode); setSelectedPin(null); setSelectedPart(null);
    if (nextMode === "learn") resetLesson();
    else { setParts([]); setWires([]); setNotice("Choose components from the parts tray and invent your own circuit."); }
  }
  function addPart(type: ComponentType, drop?: Point) {
    const count = parts.length;
    const next = makePart(type, Math.max(22, Math.min(BOARD_W - PART_W - 22, drop?.x ?? 88 + (count % 5) * 145)), Math.max(34, Math.min(BOARD_H - PART_H - 34, drop?.y ?? 110 + Math.floor(count / 5) * 125)));
    setParts((current) => [...current, next]); setSelectedPart(next.id);
  }
  function handlePinClick(id: string) {
    setSelectedPart(null);
    if (!selectedPin) { setSelectedPin(id); setNotice("First terminal selected. Now tap another terminal."); return; }
    if (selectedPin === id) { setSelectedPin(null); return; }
    const alreadyConnected = wires.some((wire) => (wire.from === selectedPin && wire.to === id) || (wire.from === id && wire.to === selectedPin));
    if (!alreadyConnected) setWires((current) => [...current, makeWire(selectedPin, id)]);
    setSelectedPin(null);
  }
  function handleBoardDrop(event: React.DragEvent) {
    event.preventDefault();
    const type = event.dataTransfer.getData("application/circuit-part") as ComponentType;
    if (!CATALOG[type] || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    addPart(type, { x: ((event.clientX - rect.left) / rect.width) * BOARD_W - PART_W / 2, y: ((event.clientY - rect.top) / rect.height) * BOARD_H - PART_H / 2 });
  }
  function startPartDrag(event: React.PointerEvent, part: CircuitPart) {
    if ((event.target as HTMLElement).closest("button")) return;
    const rect = boardRef.current?.getBoundingClientRect(); if (!rect) return;
    setDragging({ id: part.id, dx: ((event.clientX - rect.left) / rect.width) * BOARD_W - part.x, dy: ((event.clientY - rect.top) / rect.height) * BOARD_H - part.y });
    setSelectedPart(part.id); (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  function movePart(event: React.PointerEvent) {
    if (!dragging || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * BOARD_W - dragging.dx;
    const y = ((event.clientY - rect.top) / rect.height) * BOARD_H - dragging.dy;
    setParts((current) => current.map((part) => part.id === dragging.id ? { ...part, x: Math.max(14, Math.min(BOARD_W - PART_W - 14, x)), y: Math.max(18, Math.min(BOARD_H - PART_H - 18, y)) } : part));
  }
  function removeSelected() {
    if (!selectedPart) return;
    setParts((current) => current.filter((part) => part.id !== selectedPart));
    setWires((current) => current.filter((wire) => !wire.from.startsWith(`${selectedPart}:`) && !wire.to.startsWith(`${selectedPart}:`)));
    setSelectedPart(null);
  }
  const allPins = useMemo(() => parts.flatMap((part) => [getPin(part, 0), getPin(part, 1)]), [parts]);
  const pinsById = useMemo(() => new Map(allPins.map((pin) => [pin.id, pin])), [allPins]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand" aria-label="Spark Lab home"><span className="brand-mark"><Zap size={22} fill="currentColor" /></span><span><strong>Spark Lab</strong><small>Kids Circuit Studio</small></span></div>
        <nav className="mode-tabs" aria-label="App mode">
          <button className={mode === "learn" ? "active" : ""} onClick={() => switchMode("learn")}><GraduationCap size={18} /> Learn</button>
          <button className={mode === "sandbox" ? "active" : ""} onClick={() => switchMode("sandbox")}><FlaskConical size={18} /> Sandbox</button>
        </nav>
        <div className="progress-pill" title="Lessons completed"><Sparkles size={17} /> <strong>{completed.length}</strong> / {lessons.length} complete</div>
      </header>

      <div className="studio-layout">
        <aside className="parts-panel panel">
          <div className="panel-heading"><div><span className="kicker">Parts tray</span><h2>Pick a component</h2></div><CircleHelp size={19} aria-label="Drag a component onto the board or tap it to add" /></div>
          <p className="panel-help">Drag a part onto the board, or tap to add it.</p>
          <div className="part-list">
            {(Object.keys(CATALOG) as ComponentType[]).map((type) => (
              <button key={type} className="part-card" draggable onDragStart={(event) => event.dataTransfer.setData("application/circuit-part", type)} onClick={() => addPart(type)} aria-label={`Add ${CATALOG[type].name}`}>
                <PaletteSymbol type={type} /><span><strong>{CATALOG[type].name}</strong><small>{CATALOG[type].hint}</small></span><span className="add-badge">+</span>
              </button>
            ))}
          </div>
          <div className="mini-guide"><MousePointer2 size={18} /><span><strong>Connect wires</strong>Tap one terminal, then another.</span></div>
        </aside>

        <section className="workspace-panel panel">
          <div className="workspace-toolbar">
            <div><span className="kicker">Workbench</span><h1>{mode === "learn" ? lesson.title : "Free-build board"}</h1></div>
            <div className="toolbar-actions">
              <button className={`run-button ${running ? "running" : ""}`} onClick={() => setRunning((v) => !v)}>{running ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}{running ? "Pause" : "Run"}</button>
              <button className="icon-button" onClick={resetBoard} title="Reset board" aria-label="Reset board"><RotateCcw size={18} /></button>
              <button className="icon-button" onClick={() => { setWires([]); setSelectedPin(null); }} title="Remove all wires" aria-label="Remove all wires"><Eraser size={18} /></button>
              <button className="icon-button danger" onClick={removeSelected} disabled={!selectedPart} title="Delete selected component" aria-label="Delete selected component"><Trash2 size={18} /></button>
            </div>
          </div>
          <div className="status-strip" role="status" aria-live="polite"><span className={`status-light ${running && circuit.exists ? "live" : ""}`} /><span>{notice}</span><strong>{running && circuit.exists ? "Circuit live" : "Circuit open"}</strong></div>
          <div className="circuit-board" ref={boardRef} onDragOver={(event) => event.preventDefault()} onDrop={handleBoardDrop} onPointerMove={movePart} onPointerUp={() => setDragging(null)} onPointerCancel={() => setDragging(null)} onClick={(event) => { if (event.target === event.currentTarget) { setSelectedPart(null); setSelectedPin(null); } }}>
            <svg className="wire-layer" viewBox={`0 0 ${BOARD_W} ${BOARD_H}`} preserveAspectRatio="none" aria-hidden="true">
              {wires.map((wire) => {
                const from = pinsById.get(wire.from); const to = pinsById.get(wire.to); if (!from || !to) return null;
                const bend = Math.max(36, Math.abs(to.x - from.x) * .42);
                const d = `M ${from.x} ${from.y} C ${from.x + bend} ${from.y}, ${to.x - bend} ${to.y}, ${to.x} ${to.y}`;
                const live = running && pathWires.has(wire.id) && circuit.correctLedPolarity;
                return <g key={wire.id}><path d={d} className="wire-shadow" /><path d={d} className={`wire ${live ? "wire-live" : ""}`} />{live && <path d={d} className="current-flow" />}</g>;
              })}
            </svg>
            {parts.length === 0 && <div className="empty-board"><span><BatteryCharging size={30} /></span><h3>Your workbench is ready</h3><p>Add a battery and something to power.</p></div>}
            {parts.map((part) => {
              const active = poweredParts.has(part.id);
              return (
                <div key={part.id} className={`circuit-part ${selectedPart === part.id ? "selected" : ""} ${active ? "active" : ""}`} style={{ left: `${(part.x / BOARD_W) * 100}%`, top: `${(part.y / BOARD_H) * 100}%`, "--part-color": CATALOG[part.type].color } as React.CSSProperties} onPointerDown={(event) => startPartDrag(event, part)} onClick={(event) => { event.stopPropagation(); setSelectedPart(part.id); }} role="button" tabIndex={0} aria-label={`${CATALOG[part.type].name}${active ? ", powered" : ""}. Drag to move.`}>
                  <button className={`terminal terminal-left ${selectedPin === pinId(part.id, 0) ? "chosen" : ""}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); handlePinClick(pinId(part.id, 0)); }} aria-label={`${CATALOG[part.type].name} ${part.type === "battery" ? "negative" : part.type === "led" ? "positive" : "left"} terminal`}><span>{part.type === "battery" ? "−" : part.type === "led" ? "+" : ""}</span></button>
                  <div className="part-title">{CATALOG[part.type].name}</div><PartSymbol type={part.type} active={active} closed={part.closed} />
                  {part.type === "switch" && <button className="switch-toggle" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setParts((current) => current.map((p) => p.id === part.id ? { ...p, closed: !p.closed } : p)); }}>{part.closed ? "OPEN" : "CLOSE"}</button>}
                  {part.type === "motor" && active && <span className="motion-label">WHIRR!</span>}
                  {part.type === "led" && active && <span className="glow-halo" />}{part.type === "lamp" && active && <span className="glow-halo lamp-halo" />}
                  <button className={`terminal terminal-right ${selectedPin === pinId(part.id, 1) ? "chosen" : ""}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); handlePinClick(pinId(part.id, 1)); }} aria-label={`${CATALOG[part.type].name} ${part.type === "battery" ? "positive" : part.type === "led" ? "negative" : "right"} terminal`}><span>{part.type === "battery" ? "+" : part.type === "led" ? "−" : ""}</span></button>
                </div>
              );
            })}
          </div>
          <div className="board-footer"><span><span className="legend-dot terminal-sample" /> Tap terminals to wire</span><span><span className="legend-dot current-sample" /> Moving dashes show current</span><span><Unplug size={15} /> {wires.length} {wires.length === 1 ? "wire" : "wires"}</span></div>
        </section>

        <aside className="lesson-panel panel">
          {mode === "learn" ? <>
            <div className="lesson-count"><span>Lesson {lesson.id} of {lessons.length}</span><div><i style={{ width: `${((lessonIndex + 1) / lessons.length) * 100}%` }} /></div></div>
            <span className="kicker orange">{lesson.eyebrow}</span><h2>{lesson.title}</h2><p className="lesson-instruction">{lesson.instruction}</p>
            <div className={`result-card ${lessonDone ? "success" : ""}`}><span>{lessonDone ? <Check size={22} /> : <Zap size={22} />}</span><div><strong>{lessonDone ? "Challenge complete!" : "Your mission"}</strong><p>{lessonDone ? lesson.success : "Build the circuit and watch what changes."}</p></div></div>
            <div className="learn-box"><Lightbulb size={20} /><div><strong>What you’ll discover</strong><p>{lesson.concept}</p></div></div>
            <div className="lesson-nav"><button disabled={lessonIndex === 0} onClick={() => loadLesson(lessonIndex - 1)}>Back</button><button className="next-button" disabled={!lessonDone || lessonIndex === lessons.length - 1} onClick={() => loadLesson(lessonIndex + 1)}>Next lesson <ChevronRight size={17} /></button></div>
            <div className="lesson-dots" aria-label="Lesson selector">{lessons.map((item, index) => <button key={item.id} className={`${index === lessonIndex ? "current" : ""} ${completed.includes(item.id) ? "done" : ""}`} onClick={() => loadLesson(index)} aria-label={`Open lesson ${item.id}: ${item.title}`}>{completed.includes(item.id) ? <Check size={14} /> : item.id}</button>)}</div>
          </> : <>
            <span className="kicker orange">Experiment freely</span><h2>Invent your circuit</h2><p className="lesson-instruction">There is no single correct answer here. Add parts, connect them, and see what happens.</p>
            <div className="sandbox-tips"><div><span>1</span><p><strong>Start with energy</strong>Add one battery.</p></div><div><span>2</span><p><strong>Add an output</strong>Try a lamp, LED or motor.</p></div><div><span>3</span><p><strong>Complete the loop</strong>Wire every part back to the battery.</p></div></div>
            <div className="learn-box"><Volume2 size={20} /><div><strong>Try this</strong><p>Can you use a switch to control both a lamp and a motor?</p></div></div>
          </>}
        </aside>
      </div>
    </main>
  );
}
