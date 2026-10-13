// 詰将棋ソルバー（df-pn）
// 攻め方の局面（OR）は王手だけ、受け方の局面（AND）は全部の合法手を読む。
// pn＝詰みを示すのに要る手の見積もり、dn＝不詰を示すのに要る手の見積もり（どちらも攻め方から見た値）。
// 1. まず手数を気にせず詰むかを調べる（置換表 tt）。
// 2. 詰むなら、深さ制限つきの df-pn（残り d 手以内に詰むか。深さごとの置換表 dtt）で最短の手数を求め、
//    本筋をたどる: 攻め方は最短で詰ます王手、受け方は詰むまでが最長になる手
//    （同じ手数なら攻め方の持ち駒が余らない方）。
// 無駄合は簡易判定: 合駒を取った後、取った駒を使わなくても詰むなら数えない（本筋の上だけで判定）。
import {
  legalMoves,
  checkMoves,
  isDrop,
  dropType,
  moveTo,
  KA,
  HI,
  KY,
  UM,
  RY,
} from "./core.js";

const INF = 100000000;
// 無駄合の判定で「取った駒を使わずに詰むか」を調べる上限（局面数）
const FUTILE_BUDGET = 20000;
const PROVED = { pn: 0, dn: INF };
const DISPROVED = { pn: INF, dn: 0 };
const REPEAT = DISPROVED; // 同じ局面に戻る手は詰まない扱い（連続王手の千日手は攻め方の負け）
const UNKNOWN = { pn: 1, dn: 1 };
const EPS = 1.25;

class Aborted extends Error {}
class LocalAbort extends Error {}

export class Solver {
  constructor({
    timeLimitMs = 15000,
    maxNodes = 50000000,
    onProgress = null,
  } = {}) {
    this.timeLimitMs = timeLimitMs;
    this.maxNodes = maxNodes;
    this.onProgress = onProgress;
    this.tt = new Map();
    this.dtt = [];
    this.nodes = 0;
    this.localLimit = Infinity;
  }

  // 結果: { status: "mate" | "nomate" | "timeout", moves, len, nodes, ms, approx, futile }
  // approx: 手順の取り出しが時間切れ（最短・最長の手順とは限らない）
  // futile: 本筋で無駄合を除いた所がある
  solve(pos) {
    const t0 = performance.now();
    this.deadline = t0 + this.timeLimitMs;
    this.nodes = 0;
    const done = (r) => ({
      ...r,
      nodes: this.nodes,
      ms: Math.round(performance.now() - t0),
    });
    let root;
    try {
      root = this.prove(pos, true);
    } catch (e) {
      if (e instanceof Aborted)
        return done({ status: "timeout", moves: [], len: 0 });
      throw e;
    }
    if (root.pn !== 0) return done({ status: "nomate", moves: [], len: 0 });

    // 手順の取り出し（同じ時間をもう一度使える）
    this.deadline = performance.now() + this.timeLimitMs;
    this.futile = false;
    this.walkMemo = new Map();
    let moves,
      approx = false;
    try {
      moves = this.extractLine(pos);
    } catch (e) {
      if (!(e instanceof Aborted)) throw e;
      moves = this.greedyLine(pos);
      approx = true;
    }
    return done({
      status: "mate",
      moves,
      len: moves.length,
      approx,
      futile: this.futile,
    });
  }

  tick() {
    this.nodes++;
    if (this.nodes > this.localLimit) throw new LocalAbort();
    if ((this.nodes & 4095) === 0) {
      if (performance.now() > this.deadline || this.nodes > this.maxNodes)
        throw new Aborted();
      if (this.onProgress) this.onProgress({ nodes: this.nodes });
    }
  }

  // ---- df-pn ----
  // d < 0: 手数の制限なし（tt）。d >= 0: 残り d 手以内に詰むか（dtt[d]）
  lookup(key, path, d) {
    if (path.has(key)) return REPEAT;
    if (d < 0) return this.tt.get(key) ?? UNKNOWN;
    const m = this.tt.get(key);
    if (m && m.dn === 0) return DISPROVED; // 何手かけても詰まない
    return this.dtt[d]?.get(key) ?? UNKNOWN;
  }

  store(key, d, e) {
    if (d < 0) this.tt.set(key, e);
    else (this.dtt[d] ??= new Map()).set(key, e);
  }

  prove(pos, isOr, d = -1) {
    const e = this.lookup(pos.key(), new Set(), d);
    if (e.pn === 0 || e.dn === 0) return e;
    return this.mid(pos, isOr, INF, INF, new Set(), d);
  }

  // 読む局面数に上限を付けて prove。上限に届いたら null（分からない）
  proveLimited(pos, isOr, budget) {
    const save = this.localLimit;
    this.localLimit = Math.min(save, this.nodes + budget);
    try {
      return this.prove(pos, isOr);
    } catch (e) {
      // 外側の上限に届いた場合も、外側の次の tick でまた投げられるのでここでは null でよい
      if (e instanceof LocalAbort) return null;
      throw e;
    } finally {
      this.localLimit = save;
    }
  }

  mid(pos, isOr, thPn, thDn, path, d) {
    this.tick();
    const key = pos.key();
    const limited = d >= 0;
    let moves = null,
      term = null;
    if (limited && isOr && d < 1) term = DISPROVED;
    else {
      moves = isOr ? checkMoves(pos) : legalMoves(pos);
      if (moves.length === 0) term = isOr ? DISPROVED : PROVED;
      else if (limited && !isOr && d < 2) term = DISPROVED; // 受けた後に詰ます手数が残っていない
    }
    if (term) {
      this.store(key, d, term);
      return term;
    }
    const cd = limited ? d - 1 : -1;
    const keys = new Array(moves.length);
    for (let i = 0; i < moves.length; i++) {
      pos.doMove(moves[i]);
      const k = (keys[i] = pos.key());
      if (!path.has(k) && this.lookup(k, path, cd) === UNKNOWN)
        this.store(k, cd, this.initial(pos, !isOr, cd));
      pos.undoMove(moves[i]);
    }
    path.add(key);
    let pn = 1,
      dn = 1;
    for (;;) {
      let best = -1,
        bestV = INF + 1,
        second = INF,
        sum = 0;
      for (let i = 0; i < keys.length; i++) {
        const c = this.lookup(keys[i], path, cd);
        const v = isOr ? c.pn : c.dn;
        sum += isOr ? c.dn : c.pn;
        if (v < bestV) {
          second = bestV;
          bestV = v;
          best = i;
        } else if (v < second) second = v;
      }
      if (sum > INF) sum = INF;
      if (bestV > INF) bestV = INF;
      if (second > INF) second = INF;
      if (isOr) {
        pn = bestV;
        dn = sum;
      } else {
        dn = bestV;
        pn = sum;
      }
      if (pn >= thPn || dn >= thDn) break;
      const c = this.lookup(keys[best], path, cd);
      // 1+ε: 2 番手との差に少し余裕を持たせて、子と兄弟の行き来を減らす
      const next =
        second >= INF ? INF : Math.max(second + 1, Math.ceil(second * EPS));
      let cPn, cDn;
      if (isOr) {
        cPn = Math.min(thPn, next);
        cDn = thDn - dn + c.dn;
      } else {
        cDn = Math.min(thDn, next);
        cPn = thPn - pn + c.pn;
      }
      pos.doMove(moves[best]);
      try {
        this.mid(pos, !isOr, cPn, cDn, path, cd);
      } finally {
        pos.undoMove(moves[best]);
      }
    }
    path.delete(key);
    const e = { pn, dn };
    this.store(key, d, e);
    return e;
  }

  // 初めて見る局面の見積もり: 相手の指せる手の数を使う（0 ならその場で詰み／不詰が決まる）
  initial(pos, isOr, d) {
    const limited = d >= 0;
    if (isOr) {
      if (limited && d < 1) return DISPROVED;
      const n = checkMoves(pos).length;
      return n === 0 ? DISPROVED : { pn: 1, dn: n };
    }
    const n = legalMoves(pos).length;
    if (n === 0) return PROVED;
    if (limited && d < 2) return DISPROVED;
    return { pn: n, dn: 1 };
  }

  mateWithin(pos, isOr, d) {
    return this.prove(pos, isOr, d).pn === 0;
  }

  // ---- 手順の取り出し ----
  extractLine(pos) {
    let L = 1;
    while (!this.mateWithin(pos, true, L)) L += 2;
    return this.walk(pos, true, L).line;
  }

  // 攻め方の番（isOr）で残り L 手の詰みをたどる。結果 { line, left }（left は最後に攻め方に残った持ち駒の数）
  walk(pos, isOr, L) {
    const mkey = `${pos.key()}:${isOr ? 1 : 0}:${L}`;
    const hit = this.walkMemo.get(mkey);
    if (hit) return hit;
    let result;
    if (isOr) {
      result = { line: [], left: handCount(pos, pos.side) };
      for (const m of this.orderedChecks(pos)) {
        pos.doMove(m);
        try {
          if (this.mateWithin(pos, false, L - 1)) {
            const r = this.walk(pos, false, L - 1);
            result = { line: [m, ...r.line], left: r.left };
            break;
          }
        } finally {
          pos.undoMove(m);
        }
      }
    } else {
      // 受け方: 合法手ごとに最短の詰み手数を求め、いちばん長いものを選ぶ
      const tied = [];
      let bestLen = -1;
      for (const m of legalMoves(pos)) {
        if (this.isFutileDrop(pos, m)) {
          this.futile = true;
          continue;
        }
        pos.doMove(m);
        let n = 1;
        try {
          while (n < L - 1 && !this.mateWithin(pos, true, n)) n += 2;
        } finally {
          pos.undoMove(m);
        }
        n = Math.min(n, Math.max(1, L - 1));
        if (n > bestLen) {
          bestLen = n;
          tied.length = 0;
        }
        if (n === bestLen) tied.push(m);
      }
      result = { line: [], left: handCount(pos, pos.side ^ 1) };
      let best = null;
      for (const m of tied) {
        pos.doMove(m);
        let r;
        try {
          r = this.walk(pos, true, bestLen);
        } finally {
          pos.undoMove(m);
        }
        if (!best || r.left < best.r.left) best = { m, r };
        if (best.r.left === 0) break;
      }
      if (best) result = { line: [best.m, ...best.r.line], left: best.r.left };
    }
    this.walkMemo.set(mkey, result);
    return result;
  }

  // 詰むと分かっている王手から先に並べる
  orderedChecks(pos) {
    return checkMoves(pos)
      .map((m) => {
        pos.doMove(m);
        const e = this.tt.get(pos.key());
        pos.undoMove(m);
        return [e && e.pn === 0 ? 0 : e && e.dn === 0 ? 2 : 1, m];
      })
      .sort((a, b) => a[0] - b[0])
      .map((x) => x[1]);
  }

  // 受け方の合駒 m が無駄合か: 攻め方がその駒を取り、取った駒を持ち駒から除いても詰むなら無駄合
  isFutileDrop(pos, m) {
    if (!isDrop(m) || !this.isInterposition(pos, moveTo(m))) return false;
    const to = moveTo(m),
      pt = dropType(m);
    const attacker = pos.side ^ 1;
    pos.doMove(m);
    let futile = false;
    try {
      for (const c of legalMoves(pos)) {
        if (moveTo(c) !== to) continue;
        pos.doMove(c);
        const n = pos.hand[attacker][pt];
        pos.setHand(attacker, pt, n - 1);
        try {
          futile = this.proveLimited(pos, false, FUTILE_BUDGET)?.pn === 0;
        } finally {
          pos.setHand(attacker, pt, n);
          pos.undoMove(c);
        }
        if (futile) break;
      }
    } finally {
      pos.undoMove(m);
    }
    return futile;
  }

  // sq が「受け方の玉」と「遠くから王手している駒」の間にあるか
  isInterposition(pos, sq) {
    const k = pos.king[pos.side];
    if (k < 0) return false;
    const kr = (k / 9) | 0,
      kc = k % 9,
      sr = (sq / 9) | 0,
      sc = sq % 9;
    const dr = Math.sign(sr - kr),
      dc = Math.sign(sc - kc);
    if (
      sr - kr !== 0 &&
      sc - kc !== 0 &&
      Math.abs(sr - kr) !== Math.abs(sc - kc)
    )
      return false;
    let r = kr + dr,
      c = kc + dc,
      passed = false;
    while (r >= 0 && r <= 8 && c >= 0 && c <= 8) {
      const p = pos.board[r * 9 + c];
      if (r === sr && c === sc) passed = true;
      else if (p) {
        if (!passed || p > 0 === (pos.side === 0)) return false;
        const a = Math.abs(p);
        const diag = dr !== 0 && dc !== 0;
        if (diag) return a === KA || a === UM;
        if (a === HI || a === RY) return true;
        // 香は前にしか利かない（攻め方の香の前方向に玉がいるか）
        return a === KY && dc === 0 && (p > 0 ? dr === -1 : dr === 1);
      }
      r += dr;
      c += dc;
    }
    return false;
  }

  // 取り出しが時間切れのときの代わり: 詰みが分かっている手を順にたどる（最短・最長とは限らない）
  greedyLine(pos) {
    const line = [];
    const seen = new Set([pos.key()]);
    let isOr = true;
    while (line.length < 999) {
      const moves = isOr ? checkMoves(pos) : legalMoves(pos);
      let pick = null;
      for (const m of moves) {
        pos.doMove(m);
        const k = pos.key();
        const e = this.tt.get(k);
        pos.undoMove(m);
        if (e && e.pn === 0 && !seen.has(k)) {
          seen.add(k);
          pick = m;
          break;
        }
      }
      if (pick === null) break;
      line.push(pick);
      pos.doMove(pick);
      isOr = !isOr;
    }
    for (let i = line.length - 1; i >= 0; i--) pos.undoMove(line[i]);
    return line;
  }
}

function handCount(pos, c) {
  let n = 0;
  for (let pt = 1; pt <= 7; pt++) n += pos.hand[c][pt];
  return n;
}
