/**
 * @ultemica/yaneuraou-wasm-kp256-cfworkers
 *
 * YaneuraOu shogi engine for Cloudflare Workers (Wasm).
 *
 * Eval (NNUE nn.bin) and book files are NOT embedded in the Wasm binary.
 * Pass them as ArrayBuffer at runtime via `createEngine()`.
 * The loader writes them into Emscripten's MEMFS so the C++ engine opens
 * them transparently through the standard `EvalDir` / `BookDir` UCI
 * options.
 *
 * The Wasm binary is built with `--pre-js wasm_pre.js`, which exposes:
 *   - `instance.postMessage(cmd)` — queue a USI command
 *   - `instance.addMessageListener(fn)` — subscribe to engine stdout
 *   - `instance.removeMessageListener(fn)`
 *   - `instance.terminate()`
 *
 * Commands are dispatched via `ccall("usi_command", ...)` internally
 * (same mechanism the proven edge variant uses).
 *
 * ## Usage (Cloudflare Workers)
 *
 * ```ts
 * import { createEngine } from "@ultemica/yaneuraou-wasm-kp256-cfworkers";
 * import YaneuraOuFactory from "@ultemica/yaneuraou-wasm-kp256-cfworkers/engine";
 * import wasmBinary from "@ultemica/yaneuraou-wasm-kp256-cfworkers/wasm";
 *
 * const engine = await createEngine({
 *   factory: YaneuraOuFactory,
 *   wasmBinary,
 *   evalBin: await env.ASSETS.fetch("/eval/nn.bin").then(r => r.arrayBuffer()),
 * });
 *
 * const result = await engine.eval({ sfen: "...", byoyomi: 1000 });
 * return Response.json(result);
 * ```
 */
// -------------------------------------------------------------------
// Implementation
// -------------------------------------------------------------------
export async function createEngine(opts) {
    const usiHash = opts.usiHash ?? 16;
    const handshakeTimeout = opts.handshakeTimeoutMs ?? 10_000;
    const readyTimeout = opts.readyTimeoutMs ?? 30_000;
    // 1. Instantiate the Wasm module.
    const lines = [];
    const instance = await opts.factory({ wasmBinary: opts.wasmBinary });
    instance.addMessageListener((line) => {
        lines.push(line);
    });
    // 2. Write eval / book files into MEMFS.
    if (opts.evalBin) {
        const evalFile = opts.evalFile ?? "nn.bin";
        instance.FS.mkdirTree("/eval");
        instance.FS.writeFile(`/eval/${evalFile}`, new Uint8Array(opts.evalBin));
    }
    if (opts.bookDb && opts.bookFile) {
        instance.FS.mkdirTree("/book");
        instance.FS.writeFile(`/book/${opts.bookFile}`, new Uint8Array(opts.bookDb));
    }
    // 3. USI handshake.
    await sendAndWait(instance, "usi", () => lines.includes("usiok"), handshakeTimeout, "usi -> usiok timeout");
    // 4. Configure engine options.
    instance.postMessage("setoption name Threads value 1");
    instance.postMessage(`setoption name USI_Hash value ${usiHash}`);
    instance.postMessage(`setoption name Hash value ${usiHash}`);
    if (opts.evalBin) {
        instance.postMessage("setoption name EvalDir value /eval");
    }
    if (opts.bookDb && opts.bookFile) {
        instance.postMessage("setoption name BookDir value /book");
        instance.postMessage(`setoption name BookFile value ${opts.bookFile}`);
    }
    // 5. Initial readyok (triggers NNUE weight loading + hash allocation).
    const initMark = lines.length;
    await sendAndWait(instance, "isready", () => lines.slice(initMark).includes("readyok"), readyTimeout, "initial isready -> readyok timeout");
    // Serialization chain for eval() / evalBatch().
    let chain = Promise.resolve();
    const serial = (fn) => {
        const next = chain.then(fn, fn);
        chain = next.catch(() => undefined);
        return next;
    };
    function applyRequestOptions(req) {
        instance.postMessage(`setoption name MultiPV value ${req.multiPv ?? 1}`);
        instance.postMessage(`setoption name SkillLevel value ${req.skillLevel ?? 20}`);
        instance.postMessage(`setoption name DepthLimit value ${req.depthLimit ?? 0}`);
        instance.postMessage(`setoption name NodesLimit value ${req.nodesLimit ?? 0}`);
    }
    async function runOnePosition(req) {
        instance.postMessage(`position sfen ${req.sfen}`);
        const movetime = req.byoyomi ?? 500;
        const goMark = lines.length;
        instance.postMessage(`go movetime ${movetime}`);
        const ok = await waitFor(() => lines.slice(goMark).some((l) => l.startsWith("bestmove")), movetime + 30_000);
        if (!ok) {
            throw new Error(`go movetime ${movetime} -> bestmove timeout`);
        }
        return parseGoResult(lines.slice(goMark));
    }
    async function evalPosition(req) {
        return serial(async () => {
            applyRequestOptions(req);
            instance.postMessage("usinewgame");
            const readyMark = lines.length;
            await sendAndWait(instance, "isready", () => lines.slice(readyMark).includes("readyok"), readyTimeout, "eval isready -> readyok timeout");
            const result = await runOnePosition(req);
            lines.length = 0;
            return result;
        });
    }
    async function evalBatchPositions(reqs) {
        if (reqs.length === 0)
            return [];
        return serial(async () => {
            applyRequestOptions(reqs[0]);
            instance.postMessage("usinewgame");
            const readyMark = lines.length;
            await sendAndWait(instance, "isready", () => lines.slice(readyMark).includes("readyok"), readyTimeout, "evalBatch isready -> readyok timeout");
            const results = [];
            for (const req of reqs) {
                results.push(await runOnePosition(req));
            }
            lines.length = 0;
            return results;
        });
    }
    function dispose() {
        try {
            instance.terminate();
        }
        catch {
            /* ignore */
        }
    }
    return {
        send: (cmd) => instance.postMessage(cmd),
        eval: evalPosition,
        evalBatch: evalBatchPositions,
        dispose,
    };
}
// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(pred, timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (pred())
            return true;
        await sleep(1);
    }
    return false;
}
async function sendAndWait(instance, command, pred, timeoutMs, errorMessage) {
    instance.postMessage(command);
    if (!(await waitFor(pred, timeoutMs))) {
        throw new Error(errorMessage);
    }
}
function parseGoResult(goLines) {
    const bestmoveLine = goLines.find((l) => l.startsWith("bestmove")) ?? "bestmove resign";
    const bm = bestmoveLine.match(/^bestmove\s+(\S+)(?:\s+ponder\s+(\S+))?/);
    const bestmove = bm?.[1] ?? "resign";
    const ponder = bm?.[2] ?? null;
    const infos = goLines.filter((l) => l.startsWith("info") && l.includes(" score "));
    const lastInfo = infos[infos.length - 1] ?? null;
    let score = null;
    let depth = null;
    let seldepth = null;
    let nodes = null;
    let timeMs = null;
    let pv = null;
    if (lastInfo) {
        const sm = lastInfo.match(/\bscore (cp|mate) (-?\d+)(?:\s+(lowerbound|upperbound))?/);
        if (sm) {
            score = {
                kind: sm[1],
                value: Number(sm[2]),
                ...(sm[3]
                    ? { bound: sm[3] }
                    : {}),
            };
        }
        const dm = lastInfo.match(/\bdepth (\d+)/);
        if (dm)
            depth = Number(dm[1]);
        const sdm = lastInfo.match(/\bseldepth (\d+)/);
        if (sdm)
            seldepth = Number(sdm[1]);
        const nm = lastInfo.match(/\bnodes (\d+)/);
        if (nm)
            nodes = Number(nm[1]);
        const tm = lastInfo.match(/\btime (\d+)/);
        if (tm)
            timeMs = Number(tm[1]);
        const pvm = lastInfo.match(/\bpv\s+(.+)$/);
        if (pvm)
            pv = pvm[1].trim().split(/\s+/);
    }
    return {
        bestmove,
        ponder,
        score,
        depth,
        seldepth,
        nodes,
        timeMs,
        pv,
        lastInfo,
        bestmoveLine,
    };
}
