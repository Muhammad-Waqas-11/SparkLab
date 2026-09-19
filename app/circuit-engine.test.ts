import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeCircuit,
  pinId,
  type CircuitPart,
  type ComponentType,
  type Wire,
} from "./circuit-engine.ts";

const part = (id: string, type: ComponentType, closed?: boolean): CircuitPart => ({
  id,
  type,
  x: 0,
  y: 0,
  closed,
});
const wire = (id: string, fromPart: string, fromPin: 0 | 1, toPart: string, toPin: 0 | 1): Wire => ({
  id,
  from: pinId(fromPart, fromPin),
  to: pinId(toPart, toPin),
});

test("powers every component on a series path", () => {
  const parts = [part("b", "battery"), part("l1", "lamp"), part("l2", "lamp")];
  const wires = [
    wire("w1", "b", 1, "l1", 0),
    wire("w2", "l1", 1, "l2", 0),
    wire("w3", "l2", 1, "b", 0),
  ];
  const result = analyzeCircuit(parts, wires);

  assert.equal(result.branchCount, 1);
  assert.deepEqual([...result.poweredParts].sort(), ["l1", "l2"]);
});

test("detects and powers two parallel lamp branches", () => {
  const parts = [part("b", "battery"), part("l1", "lamp"), part("l2", "lamp")];
  const wires = [
    wire("a1", "b", 1, "l1", 0),
    wire("a2", "l1", 1, "b", 0),
    wire("b1", "b", 1, "l2", 0),
    wire("b2", "l2", 1, "b", 0),
  ];
  const result = analyzeCircuit(parts, wires);

  assert.equal(result.branchCount, 2);
  assert.equal(result.currentMilliAmps, 200);
  assert.deepEqual([...result.poweredParts].sort(), ["l1", "l2"]);
});

test("stops all outputs when any battery short is present", () => {
  const parts = [part("b", "battery"), part("lamp", "lamp")];
  const wires = [
    wire("short", "b", 1, "b", 0),
    wire("feed", "b", 1, "lamp", 0),
    wire("return", "lamp", 1, "b", 0),
  ];
  const result = analyzeCircuit(parts, wires);

  assert.equal(result.shortCircuit, true);
  assert.equal(result.poweredParts.size, 0);
  assert.equal(result.shortWireIds.has("short"), true);
});

test("blocks a reversed LED", () => {
  const parts = [part("b", "battery"), part("led", "led")];
  const wires = [
    wire("feed", "b", 1, "led", 1),
    wire("return", "led", 0, "b", 0),
  ];
  const result = analyzeCircuit(parts, wires);

  assert.equal(result.hasCurrent, false);
  assert.equal(result.reversedLedIds.has("led"), true);
});

test("requires a resistor in the LED branch, not a parallel branch", () => {
  const parts = [part("b", "battery"), part("led", "led"), part("r", "resistor")];
  const wires = [
    wire("lf", "b", 1, "led", 0),
    wire("lr", "led", 1, "b", 0),
    wire("rf", "b", 1, "r", 0),
    wire("rr", "r", 1, "b", 0),
  ];
  const result = analyzeCircuit(parts, wires);

  assert.equal(result.poweredParts.has("led"), true);
  assert.equal(result.poweredParts.has("r"), true);
  assert.equal(result.unsafeLedIds.has("led"), true);
});
