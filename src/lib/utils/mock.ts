function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * 6 pontos com variação ±10% determinística baseada no seed.
 * Usado pra sparkline de MRR até histórico real existir.
 */
export function mockMrrHistory(currentMrr: number, seed: string): number[] {
  const seedNum = hashStr(seed);
  const result: number[] = [];
  for (let i = 0; i < 6; i++) {
    const jitter = (((seedNum + i * 31) % 21) - 10) / 100;
    result.push(Math.max(0, currentMrr * (1 + jitter)));
  }
  return result;
}
