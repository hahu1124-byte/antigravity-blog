// 将棋 CPU の WASM abort を再現して、落ちたときの様子を残す
// 使い方: node repro.mjs <段階A> <段階B> <局数> <名前> [hash=16] [mode=reuse|fresh]
//   段階は levels.js の番号（1〜10）か「局面数:候補数:幅」
//   mode=fresh は 1 手ごとにエンジンを開き直す（累積かどうかの切り分け）
// 出力: 1 局ごとの進み具合（何局中何局・経過・abort の数）、落ちたら out/<名前>-abortN.json
import fs from "node:fs";
import path from "node:path";

const BLOG = "H:/gravity/projects/antigravity-blog/src/";
const game = new URL(`file:///${BLOG}game/shogi/`);
const lab = new URL(`file:///${BLOG}lab/shogi/js/`);
const { Position, legalMoves, moveFromUsi, moveToUsi } = await import(
  new URL("core.js", lab).href
);
const { LEVELS } = await import(new URL("js/levels.js", game).href);
const { parseCandidates, pick } = await import(new URL("js/cpu.js", game).href);
const factory = (await import(new URL("engine/yaneuraou.js", game).href))
  .default;

const [
  a,
  b,
  nGames = "10",
  name = "run",
  hash = "16",
  mode = "reuse",
] = process.argv.slice(2);
const OUT = path.join(import.meta.dirname, "out");
fs.mkdirSync(OUT, { recursive: true });

const levelOf = (arg) => {
  if (!arg?.includes(":")) return LEVELS.find((l) => l.id === Number(arg));
  const [nodes, multiPv, margin] = arg.split(":");
  return {
    id: arg,
    name: arg,
    nodes: +nodes,
    multiPv: +multiPv,
    margin: +margin,
    byoyomi: 3000,
  };
};
const levels = [levelOf(a), levelOf(b)];

const wasmBinary = fs.readFileSync(new URL("engine/yaneuraou.wasm", game));
const evalBin = fs.readFileSync(new URL("engine/nn.bin", game));
const wasmModule = new WebAssembly.Module(wasmBinary);
const hasNames =
  WebAssembly.Module.customSections(wasmModule, "name").length > 0;

let serial = 0;
// エンジンを開く（cpu.js の openEngine と同じ手順＋記録）
async function openEngine() {
  const id = ++serial;
  const rec = {
    id,
    cmds: [],
    err: [],
    grow: [],
    abortStack: null,
    thinks: 0,
    mem: null,
  };
  let memory;
  const inst = await factory({
    printErr: (l) => rec.err.push(l),
    instantiateWasm(imports, done) {
      const env = imports.env;
      const origAbort = env._abort_js;
      env._abort_js = () => {
        rec.abortStack = new Error("abort の呼び出し元").stack;
        return origAbort();
      };
      const origGrow = env.emscripten_resize_heap;
      env.emscripten_resize_heap = (req) => {
        const before = memory.buffer.byteLength;
        const ok = origGrow(req);
        rec.grow.push({
          think: rec.thinks,
          req: req >>> 0,
          before,
          after: memory.buffer.byteLength,
          ok: !!ok,
        });
        return ok;
      };
      WebAssembly.instantiate(wasmModule, imports).then((i) => {
        memory = i.exports.memory;
        done(i, wasmModule);
      });
      return {};
    },
  });
  const lines = [];
  inst.addMessageListener((l) => lines.push(l));
  inst.FS.mkdirTree("/eval");
  inst.FS.writeFile("/eval/nn.bin", new Uint8Array(evalBin));
  const send = (cmd) => {
    rec.cmds.push(cmd);
    inst.postMessage(cmd);
  };
  const until = async (pred, ms, what) => {
    const t0 = Date.now();
    while (!pred()) {
      if (Date.now() - t0 > ms) throw new Error(`${what} の返事がない`);
      await new Promise((r) => setTimeout(r, 1));
    }
  };
  send("usi");
  await until(() => lines.includes("usiok"), 10000, "usi");
  const usiLines = [...lines];
  send("setoption name Threads value 1");
  send(`setoption name USI_Hash value ${hash}`);
  send("setoption name EvalDir value /eval");
  const ready = async () => {
    lines.length = 0;
    send("isready");
    await until(() => lines.includes("readyok"), 30000, "isready");
  };
  await ready();
  return {
    rec,
    usiLines,
    lines,
    send,
    until,
    ready,
    memBytes: () => memory.buffer.byteLength,
    dispose: () => inst.terminate(),
  };
}

// cpu.js の think と同じ（記録つき）
async function think(engine, position, level) {
  const { lines, send, until, ready, rec } = engine;
  rec.thinks++;
  send(`setoption name MultiPV value ${level.multiPv ?? 1}`);
  send(`setoption name NodesLimit value ${level.nodes ?? 0}`);
  // mode=noready: 毎手の isready を送らない（開いたときの 1 回だけ）
  if (mode === "noready") lines.length = 0;
  else await ready();
  send(`position sfen ${position}`);
  const movetime = level.byoyomi ?? 3000;
  send(`go movetime ${movetime}`);
  await until(
    () => lines.some((l) => l.startsWith("bestmove")),
    movetime + 20000,
    "go",
  );
  const best = lines.find((l) => l.startsWith("bestmove")).split(/\s+/)[1];
  const candidates = parseCandidates(lines);
  rec.mem = engine.memBytes();
  candCount.set(candidates.length, (candCount.get(candidates.length) ?? 0) + 1);
  return { move: pick(best, candidates, level), candidates };
}

const START = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1";
const OPENINGS = [
  "7g7f 3c3d 2g2f 4c4d",
  "2g2f 8c8d 2f2e 8d8e",
  "7g7f 8c8d 2g2f 8d8e",
  "7g7f 3c3d 6g6f 8c8d",
  "2g2f 3c3d 7g7f 4c4d",
  "7g7f 3c3d 2g2f 4a3b",
  "5g5f 3c3d 7g7f 8c8d",
  "7g7f 3c3d 8h2b+ 3a2b",
  "2g2f 8c8d 7g7f 8d8e",
  "7g7f 4c4d 2g2f 4a3b",
];
const MAX_PLIES = 320;

const engines = [null, null];
const candCount = new Map(); // 候補の数ごとの回数（MultiPV が効いているかの確認）
let aborts = 0;
let thinksTotal = 0;
const memMax = [0, 0];

async function thinkWithRecord(side, position, level, gameNo, ply) {
  for (let i = 0; i < 4; i++) {
    if (!engines[side] || mode === "fresh") {
      engines[side]?.dispose();
      engines[side] = await openEngine();
    }
    const e = engines[side];
    try {
      thinksTotal++;
      const r = await think(e, position, level);
      memMax[side] = Math.max(memMax[side], e.rec.mem);
      return r;
    } catch (err) {
      aborts++;
      const f = path.join(OUT, `${name}-abort${aborts}.json`);
      fs.writeFileSync(
        f,
        JSON.stringify(
          {
            game: gameNo,
            ply,
            side,
            level,
            hash,
            mode,
            message: String(err?.message ?? err),
            jsStack: err?.stack,
            abortStack: e.rec.abortStack,
            stderr: e.rec.err,
            engineId: e.rec.id,
            thinksOnEngine: e.rec.thinks,
            memBytes: (() => {
              try {
                return e.memBytes();
              } catch {
                return null;
              }
            })(),
            grow: e.rec.grow,
            position,
            lastLines: e.lines.slice(-30),
            cmds: e.rec.cmds,
          },
          null,
          1,
        ),
      );
      console.log(
        `  abort #${aborts}: 局${gameNo} ${ply}手目 side${side} エンジン${e.rec.id}の${e.rec.thinks}回目 mem=${(() => {
          try {
            return e.memBytes();
          } catch {
            return "?";
          }
        })()} 「${String(err?.message ?? err).slice(0, 80)}」 → ${path.basename(f)}`,
      );
      try {
        e.dispose();
      } catch {}
      engines[side] = null;
    }
  }
  return null;
}

const t0 = performance.now();
let gameNo = 0;
const N = Number(nGames);
console.log(
  `段階 ${levels[0].name} 対 ${levels[1].name}・${N} 局・hash ${hash}・${mode}・name セクション ${hasNames}`,
);
while (gameNo < N) {
  const opening = OPENINGS[Math.floor(gameNo / 2) % OPENINGS.length];
  const swap = gameNo % 2;
  const lv = swap ? [levels[1], levels[0]] : levels;
  gameNo++;
  const pos = Position.fromSfen(START);
  const usi = [];
  for (const u of opening.split(" ")) {
    pos.doMove(moveFromUsi(pos, u));
    usi.push(u);
  }
  let end = "手数の上限";
  const seen = new Map();
  while (usi.length < MAX_PLIES) {
    const side = usi.length % 2;
    const eSide = swap ? side ^ 1 : side; // エンジンは段階に付く
    const position = `${START} moves ${usi.join(" ")}`;
    const r = await thinkWithRecord(eSide, position, lv[side], gameNo, usi.length);
    let mv = r?.move;
    if (!r) {
      end = "4 回とも落ちた";
      break;
    }
    if (mv === "resign" || mv === "win") {
      end = mv;
      break;
    }
    const m = moveFromUsi(pos, mv);
    if (m === null) {
      end = `反則 ${mv}`;
      break;
    }
    pos.doMove(m);
    usi.push(moveToUsi(m));
    if (legalMoves(pos).length === 0) {
      end = "詰み";
      break;
    }
    const k = pos.key();
    seen.set(k, (seen.get(k) ?? 0) + 1);
    if (seen.get(k) >= 4) {
      end = "千日手";
      break;
    }
  }
  const sec = (performance.now() - t0) / 1000;
  console.log(
    `[${gameNo}/${N}] ${end}・${usi.length}手・経過 ${sec.toFixed(0)}秒・残り目安 ${((sec / gameNo) * (N - gameNo)).toFixed(0)}秒・abort 累計 ${aborts}・考えた回数 ${thinksTotal}・mem ${memMax.map((m) => (m / 1048576).toFixed(0) + "MB").join("/")}`,
  );
}
console.log(
  `終わり: ${N} 局・abort ${aborts} 回・考えた回数 ${thinksTotal}・${((performance.now() - t0) / 1000).toFixed(0)}秒`,
);
console.log(
  "候補の数ごとの回数:",
  JSON.stringify(Object.fromEntries([...candCount].sort((x, y) => x[0] - y[0]))),
);
for (const e of engines) e?.dispose();
process.exit(0);
