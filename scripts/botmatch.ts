// Headless bot-vs-bot balance probe. Runs many full matches with the CPU bot
// and reports win rates, round length, damage sources, meter and card usage.
// Usage: npx tsx scripts/botmatch.ts [matches] [easy|normal|hard]
import '../src/content/index';
import { BOT_LEVELS, Bot } from '../src/ai/bot';
import { createMatch, defaultConfig, step } from '../src/core/sim';
import { getFighter } from '../src/core/registry';

const matches = Number(process.argv[2] ?? 40);
const level = (process.argv[3] ?? 'hard') as keyof typeof BOT_LEVELS;

interface Agg {
  wins: number;
  rounds: number;
  frames: number;
  damage: number;
  hits: number;
  blocks: number;
  pblocks: number;
  throws: number;
  cards: Record<string, number>;
  cines: number;
  meterUsed: number;
}

function runPairing(a: string, b: string, loadA?: string[], loadB?: string[]) {
  const agg: [Agg, Agg] = [0, 1].map(() => ({ wins: 0, rounds: 0, frames: 0, damage: 0, hits: 0, blocks: 0, pblocks: 0, throws: 0, cards: {}, cines: 0, meterUsed: 0 })) as [Agg, Agg];
  let totalRoundFrames = 0;
  let roundCount = 0;
  let timeouts = 0;
  for (let m = 0; m < matches; m++) {
    const seed = 1000 + m * 7919;
    const s = createMatch(defaultConfig({ fighters: [a, b], seed, loadouts: [loadA ?? getFighter(a).defaultLoadout, loadB ?? getFighter(b).defaultLoadout] }));
    const mix = (x: number) => {
      x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
      x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
      return (x ^ (x >>> 16)) >>> 0;
    };
    const bots = [new Bot(BOT_LEVELS[level], mix(seed * 2 + 1)), new Bot(BOT_LEVELS[level], mix(seed * 2 + 2))];
    let roundStart = 0;
    for (let f = 0; f < 60 * 60 * 6 && s.phase !== 'matchOver'; f++) {
      const ev = step(s, [bots[0].poll(s, 0), bots[1].poll(s, 1)]);
      for (const e of ev) {
        if (e.t === 'fight') roundStart = s.frame;
        if (e.t === 'hit') {
          agg[e.a].damage += e.damage;
          agg[e.a].hits++;
        }
        if (e.t === 'block') agg[e.d].blocks++;
        if (e.t === 'perfectBlock') agg[e.d].pblocks++;
        if (e.t === 'throwHit') {
          agg[e.a].throws++;
          agg[e.a].damage += e.damage;
        }
        if (e.t === 'cineHit' && s.cine) agg[s.cine.owner].damage += e.damage;
        if (e.t === 'cineStart') agg[e.owner].cines++;
        if (e.t === 'card') {
          const c = agg[e.p].cards;
          c[e.card] = (c[e.card] ?? 0) + 1;
        }
        if (e.t === 'timeover') timeouts++;
        if (e.t === 'ko' || e.t === 'timeover') {
          totalRoundFrames += s.frame - roundStart;
          roundCount++;
        }
      }
    }
    if (s.matchWinner === 0 || s.matchWinner === 1) agg[s.matchWinner].wins++;
    agg[0].rounds += s.fighters[0].roundsWon;
    agg[1].rounds += s.fighters[1].roundsWon;
  }
  console.log(`\n=== ${a.toUpperCase()} vs ${b.toUpperCase()} · ${matches} matches · bot level ${level}`);
  console.log(`avg round length ${(totalRoundFrames / Math.max(1, roundCount) / 60).toFixed(1)}s · time-outs ${timeouts}/${roundCount} rounds`);
  agg.forEach((g, i) => {
    const name = i === 0 ? a : b;
    console.log(
      `${name.padEnd(6)} wins ${String(g.wins).padStart(3)} (${((100 * g.wins) / matches).toFixed(0)}%) rounds ${g.rounds} · dmg/match ${(g.damage / matches).toFixed(0)} · hits ${(g.hits / matches).toFixed(1)} · blocks ${(g.blocks / matches).toFixed(1)} (perfect ${(g.pblocks / matches).toFixed(1)}) · throws ${(g.throws / matches).toFixed(1)} · cinematics ${g.cines} · cards ${JSON.stringify(g.cards)}`,
    );
  });
}

const pairs = (process.argv[4] ?? 'jazeek:bonez,bonez:jazeek,jazeek:jazeek,bonez:bonez').split(',');
for (const p of pairs) {
  const [a, b] = p.split(':');
  runPairing(a, b);
}
