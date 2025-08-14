import React, { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Users, Swords, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";

// =============================
// Jordy C BBQ Cup — Single File React App (Black & White Theme)
// =============================
// Modes:
// 1) Groups → Knockout (World-Cup style, 8–32 players, multiple of 4)
// 2) Single-Elimination (power of two: 4, 8, 16, 32)
// Target score configurable (11 or 21). No draws.
// LocalStorage persistence. Compact score inputs to avoid layout overlap.
// Boards on both sides styled to match the reference image.
// Added: Green highlight on saved matches; Champion screen uses white text and animated falling confetti.
// Bracket page is read-only with winner bean-bag icons and connector elbows.
// =============================

/** @typedef {{ id: string, name: string, seed: number }} Player */
/** @typedef {{ id: string, a: string, b: string, scoreA?: number, scoreB?: number, completed?: boolean }} Match */
/** @typedef {{ name: string, players: string[], matches: Match[] }} Group */
/** @typedef {"groups"|"single"} Mode */

// ---------- Utilities
const uid = () => Math.random().toString(36).slice(2, 10);
const chunk = (arr, size) => arr.reduce((acc, _, i) => (i % size ? acc : [...acc, arr.slice(i, i + size)]), []);
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Round-robin schedule for 4 teams (A,B,C,D) → 6 matches
const scheduleRoundRobin4 = (ids) => {
  const [A, B, C, D] = ids;
  return [
    { id: uid(), a: A, b: B },
    { id: uid(), a: A, b: C },
    { id: uid(), a: A, b: D },
    { id: uid(), a: B, b: C },
    { id: uid(), a: B, b: D },
    { id: uid(), a: C, b: D },
  ];
};

// Standings from played matches
const computeStandings = (group, playersIndex) => {
  const table = group.players.map((pid) => ({
    id: pid,
    name: playersIndex[pid]?.name || "?",
    P: 0, W: 0, L: 0, PF: 0, PA: 0, PD: 0, Pts: 0,
  }));
  const row = Object.fromEntries(table.map((r) => [r.id, r]));
  for (const m of group.matches) {
    if (!m.completed) continue;
    const a = row[m.a];
    const b = row[m.b];
    a.P++; b.P++;
    a.PF += m.scoreA; a.PA += m.scoreB; a.PD = a.PF - a.PA;
    b.PF += m.scoreB; b.PA += m.scoreA; b.PD = b.PF - b.PA;
    if (m.scoreA > m.scoreB) { a.W++; b.L++; a.Pts += 3; }
    else { b.W++; a.L++; b.Pts += 3; }
  }
  table.sort((x, y) =>
    y.Pts - x.Pts || y.PD - x.PD || y.PF - x.PF || x.name.localeCompare(y.name)
  );
  return table;
};

// Build knockout pairings: A1 vs B2, B1 vs A2, C1 vs D2, ...
const buildKnockout = (groups, playersIndex) => {
  const order = groups.map((g) => g.name).sort();
  const advancers = {};
  for (const g of groups) {
    const table = computeStandings(g, playersIndex);
    advancers[g.name] = [table[0]?.id, table[1]?.id];
  }
  const pairings = [];
  for (let i = 0; i < order.length; i += 2) {
    const g1 = order[i];
    const g2 = order[i + 1];
    if (!g2) break;
    const [g1w, g1r] = advancers[g1];
    const [g2w, g2r] = advancers[g2];
    if (g1w && g2r) pairings.push({ id: uid(), a: g1w, b: g2r });
    if (g2w && g1r) pairings.push({ id: uid(), a: g2w, b: g1r });
  }
  return pairings;
};

const save = (key, data) => localStorage.setItem(key, JSON.stringify(data));
const load = (key, fallback) => {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
};

// ---------- Scoring validation (pure, testable)
export const validateCornholeScore = (sa, sb, target = 21) => {
  if (sa == null || sb == null) return "Enter both scores";
  if (sa === sb) return "No draws in cornhole";
  const max = Math.max(sa, sb);
  const min = Math.min(sa, sb);
  if (max !== target) return `Winner must have exactly ${target}`;
  if (min >= target) return `Loser must be below ${target}`;
  return null;
};

// ---------- Single-elim helpers
const isPowerOfTwo = (n) => (n & (n - 1)) === 0;
const buildSingleElimFirstRound = (ids) => {
  const seeded = shuffle(ids);
  const round = [];
  for (let i = 0; i < seeded.length; i += 2) {
    round.push({ id: uid(), a: seeded[i], b: seeded[i+1] });
  }
  return round;
};

// ---------- Fixed black/white theme
const theme = {
  bgTop: "#111111",
  bgBottom: "#000000",
  primary: "#111111", // borders / pills
  accent: "#E5E7EB",  // light gray
  text: "#F9FAFB",    // near-white
};

// Board graphic updated per guide: white board, black triangle wedge rising to the hole, black hole ring
const Board = ({ className = "", flip = false }) => {
  const HOLE = 86;          // px diameter
  const HOLE_TOP = 52;      // px from top
  const APEX_Y = HOLE_TOP + HOLE - 10; // triangle apex sits just under the hole
  return (
    <div
      className={`absolute shadow-2xl rounded-[22px] overflow-hidden border-8 border-black ${className}`}
      style={{ backgroundColor: "#fff" }}
    >
      {/* black triangle wedge */}
      <div
        className="absolute inset-0"
        style={{
          clipPath: `polygon(0% 100%, 100% 100%, 50% ${APEX_Y}px)`,
          background: "#000",
        }}
      />
      {/* hole with black ring and dark interior */}
      <div
        className="absolute rounded-full"
        style={{
          width: HOLE,
          height: HOLE,
          top: HOLE_TOP,
          left: "50%",
          transform: "translateX(-50%)",
          background: "#0a0a0a",
          boxShadow: "inset 0 0 0 6px #000, inset 0 0 18px rgba(0,0,0,0.65)",
        }}
      />
    </div>
  );
};

// ---------- Background & boards layer
const CornholeBackdrop = () => (
  <div className="pointer-events-none fixed inset-0 -z-10">
    {/* dark vignette background */}
    <div className="absolute inset-0" style={{
      background: `radial-gradient(1200px 800px at 50% 20%, #1f1f1f, #000000)`
    }} />

    {/* Left board */}
    <Board className="-left-24 top-10 rotate-6 w-[520px] h-[980px]" flip={false} />
    {/* Right board */}
    <Board className="-right-28 bottom-0 -rotate-6 w-[520px] h-[980px]" flip={true} />
  </div>
);

const Bag = ({ className = "" }) => (
  <span className={`inline-flex items-center justify-center px-2 py-1 rounded-md font-black text-xs text-black bg-white shadow ${className}`}>
    🫘 BAG
  </span>
);
// Trophy image (place your file at: public/jordy-trophy.jpg)
const TROPHY_URL = "/jordy-trophy.jpg";
const BEAN_URL = "/bean-bag.png";

// Animated bean-bag icon with emoji fallback
const BeanIcon = ({ active, size = 16, animKey }) => {
  const [fallback, setFallback] = React.useState(false);
  if (!active) return null;
  const common = {
    initial: { scale: 0, y: -6, opacity: 0, rotate: -10 },
    animate: { scale: [1.2, 1], y: 0, opacity: 1, rotate: 0 },
    transition: { type: "spring", stiffness: 520, damping: 18 },
    className: "inline-block",
    style: { width: size, height: size },
  };
  return fallback ? (
    <motion.span key={`emo-${animKey}`} {...common} role="img" aria-label="bean">🫘</motion.span>
  ) : (
    <motion.img
      key={`img-${animKey}`}
      src={BEAN_URL}
      alt="bean bag"
      onError={() => setFallback(true)}
      {...common}
    />
  );
};

// Auto-replace certain names with "baldy"
const BALDY_TRIGGERS = new Set(["tom", "tommer", "turk", "gobbler"]);
const toBaldyIfNeeded = (s) => BALDY_TRIGGERS.has(String(s).trim().toLowerCase()) ? "baldy" : s;


// ---------- UI Components
const SetupForm = ({ onSetup, target, setTarget }) => {
  const [mode, setMode] = React.useState(() => load("ch_mode", "groups"));
  const [count, setCount] = React.useState("8");
  const [names, setNames] = React.useState(() => Array.from({ length: 8 }, () => ""));
  const [setupError, setSetupError] = React.useState("");
  const [missing, setMissing] = React.useState([]);
  const nameRefs = React.useRef([]);
  const [shakeTick, setShakeTick] = React.useState(0);

  React.useEffect(() => { save("ch_mode", mode); }, [mode]);

  React.useEffect(() => {
    const n = Number(count);
    if (!Number.isFinite(n)) return;
    const len = Math.min(32, Math.max(mode === "single" ? 4 : 8, n));
    const next = [...names];
    if (next.length < len) {
      for (let i = next.length; i < len; i++) next.push("");
    } else if (next.length > len) {
      next.length = len;
    }
    setNames(next);
  }, [count, mode]);

  // Clear any previous error when inputs change
  React.useEffect(() => { setSetupError(""); }, [names, count, mode]);

  // Clear red highlights if the structure of the form changes
  React.useEffect(() => { setMissing([]); }, [count, mode]);

  return (
    <Card className="backdrop-blur-md bg-white/75 shadow-2xl border-4" style={{ borderColor: theme.primary }}>
      <CardHeader className="flex flex-col items-center gap-2">
        <CardTitle className="text-3xl font-extrabold tracking-tight flex items-center gap-3 text-gray-900">
          <Users className="w-8 h-8"/> Jordy C BBQ Cup — Setup
        </CardTitle>
        <Bag />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center text-center">
          {/* Format */}
          <div className="space-y-2 max-w-xs w-full mx-auto md:mx-0">
            <label className="font-semibold">Format</label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="bg-white/80 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="groups">Groups → Knockout</SelectItem>
                  <SelectItem value="single">Single-Elimination</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* Target Score */}
          <div className="space-y-2 max-w-xs w-full mx-auto md:mx-0">
            <label className="font-semibold">Target Score</label>
            <Select value={String(target)} onValueChange={(v)=> setTarget(Number(v))}>
              <SelectTrigger className="bg-white/80 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="11">11</SelectItem>
                  <SelectItem value="21">21</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* Players */}
          <div className="space-y-2 md:col-start-3 md:justify-self-end md:text-right max-w-xs w-full"> 
            <label className="font-semibold">Players ({mode==="single"?"4, 8, 16, 32":"8–32, multiples of 4"})</label>
            <Select value={count} onValueChange={setCount}>
              <SelectTrigger className="bg-white/80 w-full">
                <SelectValue placeholder="8" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Total Players</SelectLabel>
                  {(mode === "single" ? [4,8,16,32] : [8,12,16,20,24,28,32]).map((n)=> (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {names.map((val, i) => (
            <motion.div
              key={i}
              animate={missing.includes(i) ? { x: [0, -6, 6, -4, 4, -2, 2, 0] } : { x: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Input
                ref={(el) => (nameRefs.current[i] = el)}
                value={val}
                onChange={(e)=>{
                  const next=[...names]; next[i]=toBaldyIfNeeded(e.target.value); setNames(next);
                  if (String(next[i]).trim()) setMissing((prev)=> prev.filter(j => j !== i));
                }}
                onFocus={(e)=> e.target.select()}
                placeholder={`Player ${i+1}`}
                className={"bg-white/80 text-center " + (missing.includes(i) ? "ring-2 ring-rose-500" : "")}
                aria-invalid={missing.includes(i)}
              />
            </motion.div>
          ))}
        </div>
        <div className="flex justify-center mt-2">
          <Button variant="destructive" onClick={() => setNames((prev)=>prev.map(()=> ""))}><Trash2 className="w-4 h-4 mr-2"/>Clear All</Button>
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className="text-sm opacity-80">
            {mode === "groups"
              ? <>Groups of 4 (round‑robin). Top two advance to the knockout. First to <b>{target}</b>.</>
              : <>Single-elimination bracket. Player count must be a power of two. First to <b>{target}</b>.</>
            }
          </div>
          <Button
            size="lg"
            onClick={() => {
              const trimmed = names.map(n => String(toBaldyIfNeeded(n)).trim());
              const sanitized = trimmed.filter(Boolean);
              const expected = Number(count);
              if (sanitized.length !== expected) {
                const missingIdx = trimmed
                  .map((s, i) => [s, i])
                  .filter(([s]) => !s)
                  .map(([, i]) => i);
                setMissing(missingIdx);
                setSetupError("Please enter " + expected + " player names (you've entered " + sanitized.length + ").");
                setShakeTick((t) => t + 1);
                const first = missingIdx[0];
                const el = nameRefs.current[first];
                if (el && typeof el.scrollIntoView === "function") {
                  el.scrollIntoView({ behavior: "smooth", block: "center" });
                  try { el.focus({ preventScroll: true }); el.select?.(); } catch {}
                }
                return;
              }
              setMissing([]);
              setSetupError("");
              onSetup({ names: sanitized, mode });
            }}
          >
            <Play className="w-4 h-4 mr-2"/> Start Tournament
          </Button>
          {setupError && <div className="text-sm text-rose-700">{setupError}</div>}
        </div>
      </CardContent>
    </Card>
  );
};

// Compact score input to prevent overlap
const ScoreInput = ({ value, onChange, label, max = 21 }) => (
  <div className="flex flex-col items-center gap-1">
    <span className="text-xs font-bold opacity-70 truncate max-w-[80px] text-center">{label}</span>
    <Input
      type="number"
      inputMode="numeric"
      min={0}
      max={max}
      className="w-14 h-8 p-1 text-sm bg-white/80 text-center"
      value={value ?? ""}
      onChange={(e)=> onChange(e.target.value === "" ? undefined : Number(e.target.value))}
    />
  </div>
);

const MatchCard = ({ match, playersIndex, onSubmit, disabled, target, variant = "default" }) => {
  const A = playersIndex[match.a]?.name;
  const B = playersIndex[match.b]?.name;
  const [sa, setSa] = React.useState(match.scoreA);
  const [sb, setSb] = React.useState(match.scoreB);
  React.useEffect(()=>{ setSa(match.scoreA); setSb(match.scoreB); }, [match.id, match.scoreA, match.scoreB]);

  const readOnly = variant === "bracket";
  const err = readOnly ? null : validateCornholeScore(sa, sb, target);

  return (
    <Card
      className={readOnly
        ? "border-2 bg-white/80 border-black/40 p-0"
        : `${match.completed
        ? "border-2 border-emerald-500 bg-emerald-50 shadow-[0_0_0_3px_rgba(16,185,129,0.35)]"
        : "border-2 bg-white/80 border-black/40"}`}
    >
      {/* In bracket mode we remove the header to shrink the box */}
      {!readOnly && (
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 justify-center">
            <Swords className="w-4 h-4"/> {A} vs {B}
          </CardTitle>
        </CardHeader>
      )}

      <CardContent className={readOnly ? "px-3 py-2" : "flex flex-wrap items-center gap-2 justify-center"}>
        {readOnly ? (
          <div className="text-[13px] leading-tight font-semibold text-gray-900">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate pr-1">{A}</span>
              <BeanIcon active={match.scoreA != null && match.scoreB != null && match.scoreA > match.scoreB} animKey={`${match.id}-${match.scoreA}-${match.scoreB}-A`} />
            </div>
            <div className="mt-1 pt-1 border-t border-black/20 flex items-center justify-between gap-2">
              <span className="truncate pr-1">{B}</span>
              <BeanIcon active={match.scoreA != null && match.scoreB != null && match.scoreB > match.scoreA} animKey={`${match.id}-${match.scoreA}-${match.scoreB}-B`} />
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <ScoreInput label={A} value={sa} onChange={setSa} max={target} />
              <span className="font-black">—</span>
              <ScoreInput label={B} value={sb} onChange={setSb} max={target} />
            </div>
            <Button size="sm" className="shrink-0 whitespace-nowrap" disabled={!!err || disabled} onClick={()=> onSubmit({ ...match, scoreA: sa, scoreB: sb, completed: true })}>
              Save Score
            </Button>
            {err && <div className="text-xs text-rose-700 w-full text-center">{err}</div>}
          </>
        )}
      </CardContent>
    </Card>
  );
};

const StandingsTable = ({ group, playersIndex }) => {
  const table = computeStandings(group, playersIndex);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-center">
        <thead>
          <tr className="text-white" style={{ backgroundColor: '#000000' }}>
            <th className="p-2 text-center rounded-l-lg">#</th>
            <th className="p-2 text-center">Player</th>
            <th className="p-2">P</th>
            <th className="p-2">W</th>
            <th className="p-2">L</th>
            <th className="p-2">PF</th>
            <th className="p-2">PA</th>
            <th className="p-2">PD</th>
            <th className="p-2 rounded-r-lg">Pts</th>
          </tr>
        </thead>
        <tbody>
          {table.map((r, i)=> (
            <tr key={r.id} className={`${i < 2 ? "bg-gray-100" : "bg-white"}`}>
              <td className="p-2 font-semibold text-center">{i+1}</td>
              <td className="p-2 font-semibold text-center">{r.name}</td>
              <td className="p-2 text-center">{r.P}</td>
              <td className="p-2 text-center">{r.W}</td>
              <td className="p-2 text-center">{r.L}</td>
              <td className="p-2 text-center">{r.PF}</td>
              <td className="p-2 text-center">{r.PA}</td>
              <td className="p-2 text-center">{r.PD}</td>
              <td className="p-2 text-center font-bold">{r.Pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-xs mt-2 opacity-70">Top 2 advance. Tiebreakers: Points → Point Diff → Points For → Name.</div>
    </div>
  );
};

const GroupStage = ({ groups, playersIndex, onUpdateMatch, onAdvance, target }) => {
  const allCompleted = groups.every(g => g.matches.every(m => m.completed));
  const completedCount = groups.reduce((acc,g)=> acc + g.matches.filter(m=>m.completed).length, 0);
  const totalMatches = groups.reduce((acc,g)=> acc + g.matches.length, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center gap-3">
        <div className="text-lg font-semibold">Group Stage Progress: {completedCount}/{totalMatches} matches saved</div>
        <Button size="lg" disabled={!allCompleted} onClick={onAdvance}>
          Generate Knockout Bracket
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {groups.map((g)=> (
          <Card key={g.name} className="border-4 bg-white/80" style={{ borderColor: '#11111155' }}>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-3 justify-center">
                <span className="inline-flex w-10 h-10 items-center justify-center rounded-full text-white font-extrabold shadow" style={{ backgroundColor: '#000' }}>{g.name}</span>
                Group {g.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <StandingsTable group={g} playersIndex={playersIndex} />
              <div className="flex flex-wrap justify-center gap-4 w-full">
                {g.matches.map((m)=> (
                  <div key={m.id} className="w-full max-w-md">
                    <MatchCard match={m} playersIndex={playersIndex} disabled={false} target={target}
                      onSubmit={(res)=> onUpdateMatch(g.name, res)} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

const KnockoutBracket = ({ rounds, playersIndex, onSubmitScore, target }) => {
  const roundNames = ["Round of 16", "Quarter-Finals", "Semi-Finals", "Final"];
  return (
    <div className="space-y-10">
      {rounds.map((matches, idx)=> (
        <div key={idx} className="flex flex-col items-center">
          <div className="text-2xl font-black flex items-center gap-2 justify-center mb-4">
            <Trophy className="w-6 h-6"/> {roundNames[roundNames.length - matches.length] || `Round ${idx+1}`}
          </div>
          <div className="flex flex-wrap justify-center gap-4 w-full">
            {matches.map((m)=> (
              <div key={m.id} className="w-full max-w-md">
                <MatchCard match={m} playersIndex={playersIndex} onSubmit={(res)=> onSubmitScore(idx, res)} target={target} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// Read-only styled bracket with connector elbows
const StyledKnockoutBracket = ({ rounds, playersIndex, onSubmitScore, target }) => {
  // layout + connector constants (absolute layout so elbows line up perfectly)
  const LINE = '#111111';
  const THICK = 2;            // line thickness (px)
  const CARD_H = 72;          // fixed box height
  const CARD_W = 220;         // fixed column & card width
  const GAP_Y = 16;           // vertical gap between boxes (within a column)
  const GUTTER = 24;          // grid gap between columns
  const UNIT = CARD_H + GAP_Y; // base distance between centers in first column

  return (
    <div className="space-y-8">
      <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${rounds.length}, ${CARD_W}px)` }}>
        {rounds.map((matches, idx) => {
          // For column idx: centers are spaced by step = UNIT * 2^idx
          const step = UNIT * Math.pow(2, idx);
          const firstCenter = step / 2; // y of the first match center
          const colHeight = firstCenter + (matches.length - 1) * step + CARD_H / 2; // enough to fit last card
          return (
            <div key={idx} className="relative" style={{ height: colHeight }}>
              {/* Match boxes + horizontal stubs */}
              {matches.map((m, j) => {
                const centerY = firstCenter + j * step;
                const top = centerY - CARD_H / 2;
                return (
                  <div key={m.id} className="absolute" style={{ top, left: 0, width: CARD_W, height: CARD_H }}>
                    <div className="w-full">
                      <MatchCard match={m} playersIndex={playersIndex} onSubmit={(res)=> onSubmitScore(idx, res)} target={target} variant="bracket" />
                    </div>
                    {/* right-going connector to vertical spine (to next round) */}
                    {idx < rounds.length - 1 && (
                      <div className="absolute" style={{ top: CARD_H / 2 - THICK / 2, left: CARD_W, width: GUTTER / 2 - THICK / 2, height: THICK, background: LINE }} />
                    )}
                    {/* left-going connector from previous spine (from previous round) */}
                    {idx > 0 && (
                      <div className="absolute" style={{ top: CARD_H / 2 - THICK / 2, right: CARD_W, width: GUTTER / 2 - THICK / 2, height: THICK, background: LINE }} />
                    )}
                  </div>
                );
              })}

              {/* vertical spines that connect each pair (the elbow) */}
              {idx < rounds.length - 1 && Array.from({ length: Math.floor(matches.length / 2) }).map((_, p) => {
                const c0 = firstCenter + (2 * p) * step; // center of upper feeder
                return (
                  <div
                    key={`v-${idx}-${p}`}
                    className="absolute"
                    style={{ right: -GUTTER / 2 - THICK / 2, top: c0, width: THICK, height: step, background: LINE }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Falling confetti overlay for champion screen
const ConfettiRain = () => {
  const pieces = Array.from({ length: 120 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 4 + Math.random() * 3,
    size: 6 + Math.random() * 8,
    rotate: Math.random() * 360,
  }));
  return (
    <div className="pointer-events-none fixed inset-0 -z-0">
      {pieces.map(p => (
        <motion.div
          key={p.id}
          initial={{ y: -40, x: `${p.x}vw`, rotate: p.rotate, opacity: 0 }}
          animate={{ y: '110vh', rotate: p.rotate + 720, opacity: 1 }}
          transition={{ delay: p.delay, duration: p.duration, repeat: Infinity, repeatDelay: 0 }}
          className="absolute top-0"
          style={{ width: p.size, height: p.size * 0.6, borderRadius: 2, background: `linear-gradient(90deg, #ffffff, #dddddd)`, boxShadow: '0 0 2px rgba(0,0,0,0.2)' }}
        />
      ))}
    </div>
  );
};

// --- Podium helpers ---
const getPodium = (rounds, championId) => {
  const res = { gold: championId, silver: null, bronze: null };
  if (!rounds?.length) return res;
  const finalRound = rounds[rounds.length - 1] || [];
  const final = finalRound[0];
  if (final) {
    // Silver is the other player in the final
    res.silver = final.a === championId ? final.b : final.b === championId ? final.a : (final.scoreA > final.scoreB ? final.b : final.a);
  }
  // Bronze: pick the losing semifinalist with the higher losing score
  if (rounds.length >= 2) {
    const semis = rounds[rounds.length - 2] || [];
    if (semis.length >= 2) {
      const losers = semis.map(m => (m.scoreA > m.scoreB ? m.b : m.a));
      const losingScores = semis.map(m => (m.scoreA > m.scoreB ? m.scoreB : m.scoreA));
      const idx = (losingScores[1] ?? -1) > (losingScores[0] ?? -1) ? 1 : 0;
      res.bronze = losers[idx] ?? null;
    }
  }
  return res;
};

const Podium = ({ gold, silver, bronze, playersIndex }) => (
  <div className="flex items-end justify-center gap-6 mt-6">
    {/* Silver */}
    <div className="flex flex-col items-center">
      <div className="text-sm text-gray-200 mb-2">🥈 {playersIndex[silver]?.name || '—'}</div>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-24 h-28 bg-white/90 border-4 border-black/30 rounded-xl shadow" />
    </div>
    {/* Gold */}
    <div className="flex flex-col items-center">
      <div className="text-sm text-gray-200 mb-2">🥇 {playersIndex[gold]?.name || '—'}</div>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-28 h-36 bg-white/90 border-4 border-black/30 rounded-xl shadow" />
    </div>
    {/* Bronze */}
    <div className="flex flex-col items-center">
      <div className="text-sm text-gray-200 mb-2">🥉 {playersIndex[bronze]?.name || '—'}</div>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-24 h-24 bg-white/90 border-4 border-black/30 rounded-xl shadow" />
    </div>
  </div>
);

// ---------- Main App
export default function JordyCBBQCupApp() {
  const [players, setPlayers] = React.useState(() => load("ch_players", []));
  const [groups, setGroups] = React.useState(() => load("ch_groups", []));
  const [mode, setMode] = React.useState(() => load("ch_mode", "groups"));
  const [stage, setStage] = React.useState(() => load("ch_stage", "setup")); // setup | groups | knockout | champion
  const [rounds, setRounds] = React.useState(() => load("ch_rounds", []));
  const [champion, setChampion] = React.useState(() => load("ch_champion", null));
  const [target, setTarget] = React.useState(() => load("ch_target", 21));
  const [bracketSkin, setBracketSkin] = React.useState(false);

  const playersIndex = React.useMemo(() => Object.fromEntries(players.map(p => [p.id, p])), [players]);

  React.useEffect(()=> save("ch_players", players), [players]);
  React.useEffect(()=> save("ch_groups", groups), [groups]);
  React.useEffect(()=> save("ch_mode", mode), [mode]);
  React.useEffect(()=> save("ch_stage", stage), [stage]);
  React.useEffect(()=> save("ch_rounds", rounds), [rounds]);
  React.useEffect(()=> save("ch_champion", champion), [champion]);
  React.useEffect(()=> save("ch_target", target), [target]);

  const resetAll = () => {
    setPlayers([]); setGroups([]); setRounds([]); setChampion(null); setStage("setup");
    localStorage.removeItem("ch_players");
    localStorage.removeItem("ch_groups");
    localStorage.removeItem("ch_stage");
    localStorage.removeItem("ch_rounds");
    localStorage.removeItem("ch_champion");
  };

  const handleSetup = ({ names, mode: selectedMode }) => {
    setBracketSkin(false); // ensure we land on Knockout view, not Bracket skin
    setMode(selectedMode);
    const count = names.length;
    if (selectedMode === "groups") {
      if (count % 4 !== 0 || count < 8 || count > 32) {
        alert("For Groups → Knockout, player count must be a multiple of 4 between 8 and 32.");
        return;
      }
      const seeded = shuffle(names).map((name, i) => ({ id: uid(), name: name || `Player ${i+1}`, seed: i + 1 }));
      const groupsCount = count / 4;
      const labels = Array.from({ length: groupsCount }, (_, i) => String.fromCharCode(65 + i)); // A, B, C...
      const chunksArr = chunk(seeded, 4);
      const built = chunksArr.map((ch, i) => ({ name: labels[i], players: ch.map(p=>p.id), matches: scheduleRoundRobin4(ch.map(p=>p.id)) }));
      setPlayers(seeded);
      setGroups(built);
      setRounds([]);
      setStage("groups");
    } else {
      if (!isPowerOfTwo(count) || count < 4 || count > 32) {
        alert("For Single-Elimination, player count must be a power of two (4, 8, 16, 32).");
        return;
      }
      const seeded = shuffle(names).map((name, i) => ({ id: uid(), name: name || `Player ${i+1}`, seed: i + 1 }));
      setPlayers(seeded);
      setGroups([]);
      const firstRound = buildSingleElimFirstRound(seeded.map(p=>p.id));
      setRounds([firstRound]);
      setStage("knockout");
    }
  };

  const updateGroupMatch = (groupName, matchWithScores) => {
    setGroups((prev)=> prev.map((g)=> {
      if (g.name !== groupName) return g;
      const matches = g.matches.map((m)=> m.id === matchWithScores.id ? { ...matchWithScores, completed: true } : m);
      return { ...g, matches };
    }));
  };

  const advanceToKnockout = () => {
    const pairings = buildKnockout(groups, playersIndex);
    if (pairings.length === 0) { alert("No knockout pairings (complete all groups)"); return; }
    setRounds([pairings]); // round of N
    setStage("knockout");
  };

  const submitKnockoutScore = (roundIndex, matchWithScores) => {
    setRounds((prev)=> {
      const next = prev.map((r, i)=> i === roundIndex ? r.map((m)=> m.id === matchWithScores.id ? { ...matchWithScores, completed: true } : m) : r);
      // If round fully complete, build next round
      if (next[roundIndex].every(m=>m.completed)) {
        const winners = next[roundIndex].map((m)=> (m.scoreA > m.scoreB ? m.a : m.b));
        if (winners.length === 1) {
          setChampion(winners[0]);
          setStage("champion");
        } else {
          const nextRound = [];
          for (let i = 0; i < winners.length; i += 2) {
            nextRound.push({ id: uid(), a: winners[i], b: winners[i+1] });
          }
          next.push(nextRound);
        }
      }
      return next;
    });
  };

  // ===== Centered header (title + controls) =====
  const header = (
    <div className="relative">
      <CornholeBackdrop />
      <div className="flex flex-col items-center justify-center gap-3 text-center">
        <div className="text-4xl md:text-6xl font-black tracking-tight drop-shadow-sm text-white">Jordy C BBQ Cup</div>
        <div className="font-semibold -mt-1 text-gray-200">{mode === "single" ? `Single-Elimination — first to ${target}` : `Groups, Knockouts, Glory — first to ${target}`}</div>
        <div className="flex flex-wrap justify-center gap-2 mt-2">
          <Button variant="secondary" onClick={()=> setStage("setup")}>Setup</Button>
          {mode === "groups" && <Button variant="secondary" onClick={()=> setStage("groups")}>Groups</Button>}
          <Button variant="secondary" onClick={()=> { setStage("knockout"); setBracketSkin(false); }}>Knockout</Button>
          <Button variant="secondary" onClick={()=> { setStage("knockout"); setBracketSkin(true); }}>Bracket</Button>
          <Button variant="destructive" onClick={resetAll}>Reset</Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen p-4 md:p-8 text-center">
      <div className="max-w-7xl mx-auto space-y-8">
        {header}

        {stage === "setup" && (
          <AnimatePresence mode="wait">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <SetupForm onSetup={handleSetup} target={target} setTarget={setTarget} />
            </motion.div>
          </AnimatePresence>
        )}

        {stage === "groups" && players.length > 0 && mode === "groups" && (
          <AnimatePresence mode="wait">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-8">
              <Card className="bg-white/80 border-4 border-black/30">
                <CardHeader>
                  <CardTitle className="text-2xl text-center">Group Stage</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm opacity-80">Enter scores for each match. Winner must have exactly {target}, loser below {target}. No draws.</div>
                </CardContent>
              </Card>
              <GroupStage groups={groups} playersIndex={playersIndex} onUpdateMatch={updateGroupMatch} onAdvance={advanceToKnockout} target={target} />
            </motion.div>
          </AnimatePresence>
        )}

        {stage === "knockout" && rounds.length > 0 && (
          bracketSkin ? (
            <AnimatePresence mode="wait">
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-8">
                <Card className="bg-white/80 border-4 border-black/30">
                  <CardContent className="p-6">
                    <StyledKnockoutBracket rounds={rounds} playersIndex={playersIndex} onSubmitScore={submitKnockoutScore} target={target} />
                  </CardContent>
                </Card>
              </motion.div>
            </AnimatePresence>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-8">
                <Card className="bg-white/80 border-4 border-black/30">
                  <CardHeader>
                    <CardTitle className="text-2xl text-center">Knockout Bracket</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm opacity-80 mb-4">Winners advance automatically. Keep playing until only one champion remains.</div>
                    <KnockoutBracket rounds={rounds} playersIndex={playersIndex} onSubmitScore={submitKnockoutScore} target={target} />
                  </CardContent>
                </Card>
              </motion.div>
            </AnimatePresence>
          )
        )}

        {stage === "champion" && champion && (
          <AnimatePresence>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-6 relative">
              <ConfettiRain />
              {/* Centered trophy image */}
              <motion.img
                src={TROPHY_URL}
                alt="Jordy C BBQ Cup Trophy"
                className="w-56 md:w-80 mx-auto rounded-xl border-4 border-white/10 shadow-2xl"
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 140, damping: 14 }}
              />
              <div className="text-5xl md:text-7xl font-black tracking-tight text-white drop-shadow">🏆 {playersIndex[champion]?.name} is the champion!</div>
              <div className="text-lg opacity-90 text-gray-200">BBQ immortality secured. Well tossed. 🎯</div>
              {/* Podium */}
              {(() => { const p = getPodium(rounds, champion); return <Podium gold={p.gold} silver={p.silver} bronze={p.bronze} playersIndex={playersIndex} />; })()}
              <div className="flex justify-center gap-3">
                <Button onClick={()=> setStage("knockout")} variant="secondary">View Bracket</Button>
                <Button onClick={resetAll} variant="destructive">Start New Tournament</Button>
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        <footer className="pt-8 text-center text-xs opacity-70">
          Built for bean‑bag bragging rights. © Your Jordy C BBQ Cup
        </footer>
      </div>
    </div>
  );
}

// =============================
// Dev-only tests (console.assert)
// =============================
const __DEV__ = (typeof process === 'undefined') ? true : process.env.NODE_ENV !== 'production';
if (__DEV__) {
  try {
    // Test 1: scheduleRoundRobin4 returns 6 unique matches for 4 players
    const ids = ['A','B','C','D'];
    const sched = scheduleRoundRobin4(ids);
    console.assert(sched.length === 6, 'scheduleRoundRobin4 should create 6 matches');
    const pairs = new Set(sched.map(m => [m.a, m.b].sort().join('-')));
    console.assert(pairs.size === 6, 'scheduleRoundRobin4 should have unique pairs');

    // Test 2: computeStandings points and ordering after two completed matches
    const playersIndex = { A: { id:'A', name:'Alfa' }, B: { id:'B', name:'Bravo' }, C: { id:'C', name:'Charlie' }, D: { id:'D', name:'Delta' } };
    /** @type {Group} */
    const g = { name:'X', players:['A','B','C','D'], matches:[
      { id:'m1', a:'A', b:'B', scoreA:21, scoreB:10, completed:true },
      { id:'m2', a:'C', b:'D', scoreA:21, scoreB:0, completed:true },
    ]};
    const table = computeStandings(g, playersIndex);
    console.assert(table[0].Pts === 3 && table[1].Pts === 3, 'Winners should have 3 points');
    console.assert(table[0].PD >= table[1].PD, 'Sorted by PD when points equal');

    // Test 3: buildKnockout pairs count for two groups
    const mkPlayers = (...names) => names.map((n,i)=>({ id:`${n}`, name:`${n}`, seed:i+1 }));
    const P = [...mkPlayers('A1','A2','A3','A4'), ...mkPlayers('B1','B2','B3','B4')];
    const pIndex = Object.fromEntries(P.map(p=>[p.id,p]));
    const GA = { name:'A', players:['A1','A2','A3','A4'], matches:[
      { id:'a1', a:'A1', b:'A2', scoreA:21, scoreB:10, completed:true },
      { id:'a2', a:'A3', b:'A4', scoreA:21, scoreB:0, completed:true },
    ]};
    const GB = { name:'B', players:['B1','B2','B3','B4'], matches:[
      { id:'b1', a:'B1', b:'B2', scoreA:21, scoreB:5, completed:true },
      { id:'b2', a:'B3', b:'B4', scoreA:21, scoreB:7, completed:true },
    ]};
    const pairsKnock = buildKnockout([GA,GB], pIndex);
    console.assert(pairsKnock.length === 2, 'Two pairings expected for two groups');

    // Test 4: scoring validation rules (default 21)
    console.assert(validateCornholeScore(21, 0) === null, '21–0 should be valid');
    console.assert(validateCornholeScore(20, 21) === null, '20–21 should be valid');
    console.assert(!!validateCornholeScore(21, 21), 'Draw should be invalid');
    console.assert(!!validateCornholeScore(22, 10), 'Winner must be exactly 21');
    console.assert(!!validateCornholeScore(21, 21), 'Loser cannot have 21');

    // Test 5: single-elim first round pairing count for 16 players
    const sixteen = Array.from({length:16}, (_,i)=>`P${i+1}`);
    console.assert(buildSingleElimFirstRound(sixteen).length === 8, '16 players → 8 first-round matches');

    // Test 6: power-of-two check
    console.assert(isPowerOfTwo(16) && !isPowerOfTwo(12), 'Power-of-two helper works');

    // Test 7: toBaldyIfNeeded mapping
    console.assert(toBaldyIfNeeded('Tom') === 'baldy', 'Case-insensitive trigger should map to baldy');
    console.assert(toBaldyIfNeeded('  turk  ') === 'baldy', 'Trim + trigger maps to baldy');
    console.assert(toBaldyIfNeeded('Gobbler') === 'baldy', 'Another trigger maps to baldy');
    console.assert(toBaldyIfNeeded('Alice') === 'Alice', 'Non-trigger remains unchanged');

    // Test 8: sanitize array of names (as Start button would)
    const rawNames = ['tom', 'Bob', 'tommer', 'turk', 'gobbler', 'Kate'];
    const sanitized = rawNames.filter(Boolean).map(toBaldyIfNeeded);
    console.assert(
      JSON.stringify(sanitized) === JSON.stringify(['baldy','Bob','baldy','baldy','baldy','Kate']),
      'Sanitized list should map all triggers to baldy and keep others'
    );

    // Test 9: validation with target 11
    console.assert(validateCornholeScore(11, 7, 11) === null, '11–7 valid when target is 11');
    console.assert(!!validateCornholeScore(12, 5, 11), '12–5 invalid when target is 11');
    console.assert(!!validateCornholeScore(11, 11, 11), 'Draw invalid when target is 11');

    // Test 10: single-elim first round pairing count for 8 players
    const eight = Array.from({length:8}, (_,i)=>`P${i+1}`);
    console.assert(buildSingleElimFirstRound(eight).length === 4, '8 players → 4 first-round matches');
  } catch (e) {
    console.warn('Dev tests error:', e);
  }
}
