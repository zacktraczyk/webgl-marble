import type { PairOrder } from "./types.ts";

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * Creates reproducible, balanced A/B pairs. Every two pairs contain one AB and
 * one BA ordering; odd final pairs are selected from the recorded seed.
 */
export function createBalancedPairOrder<TVariant extends string>(
  repetitions: number,
  seed: number,
  baseline: TVariant,
  candidate: TVariant
): PairOrder<TVariant>[] {
  if (!Number.isInteger(repetitions) || repetitions < 1) {
    throw new Error("repetitions must be a positive integer");
  }
  if (baseline === candidate) throw new Error("variants must be distinct");

  const random = mulberry32(seed);
  const orders: PairOrder<TVariant>[] = [];

  for (let index = 0; index < repetitions; index += 2) {
    const first: [TVariant, TVariant] =
      random() < 0.5 ? [baseline, candidate] : [candidate, baseline];
    orders.push({ pairIndex: index, order: first });

    if (index + 1 < repetitions) {
      orders.push({
        pairIndex: index + 1,
        order: [first[1], first[0]],
      });
    }
  }

  return orders;
}
