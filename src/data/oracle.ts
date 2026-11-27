// 龜殼圖集的局部座標（每格 128 × 128），左右翻面時沿用同一組定位。
export const ORACLE_MARKS = [[29, 82], [61, 63], [82, 75]] as const;

export function oracleImpact(skill: string): [number, number] {
  if (['bigquake', 'microquake', 'frostcrack', 'oracle_tide'].includes(skill)) return [64, 122];
  if (skill === 'gh_toss') return [60, 52];
  return [64, 77];
}

export function nextOracleMark(lit: number[], skill: string) {
  const [x,y] = oracleImpact(skill);
  const distance = (id: number) => (ORACLE_MARKS[id][0] - x) ** 2 + (ORACLE_MARKS[id][1] - y) ** 2;
  return [0,1,2].filter(id => !lit.includes(id)).sort((a,b) => distance(a) - distance(b))[0];
}
