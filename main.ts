// PORT VERONA build entry (make.fun gta6-01) — written from scratch.
// Copies game/ and screenshots/ into the output dir, then writes dossier.json
// using buildDossier from ./vendor/makefun-game.ts. Node 22, stdlib only.
import { cp, mkdir, writeFile } from 'node:fs/promises';
import { buildDossier } from './vendor/makefun-game.ts';

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

await mkdir(outDir, { recursive: true });
await cp('game', `${outDir}/game`, { recursive: true });
await cp('screenshots', `${outDir}/screenshots`, { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

await writeFile(`${outDir}/dossier.json`, dossier);
console.log(`dossier written to ${outDir}/dossier.json (${dossier.length} bytes)`);
