import type { StructureLabel, SwingPoint } from "./types";

export function classifyStructure(swings: SwingPoint[], equalityTolerance = .00005): StructureLabel[] {
  let previousHigh: SwingPoint | undefined; let previousLow: SwingPoint | undefined;
  const labels: StructureLabel[] = [];
  for (const swing of swings) {
    const previous = swing.type === "high" ? previousHigh : previousLow;
    if (previous) {
      const tolerance = Math.max(Math.abs(previous.price) * equalityTolerance, Number.EPSILON);
      const higher = swing.price > previous.price + tolerance;
      const label = swing.type === "high" ? (higher ? "HH" : "LH") : (higher ? "HL" : "LL");
      labels.push({ ...swing, label, previousPrice: previous.price });
    }
    if (swing.type === "high") previousHigh = swing; else previousLow = swing;
  }
  return labels;
}

export function describeLatestStructure(labels: StructureLabel[]) {
  const recent = labels.slice(-6); const lastHigh = [...recent].reverse().find((item) => item.type === "high"); const lastLow = [...recent].reverse().find((item) => item.type === "low");
  return lastHigh && lastLow ? `${lastHigh.label} + ${lastLow.label}` : recent.at(-1)?.label ?? "Insufficient structure";
}
