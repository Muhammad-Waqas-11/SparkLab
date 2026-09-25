export type ComponentType =
  | "battery"
  | "switch"
  | "resistor"
  | "led"
  | "lamp"
  | "motor"
  | "buzzer"
  | "potentiometer"
  | "capacitor"
  | "ammeter"
  | "voltmeter";

export type CircuitPart = {
  id: string;
  type: ComponentType;
  x: number;
  y: number;
  closed?: boolean;
  resistance?: number;
};

export type Wire = { id: string; from: string; to: string };

type Edge = {
  id: string;
  from: string;
  to: string;
  kind: "wire" | "component";
  partId?: string;
  wireId?: string;
};

type PathStep = { edge: Edge; from: string; to: string };

export type CircuitPath = {
  partIds: string[];
  wireIds: string[];
  reversedLedIds: string[];
  resistance: number;
  isShort: boolean;
};

export type CircuitAnalysis = {
  completePaths: CircuitPath[];
  activePaths: CircuitPath[];
  poweredParts: Set<string>;
  poweredWires: Set<string>;
  reversedLedIds: Set<string>;
  unsafeLedIds: Set<string>;
  shortWireIds: Set<string>;
  shortCircuit: boolean;
  hasCurrent: boolean;
  hasUsefulOutput: boolean;
  currentMilliAmps: number;
  branchCount: number;
  partCurrentMilliAmps: Map<string, number>;
  partVoltageDrops: Map<string, number>;
};

export const pinId = (partId: string, index: 0 | 1) => `${partId}:${index}`;

const resistanceByType: Record<Exclude<ComponentType, "battery">, number> = {
  switch: 1,
  resistor: 220,
  led: 25,
  lamp: 90,
  motor: 60,
  buzzer: 110,
  potentiometer: 220,
  capacitor: 160,
  ammeter: 1,
  voltmeter: 1_000_000,
};

function partResistance(part: CircuitPart) {
  if (part.type === "battery") return 0;
  if (part.type === "potentiometer") return Math.max(1, part.resistance ?? resistanceByType.potentiometer);
  return resistanceByType[part.type];
}

function enumeratePaths(edges: Edge[], start: string, goal: string) {
  const adjacency = new Map<string, Edge[]>();
  for (const edge of edges) {
    adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge]);
    adjacency.set(edge.to, [...(adjacency.get(edge.to) ?? []), edge]);
  }

  const paths: PathStep[][] = [];
  const visited = new Set<string>([start]);

  function walk(node: string, steps: PathStep[]) {
    if (paths.length >= 96 || steps.length > 40) return;
    if (node === goal) {
      paths.push(steps);
      return;
    }

    for (const edge of adjacency.get(node) ?? []) {
      const next = edge.from === node ? edge.to : edge.from;
      if (visited.has(next)) continue;
      visited.add(next);
      walk(next, [...steps, { edge, from: node, to: next }]);
      visited.delete(next);
    }
  }

  walk(start, []);
  return paths;
}

export function analyzeCircuit(
  parts: CircuitPart[],
  wires: Wire[],
  voltage = 9,
): CircuitAnalysis {
  const batteries = parts.filter((part) => part.type === "battery");
  const partById = new Map(parts.map((part) => [part.id, part]));
  const edges: Edge[] = wires.map((wire) => ({
    id: `wire:${wire.id}`,
    from: wire.from,
    to: wire.to,
    kind: "wire",
    wireId: wire.id,
  }));

  for (const part of parts) {
    if (part.type === "battery" || (part.type === "switch" && !part.closed)) continue;
    edges.push({
      id: `part:${part.id}`,
      from: pinId(part.id, 0),
      to: pinId(part.id, 1),
      kind: "component",
      partId: part.id,
    });
  }

  const completePaths: CircuitPath[] = [];
  const seenSignatures = new Set<string>();

  for (const battery of batteries) {
    const rawPaths = enumeratePaths(edges, pinId(battery.id, 1), pinId(battery.id, 0));
    for (const steps of rawPaths) {
      const signature = steps.map(({ edge }) => edge.id).sort().join("|");
      if (seenSignatures.has(signature)) continue;
      seenSignatures.add(signature);

      const partIds = steps.flatMap(({ edge }) => edge.partId ? [edge.partId] : []);
      const wireIds = steps.flatMap(({ edge }) => edge.wireId ? [edge.wireId] : []);
      const reversedLedIds = steps.flatMap(({ edge, from }) => {
        if (!edge.partId || partById.get(edge.partId)?.type !== "led") return [];
        return from === pinId(edge.partId, 0) ? [] : [edge.partId];
      });
      const componentTypes = partIds.map((id) => partById.get(id)?.type).filter(Boolean);
      const isShort = !componentTypes.some((type) => type !== "switch" && type !== "ammeter");
      const resistance = Math.max(1, partIds.reduce((sum, id) => {
        const part = partById.get(id);
        return part ? sum + partResistance(part) : sum;
      }, 0));

      completePaths.push({ partIds, wireIds, reversedLedIds, resistance, isShort });
    }
  }

  const shortPaths = completePaths.filter((path) => path.isShort);
  const shortCircuit = shortPaths.length > 0;
  const electricallyValid = completePaths.filter((path) => !path.isShort && path.reversedLedIds.length === 0);
  const activePaths = shortCircuit ? [] : electricallyValid;
  const poweredParts = new Set(activePaths.flatMap((path) => path.partIds));
  const poweredWires = new Set(activePaths.flatMap((path) => path.wireIds));
  const reversedLedIds = new Set(completePaths.flatMap((path) => path.reversedLedIds));
  const unsafeLedIds = new Set<string>();

  for (const path of activePaths) {
    const hasResistor = path.partIds.some((id) => {
      const type = partById.get(id)?.type;
      return type === "resistor" || type === "potentiometer";
    });
    if (!hasResistor) {
      for (const id of path.partIds) if (partById.get(id)?.type === "led") unsafeLedIds.add(id);
    }
  }

  const usefulTypes = new Set<ComponentType>(["led", "lamp", "motor", "buzzer"]);
  const hasUsefulOutput = [...poweredParts].some((id) => {
    const type = partById.get(id)?.type;
    return type ? usefulTypes.has(type) : false;
  });
  const currentMilliAmps = activePaths.reduce(
    (sum, path) => sum + (voltage / path.resistance) * 1000,
    0,
  );
  const partCurrentMilliAmps = new Map<string, number>();
  const partVoltageDrops = new Map<string, number>();

  for (const path of activePaths) {
    const pathCurrent = (voltage / path.resistance) * 1000;
    for (const id of path.partIds) {
      const part = partById.get(id);
      if (!part) continue;
      partCurrentMilliAmps.set(id, (partCurrentMilliAmps.get(id) ?? 0) + pathCurrent);
      const voltageDrop = (partResistance(part) / path.resistance) * voltage;
      partVoltageDrops.set(id, Math.max(partVoltageDrops.get(id) ?? 0, voltageDrop));
    }
  }

  return {
    completePaths,
    activePaths,
    poweredParts,
    poweredWires,
    reversedLedIds,
    unsafeLedIds,
    shortWireIds: new Set(shortPaths.flatMap((path) => path.wireIds)),
    shortCircuit,
    hasCurrent: activePaths.length > 0,
    hasUsefulOutput,
    currentMilliAmps,
    branchCount: activePaths.length,
    partCurrentMilliAmps,
    partVoltageDrops,
  };
}
