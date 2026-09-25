"use client";

import {
  Activity, AlertTriangle, BatteryCharging, Check, ChevronRight, CircleHelp,
  Eraser, FlaskConical, GraduationCap, Lightbulb, MousePointer2, Pause, Play,
  RotateCcw, Sparkles, Trash2, Unplug, Volume2, Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  analyzeCircuit,
  pinId,
  type CircuitAnalysis,
  type CircuitPart,
  type CircuitPath,
  type ComponentType,
  type Wire,
} from "./circuit-engine";

type Mode = "learn" | "sandbox";
type Point = { x: number; y: number };
type Pin = { id: string; partId: string; index: 0 | 1; x: number; y: number };
type LessonContext = {
  analysis: CircuitAnalysis;
  activePaths: CircuitPath[];
  parts: CircuitPart[];
  poweredParts: Set<string>;
};
type Lesson = {
  id: number;
  title: string;
  eyebrow: string;
  instruction: string;
  success: string;
  concept: string;
  hint: string;
  starter: () => { parts: CircuitPart[]; wires: Wire[] };
  check: (context: LessonContext) => boolean;
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
  buzzer: { name: "Buzzer", hint: "Turns energy into sound", color: "#2f9fc7" },
};

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
function makePart(type: ComponentType, x: number, y: number, id = uid(type)): CircuitPart {
  return { id, type, x, y, closed: type === "switch" ? false : undefined };
}
function makeWire(from: string, to: string, id = uid("wire")): Wire { return { id, from, to }; }
function baseLoop(types: ComponentType[]) {
  const spacing = 620 / Math.max(1, types.length - 1);
  return {
    parts: types.map((type, index) => makePart(type, 88 + index * spacing, index % 2 ? 235 : 145, `starter-${type}-${index}`)),
    wires: [] as Wire[],
  };
}

const lessons: Lesson[] = [
  {
    id: 1, eyebrow: "First spark", title: "Light the lamp",
    instruction: "Connect the battery and lamp in a complete loop. Tap one terminal, then another, to add each wire.",
    success: "You made a closed circuit — the lamp has a complete path for current.",
    concept: "Electricity needs a path from the battery’s + terminal, through a device, and back to −.",
    hint: "Connect battery + to one lamp terminal, then connect the other lamp terminal back to battery −.",
    starter: () => baseLoop(["battery", "lamp"]),
    check: ({ poweredParts, parts }) => parts.some((part) => part.type === "lamp" && poweredParts.has(part.id)),
  },
  {
    id: 2, eyebrow: "Take control", title: "Add a switch",
    instruction: "Wire the battery, switch and lamp into one loop. Then close the switch to turn the lamp on.",
    success: "Perfect! A closed switch completes the path; an open switch breaks it.",
    concept: "A switch controls current by opening or closing one part of the circuit.",
    hint: "Put the switch anywhere in the single loop, then press CLOSE on it.",
    starter: () => baseLoop(["battery", "switch", "lamp"]),
    check: ({ poweredParts, parts }) => parts.some((part) => part.type === "lamp" && poweredParts.has(part.id)) && parts.some((part) => part.type === "switch" && part.closed),
  },
  {
    id: 3, eyebrow: "Right direction", title: "Turn on an LED",
    instruction: "Make a loop with the battery and LED. The LED’s + side must face the battery’s + side.",
    success: "Nice work — LEDs only let current travel in one direction.",
    concept: "LED stands for light-emitting diode. A diode has polarity, so direction matters.",
    hint: "Wire battery + to LED +. Then wire LED − back to battery −.",
    starter: () => baseLoop(["battery", "led"]),
    check: ({ poweredParts, parts }) => parts.some((part) => part.type === "led" && poweredParts.has(part.id)),
  },
  {
    id: 4, eyebrow: "Protect the light", title: "Make the LED safe",
    instruction: "Build one loop through the battery, resistor and LED. The resistor must be in the same branch as the LED.",
    success: "Excellent — the resistor is in series with the LED and limits its current.",
    concept: "A resistor only protects an LED when the same current passes through both components.",
    hint: "Use one chain: battery + → resistor → LED +, then LED − → battery −.",
    starter: () => baseLoop(["battery", "resistor", "led"]),
    check: ({ poweredParts, parts, analysis }) => {
      const led = parts.find((part) => part.type === "led");
      return Boolean(led && poweredParts.has(led.id) && !analysis.unsafeLedIds.has(led.id));
    },
  },
  {
    id: 5, eyebrow: "Energy to motion", title: "Spin the motor",
    instruction: "Connect the motor and switch in one loop with the battery, then close the switch.",
    success: "The motor is spinning — electrical energy is becoming movement.",
    concept: "A motor uses magnetic forces to turn electrical energy into mechanical motion.",
    hint: "Connect all three parts in one chain and press CLOSE on the switch.",
    starter: () => baseLoop(["battery", "motor", "switch"]),
    check: ({ poweredParts, parts }) => parts.some((part) => part.type === "motor" && poweredParts.has(part.id)),
  },
  {
    id: 6, eyebrow: "Phase two · series", title: "Share one path",
    instruction: "Put two lamps in a single series loop so the same current passes through both.",
    success: "Both lamps share one current path — that is a series circuit.",
    concept: "Series components sit one after another. Opening any point stops the whole path.",
    hint: "Make one continuous chain: battery → lamp → lamp → battery.",
    starter: () => ({ parts: [makePart("battery", 70, 220, "series-battery"), makePart("lamp", 390, 120, "series-lamp-a"), makePart("lamp", 700, 270, "series-lamp-b")], wires: [] }),
    check: ({ activePaths, parts, poweredParts }) => {
      const lamps = parts.filter((part) => part.type === "lamp" && poweredParts.has(part.id));
      return lamps.length >= 2 && activePaths.some((path) => path.partIds.filter((id) => lamps.some((lamp) => lamp.id === id)).length >= 2);
    },
  },
  {
    id: 7, eyebrow: "Phase two · parallel", title: "Build two branches",
    instruction: "Connect both lamps across the battery on separate branches. Each lamp needs its own complete path.",
    success: "Two independent paths are live — you built a parallel circuit.",
    concept: "Parallel branches share the supply but give current more than one route.",
    hint: "Connect battery + to both lamps’ left terminals, then return both right terminals to battery −.",
    starter: () => ({ parts: [makePart("battery", 80, 225, "parallel-battery"), makePart("lamp", 600, 105, "parallel-lamp-a"), makePart("lamp", 600, 345, "parallel-lamp-b")], wires: [] }),
    check: ({ activePaths, parts, poweredParts }) => parts.filter((part) => part.type === "lamp" && poweredParts.has(part.id)).length >= 2 && activePaths.filter((path) => path.partIds.some((id) => parts.find((part) => part.id === id)?.type === "lamp")).length >= 2,
  },
  {
    id: 8, eyebrow: "Phase two · safety", title: "Find the short circuit",
    instruction: "A wire is bypassing the lamp and joining the battery terminals. Select that red wire and delete it.",
    success: "Safe again — current now travels through the lamp instead of taking a direct shortcut.",
    concept: "A short circuit is a very low-resistance path. It can cause dangerous current in real circuits.",
    hint: "Click the red loop around the battery, then use the trash button.",
    starter: () => {
      const battery = makePart("battery", 105, 220, "short-battery");
      const lamp = makePart("lamp", 620, 220, "short-lamp");
      return {
        parts: [battery, lamp],
        wires: [
          makeWire(pinId(battery.id, 1), pinId(battery.id, 0), "danger-wire"),
          makeWire(pinId(battery.id, 1), pinId(lamp.id, 0), "lamp-feed"),
          makeWire(pinId(lamp.id, 1), pinId(battery.id, 0), "lamp-return"),
        ],
      };
    },
    check: ({ analysis, parts, poweredParts }) => !analysis.shortCircuit && parts.some((part) => part.type === "lamp" && poweredParts.has(part.id)),
  },
  {
    id: 9, eyebrow: "Phase two · sound", title: "Sound the buzzer",
    instruction: "Build a switched buzzer circuit. Close the switch to make the sound waves move.",
    success: "Beep! The buzzer converts electrical energy into vibration and sound.",
    concept: "Buzzers use a vibrating element to push air and create sound waves.",
    hint: "Wire battery, switch and buzzer in one loop, then close the switch.",
    starter: () => baseLoop(["battery", "switch", "buzzer"]),
    check: ({ parts, poweredParts }) => parts.some((part) => part.type === "buzzer" && poweredParts.has(part.id)),
  },
];

function getPin(part: CircuitPart, index: 0 | 1): Pin {
  return { id: pinId(part.id, index), partId: part.id, index, x: part.x + (index === 0 ? 0 : PART_W), y: part.y + PART_H / 2 };
}

function wirePath(from: Pin, to: Pin, index: number) {
  if (from.partId === to.partId) {
    const lift = 88 + (index % 3) * 14;
    return `M ${from.x} ${from.y} C ${from.x} ${from.y - lift}, ${to.x} ${to.y - lift}, ${to.x} ${to.y}`;
  }
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const sameRow = Math.abs(dy) < 62;
  const direction = index % 2 === 0 ? -1 : 1;
  const curve = sameRow ? direction * (50 + (index % 3) * 18) : direction * 16;
  return `M ${from.x} ${from.y} C ${from.x + dx * .36} ${from.y + curve}, ${to.x - dx * .36} ${to.y + curve}, ${to.x} ${to.y}`;
}

function wireHandlePosition(from: Pin, to: Pin, index: number) {
  if (from.partId === to.partId) {
    const lift = 88 + (index % 3) * 14;
    return { x: (from.x + to.x) / 2, y: from.y - lift * .75 };
  }
  const direction = index % 2 === 0 ? -1 : 1;
  const curve = Math.abs(to.y - from.y) < 62 ? direction * (50 + (index % 3) * 18) : direction * 16;
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 + curve * .75 };
}

function PartSymbol({ type, active, closed }: { type: ComponentType; active: boolean; closed?: boolean }) {
  if (type === "battery") return <svg viewBox="0 0 76 44" aria-hidden="true"><path d="M12 22h18m16 0h18M30 9v26M46 15v14" className="symbol-line" /><text x="22" y="9" className="pin-sign">−</text><text x="52" y="9" className="pin-sign">+</text></svg>;
  if (type === "switch") return <svg viewBox="0 0 76 44" aria-hidden="true"><path d="M8 30h17m28 0h15" className="symbol-line" /><circle cx="25" cy="30" r="4" className="symbol-fill" /><circle cx="53" cy="30" r="4" className="symbol-fill" /><path d={closed ? "M25 28L53 28" : "M25 28L50 11"} className="switch-arm" /></svg>;
  if (type === "resistor") return <svg viewBox="0 0 76 44" aria-hidden="true"><path d="M4 22h10l5-10 8 20 8-20 8 20 8-20 6 10h15" className="symbol-line" /></svg>;
  if (type === "led") return <svg viewBox="0 0 76 44" aria-hidden="true" className={active ? "led-on" : ""}><path d="M4 22h20m28 0h20" className="symbol-line" /><path d="M24 10l25 12-25 12zM51 9v26" className="symbol-line symbol-soft-fill" /><path d="M48 9l9-7m-2 10 9-7" className="light-ray" /></svg>;
  if (type === "lamp") return <svg viewBox="0 0 76 44" aria-hidden="true" className={active ? "lamp-on" : ""}><path d="M4 22h18m32 0h18" className="symbol-line" /><circle cx="38" cy="22" r="16" className="lamp-glass" /><path d="M29 13l18 18m0-18L29 31" className="symbol-line" /></svg>;
  if (type === "motor") return <svg viewBox="0 0 76 44" aria-hidden="true"><path d="M4 22h15m38 0h15" className="symbol-line" /><circle cx="38" cy="22" r="17" className="motor-case" /><text x="38" y="29" textAnchor="middle" className="motor-m">M</text><g className={active ? "motor-rotor spinning" : "motor-rotor"}><path d="M38 7v7m0 16v7M23 22h7m16 0h7" /></g></svg>;
  return <svg viewBox="0 0 76 44" aria-hidden="true" className={active ? "buzzer-on" : ""}><path d="M4 22h15m38 0h15" className="symbol-line" /><path d="M20 14h18l12-8v32l-12-8H20z" className="buzzer-body" /><path d="M55 13c5 5 5 13 0 18m6-24c9 9 9 21 0 30" className="sound-wave" /></svg>;
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
  const [selectedWire, setSelectedWire] = useState<string | null>(null);
  const [running, setRunning] = useState(true);
  const [voltage, setVoltage] = useState(9);
  const [completed, setCompleted] = useState<number[]>([]);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [notice, setNotice] = useState("Tap two terminals to connect a wire.");
  const [showHint, setShowHint] = useState(false);
  const [dragging, setDragging] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const lesson = lessons[lessonIndex];
  const analysis = useMemo(() => analyzeCircuit(parts, wires, voltage), [parts, voltage, wires]);
  const poweredParts = useMemo(() => running ? analysis.poweredParts : new Set<string>(), [analysis.poweredParts, running]);
  const poweredWires = useMemo(() => running ? analysis.poweredWires : new Set<string>(), [analysis.poweredWires, running]);
  const lessonPassedNow = mode === "learn" && running && lesson.check({ analysis, activePaths: analysis.activePaths, parts, poweredParts });
  const lessonComplete = completed.includes(lesson.id) || lessonPassedNow;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem("spark-lab-progress");
      if (stored) try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const validLessons = parsed.filter((id: unknown): id is number => typeof id === "number" && Number.isInteger(id) && id >= 1 && id <= lessons.length);
          setCompleted([...new Set(validLessons)].sort((a, b) => a - b));
        }
      } catch { /* ignore invalid local data */ }
      setProgressLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!progressLoaded || !lessonPassedNow || completed.includes(lesson.id)) return;
    const timer = window.setTimeout(() => {
      setCompleted((current) => {
        if (current.includes(lesson.id)) return current;
        const next = [...current, lesson.id].sort((a, b) => a - b);
        window.localStorage.setItem("spark-lab-progress", JSON.stringify(next));
        return next;
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [completed, lesson.id, lessonPassedNow, progressLoaded]);

  useEffect(() => {
    // This state mirrors circuit analysis while preserving short interaction messages between changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!running) setNotice("Simulation paused. Press Run to test the circuit.");
    else if (!parts.some((part) => part.type === "battery")) setNotice("Add a battery to give the circuit energy.");
    else if (analysis.shortCircuit) setNotice("Short circuit detected. Select a red bypass wire and delete it.");
    else if (!analysis.completePaths.length) setNotice("The path is still open. Look for two terminals that need a wire.");
    else if (analysis.reversedLedIds.size) setNotice("An LED is backwards. Connect battery + toward the LED’s + side.");
    else if (analysis.unsafeLedIds.size) setNotice("The LED works, but its branch needs a resistor for protection.");
    else if (analysis.hasCurrent) setNotice(`${analysis.branchCount} ${analysis.branchCount === 1 ? "path is" : "paths are"} carrying current.`);
  }, [analysis, parts, running]);

  const clearSelection = useCallback(() => {
    setSelectedPart(null);
    setSelectedWire(null);
    setSelectedPin(null);
  }, []);

  const resetLesson = useCallback((index = lessonIndex) => {
    const starter = lessons[index].starter();
    setParts(starter.parts);
    setWires(starter.wires);
    clearSelection();
    setShowHint(false);
    setRunning(true);
  }, [clearSelection, lessonIndex]);

  const loadLesson = useCallback((index: number) => {
    const safeIndex = Math.max(0, Math.min(lessons.length - 1, index));
    const starter = lessons[safeIndex].starter();
    setMode("learn");
    setLessonIndex(safeIndex);
    setParts(starter.parts);
    setWires(starter.wires);
    clearSelection();
    setShowHint(false);
    setRunning(true);
  }, [clearSelection]);

  const resetBoard = useCallback(() => {
    if (mode === "sandbox") {
      setParts([]);
      setWires([]);
      clearSelection();
      setRunning(true);
      setNotice("Choose components from the parts tray and invent your own circuit.");
      return;
    }
    resetLesson();
  }, [clearSelection, mode, resetLesson]);

  const resetEverything = useCallback(() => {
    if (!window.confirm("Reset every completed lesson and clear the current circuit?")) return;
    window.localStorage.removeItem("spark-lab-progress");
    setCompleted([]);
    setVoltage(9);
    setNotice("Tap two terminals to connect a wire.");
    loadLesson(0);
  }, [loadLesson]);

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool?: (tool: unknown, options?: unknown) => void } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      context.registerTool({ name: "load_learning_lesson", title: "Load circuit lesson", description: "Open one of the nine visible circuit lessons.", inputSchema: { type: "object", properties: { lessonNumber: { type: "integer", minimum: 1, maximum: 9 } }, required: ["lessonNumber"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute(input: unknown) { const lessonNumber = Number((input as { lessonNumber?: number })?.lessonNumber); if (!Number.isInteger(lessonNumber) || lessonNumber < 1 || lessonNumber > 9) throw new Error("lessonNumber must be an integer from 1 to 9"); loadLesson(lessonNumber - 1); return { loaded: lessonNumber, title: lessons[lessonNumber - 1].title }; } }, { signal: lifecycle.signal });
      context.registerTool({ name: "reset_circuit_board", title: "Reset circuit board", description: "Reset the current lesson, or clear the sandbox board.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute() { resetBoard(); return { reset: true, mode }; } }, { signal: lifecycle.signal });
    } catch { /* optional browser capability */ }
    return () => lifecycle.abort();
  }, [loadLesson, mode, resetBoard]);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    clearSelection();
    setShowHint(false);
    if (nextMode === "learn") resetLesson();
    else {
      setParts([]);
      setWires([]);
      setNotice("Choose components from the parts tray and invent your own circuit.");
    }
  }

  function addPart(type: ComponentType, drop?: Point) {
    const count = parts.length;
    const next = makePart(type, Math.max(22, Math.min(BOARD_W - PART_W - 22, drop?.x ?? 88 + (count % 5) * 145)), Math.max(34, Math.min(BOARD_H - PART_H - 34, drop?.y ?? 110 + Math.floor(count / 5) * 125)));
    setParts((current) => [...current, next]);
    setSelectedPart(next.id);
    setSelectedWire(null);
  }

  function handlePinClick(id: string) {
    setSelectedPart(null);
    setSelectedWire(null);
    if (!selectedPin) {
      setSelectedPin(id);
      setNotice("First terminal selected. Now tap another terminal.");
      return;
    }
    if (selectedPin === id) {
      setSelectedPin(null);
      return;
    }
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
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragging({ id: part.id, dx: ((event.clientX - rect.left) / rect.width) * BOARD_W - part.x, dy: ((event.clientY - rect.top) / rect.height) * BOARD_H - part.y });
    setSelectedPart(part.id);
    setSelectedWire(null);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function movePart(event: React.PointerEvent) {
    if (!dragging || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * BOARD_W - dragging.dx;
    const y = ((event.clientY - rect.top) / rect.height) * BOARD_H - dragging.dy;
    setParts((current) => current.map((part) => part.id === dragging.id ? { ...part, x: Math.max(14, Math.min(BOARD_W - PART_W - 14, x)), y: Math.max(18, Math.min(BOARD_H - PART_H - 18, y)) } : part));
  }

  function removeSelected() {
    if (selectedWire) {
      setWires((current) => current.filter((wire) => wire.id !== selectedWire));
      setSelectedWire(null);
      return;
    }
    if (!selectedPart) return;
    setParts((current) => current.filter((part) => part.id !== selectedPart));
    setWires((current) => current.filter((wire) => !wire.from.startsWith(`${selectedPart}:`) && !wire.to.startsWith(`${selectedPart}:`)));
    setSelectedPart(null);
  }

  const allPins = useMemo(() => parts.flatMap((part) => [getPin(part, 0), getPin(part, 1)]), [parts]);
  const pinsById = useMemo(() => new Map(allPins.map((pin) => [pin.id, pin])), [allPins]);
  const statusKind = !running ? "paused" : analysis.shortCircuit ? "danger" : analysis.hasCurrent ? "live" : "open";
  const statusLabel = statusKind === "danger" ? "Short circuit" : statusKind === "live" ? "Circuit live" : statusKind === "paused" ? "Paused" : "Circuit open";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand" aria-label="Spark Lab home"><span className="brand-mark"><Zap size={22} fill="currentColor" /></span><span><strong>Spark Lab</strong><small>Kids Circuit Studio · Phase 2</small></span></div>
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
          <div className="mini-guide"><MousePointer2 size={18} /><span><strong>Select and delete wires</strong>Tap a wire, then use the trash button.</span></div>
        </aside>

        <section className="workspace-panel panel">
          <div className="workspace-toolbar">
            <div><span className="kicker">Workbench</span><h1>{mode === "learn" ? lesson.title : "Free-build board"}</h1></div>
            <div className="toolbar-actions">
              <div className="voltage-control" aria-label="Battery voltage">{[3, 6, 9].map((value) => <button key={value} className={voltage === value ? "active" : ""} onClick={() => setVoltage(value)}>{value}V</button>)}</div>
              <button className={`run-button ${running ? "running" : ""}`} onClick={() => setRunning((value) => !value)}>{running ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}{running ? "Pause" : "Run"}</button>
              <button className="icon-button" onClick={resetBoard} title="Reset board" aria-label="Reset board"><RotateCcw size={18} /></button>
              <button className="icon-button" onClick={() => { setWires([]); setSelectedPin(null); setSelectedWire(null); }} title="Remove all wires" aria-label="Remove all wires"><Eraser size={18} /></button>
              <button className="icon-button danger" onClick={removeSelected} disabled={!selectedPart && !selectedWire} title="Delete selected item" aria-label="Delete selected item"><Trash2 size={18} /></button>
            </div>
          </div>
          <div className={`status-strip ${statusKind}`} role="status" aria-live="polite"><span className={`status-light ${statusKind}`} /><span>{notice}</span><strong>{statusLabel}</strong></div>
          <div className="circuit-board" ref={boardRef} onDragOver={(event) => event.preventDefault()} onDrop={handleBoardDrop} onPointerMove={movePart} onPointerUp={() => setDragging(null)} onPointerCancel={() => setDragging(null)} onClick={(event) => { if (event.target === event.currentTarget || (event.target as Element).classList.contains("wire-layer")) clearSelection(); }}>
            <svg className="wire-layer" viewBox={`0 0 ${BOARD_W} ${BOARD_H}`} preserveAspectRatio="none">
              {wires.map((wire, index) => {
                const from = pinsById.get(wire.from);
                const to = pinsById.get(wire.to);
                if (!from || !to) return null;
                const d = wirePath(from, to, index);
                const live = poweredWires.has(wire.id);
                const short = running && analysis.shortWireIds.has(wire.id);
                const selected = selectedWire === wire.id;
                const handle = wireHandlePosition(from, to, index);
                const selectWire = () => { setSelectedWire(wire.id); setSelectedPart(null); setSelectedPin(null); };
                return <g key={wire.id} className="wire-group"><path d={d} className="wire-shadow" /><path d={d} className={`wire ${live ? "wire-live" : ""} ${short ? "wire-short" : ""} ${selected ? "wire-selected" : ""}`} />{live && <path d={d} className="current-flow" />}<path d={d} className="wire-hit" role="button" tabIndex={0} aria-label="Select wire" onClick={(event) => { event.stopPropagation(); selectWire(); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectWire(); } }} />{short && <g className="wire-alert-handle" role="button" tabIndex={0} aria-label="Select short-circuit wire" transform={`translate(${handle.x} ${handle.y})`} onClick={(event) => { event.stopPropagation(); selectWire(); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectWire(); } }}><circle r="13" /><text y="5" textAnchor="middle">!</text></g>}</g>;
              })}
            </svg>
            {parts.length === 0 && <div className="empty-board"><span><BatteryCharging size={30} /></span><h3>Your workbench is ready</h3><p>Add a battery and something to power.</p></div>}
            {parts.map((part) => {
              const active = poweredParts.has(part.id);
              const warning = running && (analysis.reversedLedIds.has(part.id) || analysis.unsafeLedIds.has(part.id));
              return (
                <div key={part.id} className={`circuit-part ${selectedPart === part.id ? "selected" : ""} ${active ? "active" : ""} ${warning ? "warning" : ""}`} style={{ left: `${(part.x / BOARD_W) * 100}%`, top: `${(part.y / BOARD_H) * 100}%`, "--part-color": CATALOG[part.type].color, "--power-level": Math.min(1, analysis.currentMilliAmps / 80) } as React.CSSProperties} onPointerDown={(event) => startPartDrag(event, part)} onClick={(event) => { event.stopPropagation(); setSelectedPart(part.id); setSelectedWire(null); }} role="button" tabIndex={0} aria-label={`${CATALOG[part.type].name}${active ? ", powered" : ""}. Drag to move.`}>
                  <button className={`terminal terminal-left ${selectedPin === pinId(part.id, 0) ? "chosen" : ""}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); handlePinClick(pinId(part.id, 0)); }} aria-label={`${CATALOG[part.type].name} ${part.type === "battery" ? "negative" : part.type === "led" ? "positive" : "left"} terminal`}><span>{part.type === "battery" ? "−" : part.type === "led" ? "+" : ""}</span></button>
                  <div className="part-title">{CATALOG[part.type].name}</div><PartSymbol type={part.type} active={active} closed={part.closed} />
                  {part.type === "switch" && <button className="switch-toggle" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setParts((current) => current.map((item) => item.id === part.id ? { ...item, closed: !item.closed } : item)); }}>{part.closed ? "OPEN" : "CLOSE"}</button>}
                  {part.type === "motor" && active && <span className="motion-label">WHIRR!</span>}
                  {part.type === "buzzer" && active && <span className="motion-label buzzer-label">BEEP!</span>}
                  {part.type === "led" && active && <span className="glow-halo" />}{part.type === "lamp" && active && <span className="glow-halo lamp-halo" />}
                  {warning && <span className="part-warning" title="Check this component"><AlertTriangle size={14} /></span>}
                  <button className={`terminal terminal-right ${selectedPin === pinId(part.id, 1) ? "chosen" : ""}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); handlePinClick(pinId(part.id, 1)); }} aria-label={`${CATALOG[part.type].name} ${part.type === "battery" ? "positive" : part.type === "led" ? "negative" : "right"} terminal`}><span>{part.type === "battery" ? "+" : part.type === "led" ? "−" : ""}</span></button>
                </div>
              );
            })}
          </div>
          <div className="board-footer"><span><span className="legend-dot terminal-sample" /> Tap terminals to wire</span><span><span className="legend-dot current-sample" /> Moving dashes show current</span><span><Unplug size={15} /> {wires.length} {wires.length === 1 ? "wire" : "wires"}</span><span className="meter"><Activity size={15} /> {running && analysis.hasCurrent ? `${Math.round(analysis.currentMilliAmps)} mA · ${analysis.branchCount} ${analysis.branchCount === 1 ? "path" : "paths"}` : "0 mA"}</span></div>
        </section>

        <aside className="lesson-panel panel">
          {mode === "learn" ? <>
            <div className="lesson-count"><span>Lesson {lesson.id} of {lessons.length}</span><div><i style={{ width: `${((lessonIndex + 1) / lessons.length) * 100}%` }} /></div></div>
            <span className="kicker orange">{lesson.eyebrow}</span><h2>{lesson.title}</h2><p className="lesson-instruction">{lesson.instruction}</p>
            <div className={`result-card ${lessonComplete ? "success" : analysis.shortCircuit ? "danger" : ""}`}><span>{lessonComplete ? <Check size={22} /> : analysis.shortCircuit ? <AlertTriangle size={22} /> : <Zap size={22} />}</span><div><strong>{lessonComplete ? "Challenge complete!" : analysis.shortCircuit ? "Power stopped for safety" : "Your mission"}</strong><p>{lessonComplete ? lesson.success : analysis.shortCircuit ? "Remove the short path before components can run." : "Build the circuit and watch what changes."}</p></div></div>
            <div className="learn-box"><Lightbulb size={20} /><div><strong>What you’ll discover</strong><p>{lesson.concept}</p></div></div>
            <button className="hint-button" onClick={() => setShowHint((value) => !value)}><CircleHelp size={16} /> {showHint ? "Hide hint" : "Need a hint?"}</button>
            {showHint && <p className="hint-copy">{lesson.hint}</p>}
            <div className="lesson-nav"><button disabled={lessonIndex === 0} onClick={() => loadLesson(lessonIndex - 1)}>Back</button><button className="next-button" disabled={!lessonComplete || lessonIndex === lessons.length - 1} onClick={() => loadLesson(lessonIndex + 1)}>Next lesson <ChevronRight size={17} /></button></div>
            <div className="lesson-dots" aria-label="Lesson selector">{lessons.map((item, index) => <button key={item.id} className={`${index === lessonIndex ? "current" : ""} ${completed.includes(item.id) ? "done" : ""} ${item.id > 5 ? "phase-two" : ""}`} onClick={() => loadLesson(index)} aria-label={`Open lesson ${item.id}: ${item.title}${completed.includes(item.id) ? ", completed" : ""}`}>{item.id}</button>)}</div>
          </> : <>
            <span className="kicker orange">Experiment freely</span><h2>Invent your circuit</h2><p className="lesson-instruction">Build series and parallel branches. Spark Lab now checks every path independently and stops power when it detects a short.</p>
            <div className="sandbox-tips"><div><span>1</span><p><strong>Choose voltage</strong>Try 3V, 6V or 9V.</p></div><div><span>2</span><p><strong>Build branches</strong>Power more than one output.</p></div><div><span>3</span><p><strong>Watch the meter</strong>Compare current as paths change.</p></div></div>
            <div className="learn-box"><Volume2 size={20} /><div><strong>Phase 2 challenge</strong><p>Can one switch control a lamp, motor and buzzer on three parallel branches?</p></div></div>
          </>}
          <button className="reset-progress-button" onClick={resetEverything}><RotateCcw size={15} /> Reset everything</button>
        </aside>
      </div>
    </main>
  );
}
