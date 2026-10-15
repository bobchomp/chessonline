// Builds public/openings.json from the Lichess chess-openings dataset
// (https://github.com/lichess-org/chess-openings, CC0 / public domain).
//
//   node scripts/build-openings.mjs path/to/dir-with-a-to-e.tsv
//
// Output: { "<position key>": ["ECO", "Name"], ... } where the key is the first
// four FEN fields (pieces, side to move, castling, en passant) as chess.js
// writes them, so lookups use exactly the same notation.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Chess } from "chess.js";

const dir = process.argv[2];
if (!dir) throw new Error("usage: node scripts/build-openings.mjs <dir with a.tsv … e.tsv>");

const key = (fen) => fen.split(" ").slice(0, 4).join(" ");
const out = {};
for (const f of ["a", "b", "c", "d", "e"]) {
  const lines = readFileSync(join(dir, `${f}.tsv`), "utf8").trim().split("\n").slice(1);
  for (const line of lines) {
    const [eco, name, pgn] = line.split("\t");
    const chess = new Chess();
    for (const tok of pgn.split(/\s+/)) if (!/^\d+\.$/.test(tok)) chess.move(tok);
    // Later (more specific) entries for the same position win.
    out[key(chess.fen())] = [eco, name];
  }
}
writeFileSync("public/openings.json", JSON.stringify(out));
console.log(`${Object.keys(out).length} positions → public/openings.json`);
