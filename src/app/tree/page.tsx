"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";

// ── Data shape (mirrors /api/tree) ──
interface TreePerson {
  id: string;
  firstName: string;
  lastName: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  dateOfDeath: string | null;
  generation: number | null;
  parentIds: string[];
  spouseIds: string[];
  childIds: string[];
}

interface Placement {
  person: TreePerson;
  x: number;
  y: number;
}

// ── Layout constants ──
const CARD_W = 220;
const CARD_H = 54;
const H_GAP = 30;        // min horizontal gap between any two non-related cards in the same row
const SPOUSE_GAP = 28;   // horizontal gap between married spouses
const V_GAP = 70;        // vertical gap between generation rows
const ROW_HEIGHT = CARD_H + V_GAP;

// Minimum center-to-center distance required in the same row to avoid visual collision.
const MIN_ROW_STRIDE = CARD_W + H_GAP;

// ────────────────────────────────────────────────────────────────────────────
// Layout engine
// ────────────────────────────────────────────────────────────────────────────
// Family trees are DAGs, not strict trees — a couple can be the merge point of
// two separate ancestral lineages, and any person should appear in the diagram
// exactly once regardless of how many ways their lineage connects. The layout
// below places every person on a horizontal row indexed by their `generation`
// value (already computed by recalculateGenerations()), and within a row uses
// a BFS walk from a seed person to position relatives adjacent to each other
// with per-row collision avoidance. Lines are then drawn between placed cards
// directly, so every parent→child connector lands on the specific descendant
// rather than on some synthetic "couple midpoint".
function computePlacements(persons: TreePerson[]): {
  placements: Map<string, Placement>;
  drawnSpousePairs: Array<[string, string]>;
} {
  // Only persons with a generation number participate in the grid. Unlinked
  // persons (no parents, no spouse, not the reference person's descendant) are
  // still visible in the table view and profile pages; the tree view quietly
  // omits them until they get linked.
  const linked = persons.filter((p) => p.generation !== null);
  const placements = new Map<string, Placement>();
  if (linked.length === 0) return { placements, drawnSpousePairs: [] };

  const byId = new Map(linked.map((p) => [p.id, p]));
  const genY = (gen: number) => gen * ROW_HEIGHT;

  // Tracks the right edge (x + CARD_W/2 + H_GAP) of the last placement in a
  // generation row, so new placements in that row are never pushed left of it.
  const rowCursor = new Map<number, number>();

  function collides(x: number, gen: number, ignoreId?: string): boolean {
    const y = genY(gen);
    for (const p of placements.values()) {
      if (p.y !== y) continue;
      if (ignoreId && p.person.id === ignoreId) continue;
      if (Math.abs(p.x - x) < MIN_ROW_STRIDE) return true;
    }
    return false;
  }

  function nextFreeXAtOrRightOf(x: number, gen: number): number {
    let tryX = x;
    let guard = 0;
    while (collides(tryX, gen)) {
      tryX += MIN_ROW_STRIDE;
      if (++guard > 500) break; // defensive cap
    }
    return tryX;
  }

  function place(person: TreePerson, preferredX: number): Placement {
    const gen = person.generation!;
    const y = genY(gen);
    const minCursor = rowCursor.get(gen);
    let x = minCursor !== undefined ? Math.max(preferredX, minCursor) : preferredX;
    x = nextFreeXAtOrRightOf(x, gen);
    const placement: Placement = { person, x, y };
    placements.set(person.id, placement);
    rowCursor.set(gen, x + MIN_ROW_STRIDE);
    return placement;
  }

  // Collect the placed siblings of `person` by walking each parent's other
  // children. A sibling is anyone who shares at least one parent.
  function placedSiblingsOf(person: TreePerson): Placement[] {
    const seen = new Set<string>();
    const out: Placement[] = [];
    for (const parentId of person.parentIds) {
      const parent = byId.get(parentId);
      if (!parent) continue;
      for (const sibId of parent.childIds) {
        if (sibId === person.id) continue;
        if (seen.has(sibId)) continue;
        seen.add(sibId);
        const sib = placements.get(sibId);
        if (sib && sib.y === genY(person.generation!)) out.push(sib);
      }
    }
    return out;
  }

  function preferredX(person: TreePerson): number {
    // 1) Already-placed spouse: land right next to them (marriage adjacency).
    const placedSpouses = person.spouseIds
      .map((id) => placements.get(id))
      .filter((p): p is Placement => !!p);
    if (placedSpouses.length > 0) {
      const rightmost = placedSpouses.reduce((a, b) => (a.x > b.x ? a : b));
      return rightmost.x + CARD_W + SPOUSE_GAP;
    }
    // 2) Placed siblings in the same row: slide to the OUTSIDE of the sibling
    //    cluster so we never wedge between a married sibling and their
    //    spouse. Prefer landing to the left of the leftmost sibling; only
    //    fall back to the right of the rightmost if the left side is blocked
    //    by an already-placed card.
    const siblings = placedSiblingsOf(person);
    if (siblings.length > 0) {
      const leftmost = siblings.reduce((a, b) => (a.x < b.x ? a : b));
      const rightmost = siblings.reduce((a, b) => (a.x > b.x ? a : b));
      const leftCandidate = leftmost.x - CARD_W - H_GAP;
      if (!collides(leftCandidate, person.generation!)) return leftCandidate;
      return rightmost.x + CARD_W + H_GAP;
    }
    // 3) Already-placed parents: center under the average of their x positions.
    const placedParents = person.parentIds
      .map((id) => placements.get(id))
      .filter((p): p is Placement => !!p);
    if (placedParents.length > 0) {
      const avg = placedParents.reduce((s, p) => s + p.x, 0) / placedParents.length;
      return avg;
    }
    // 4) Already-placed children: center above them (we're the parent being
    //    added after the child's own subtree is already anchored).
    const placedChildren = person.childIds
      .map((id) => placements.get(id))
      .filter((p): p is Placement => !!p);
    if (placedChildren.length > 0) {
      const avg = placedChildren.reduce((s, p) => s + p.x, 0) / placedChildren.length;
      return avg;
    }
    // 5) Brand-new disconnected component: start to the right of everything
    //    already placed so it gets its own horizontal band.
    let rightmost = 0;
    let anyPlaced = false;
    for (const cursor of rowCursor.values()) {
      anyPlaced = true;
      if (cursor > rightmost) rightmost = cursor;
    }
    return anyPlaced ? rightmost + CARD_W : 0;
  }

  // Seeds: deterministic traversal order. Process oldest generations first
  // (smallest `generation` value — the tree's oldest known ancestors), then
  // break ties by id to keep renders stable across reloads.
  const seeds = [...linked].sort((a, b) => {
    const ag = a.generation!;
    const bg = b.generation!;
    if (ag !== bg) return ag - bg;
    return a.id.localeCompare(b.id);
  });

  const queue: TreePerson[] = [];
  const enqueued = new Set<string>();

  // Helper: enqueue a person's relatives (spouses, children, parents) if
  // they haven't already been placed or queued.
  function enqueueRelatives(person: TreePerson) {
    const relatives = [
      ...person.spouseIds,
      ...person.childIds,
      ...person.parentIds,
    ];
    for (const rid of relatives) {
      if (!byId.has(rid)) continue;
      if (placements.has(rid)) continue;
      if (enqueued.has(rid)) continue;
      queue.push(byId.get(rid)!);
      enqueued.add(rid);
    }
  }

  for (const seed of seeds) {
    if (placements.has(seed.id)) continue;
    queue.push(seed);
    enqueued.add(seed.id);
    while (queue.length > 0) {
      const person = queue.shift()!;
      if (placements.has(person.id)) continue;
      place(person, preferredX(person));

      // Couples stick together: immediately place any unplaced spouse next
      // to the person we just placed, before the BFS moves on to anything
      // else. This prevents a sibling from wedging into the queue ahead of
      // the spouse and ending up between the two partners at render time —
      // which is what made the marriage heart disappear behind an in-between
      // card before this rule existed.
      for (const sid of person.spouseIds) {
        if (placements.has(sid)) continue;
        if (!byId.has(sid)) continue;
        const spouse = byId.get(sid)!;
        if (spouse.generation !== person.generation) continue; // must share a row
        place(spouse, preferredX(spouse));
        enqueued.add(sid); // don't re-enqueue this spouse later
        enqueueRelatives(spouse);
      }

      enqueueRelatives(person);
    }
  }

  // ── Recenter pass ─────────────────────────────────────────────────────
  // The BFS above places people relative to whichever relative was seen
  // first, which is order-dependent and leaves children sitting off-center
  // when they have multiple upstream lineages. Walk the generations from
  // oldest to youngest and pull each couple (or solo child) toward the
  // average X of all their placed parents. This is what actually makes a
  // descendant sit equidistant between, say, their paternal and maternal
  // grandparents instead of hugging one branch.
  //
  // Couples move as a unit so the marriage line stays short. If a shift
  // would collide with someone else already in the same row, we clamp the
  // shift to the largest amount that doesn't cause a collision (we don't
  // push other people around — that would cascade unpredictably).
  const genGroups = new Map<number, Placement[]>();
  for (const p of placements.values()) {
    if (!genGroups.has(p.y)) genGroups.set(p.y, []);
    genGroups.get(p.y)!.push(p);
  }
  const generationYs = [...genGroups.keys()].sort((a, b) => a - b);

  function clampShift(
    row: Placement[],
    moving: Set<string>,
    desiredDelta: number
  ): number {
    // Return the largest magnitude of delta in the desired direction that
    // still keeps every moving card MIN_ROW_STRIDE away from every stationary
    // card in the same row. Direction is preserved (sign of desiredDelta).
    if (desiredDelta === 0) return 0;
    const stationary = row.filter((p) => !moving.has(p.person.id));
    const movingList = row.filter((p) => moving.has(p.person.id));
    let allowed = desiredDelta;
    for (const m of movingList) {
      const targetX = m.x + desiredDelta;
      for (const s of stationary) {
        const currentGap = Math.abs(s.x - m.x);
        const newGap = Math.abs(s.x - targetX);
        if (newGap >= MIN_ROW_STRIDE) continue;
        // The shift would bring us inside the collision zone. Figure out how
        // far we can actually move while staying MIN_ROW_STRIDE away.
        if (desiredDelta > 0) {
          // Moving right. Only constraint is stationary cards to the right.
          if (s.x <= m.x) continue; // stationary is to the left, safe
          const maxRight = s.x - MIN_ROW_STRIDE - m.x;
          if (maxRight < allowed) allowed = Math.max(0, maxRight);
        } else {
          // Moving left.
          if (s.x >= m.x) continue; // stationary is to the right, safe
          const minLeft = s.x + MIN_ROW_STRIDE - m.x;
          if (minLeft > allowed) allowed = Math.min(0, minLeft);
        }
        // Sanity: if we can't even maintain current separation, bail.
        if (currentGap < MIN_ROW_STRIDE) return 0;
      }
    }
    return allowed;
  }

  // Skip the very top row — the oldest generation has no parents to
  // center under, so its BFS positions are final.
  for (let i = 1; i < generationYs.length; i++) {
    const y = generationYs[i];
    const row = genGroups.get(y)!;
    const handled = new Set<string>();

    for (const p of row) {
      if (handled.has(p.person.id)) continue;

      const spousePlacement = p.person.spouseIds
        .map((sid) => placements.get(sid))
        .find((sp): sp is Placement => !!sp && sp.y === p.y);

      if (spousePlacement) {
        // Couple — center the pair under the union of both spouses' parents.
        handled.add(p.person.id);
        handled.add(spousePlacement.person.id);

        const left = p.x <= spousePlacement.x ? p : spousePlacement;
        const right = p.x <= spousePlacement.x ? spousePlacement : p;

        const leftParents = left.person.parentIds
          .map((id) => placements.get(id))
          .filter((q): q is Placement => !!q);
        const rightParents = right.person.parentIds
          .map((id) => placements.get(id))
          .filter((q): q is Placement => !!q);
        const allParents = [...leftParents, ...rightParents];
        if (allParents.length === 0) continue;

        const parentAvg = allParents.reduce((s, q) => s + q.x, 0) / allParents.length;
        const currentMid = (left.x + right.x) / 2;
        const desiredDelta = parentAvg - currentMid;
        const delta = clampShift(row, new Set([left.person.id, right.person.id]), desiredDelta);
        if (delta === 0) continue;

        placements.set(left.person.id, { ...left, x: left.x + delta });
        placements.set(right.person.id, { ...right, x: right.x + delta });
      } else {
        // Solo child — center under parents directly.
        handled.add(p.person.id);
        const parents = p.person.parentIds
          .map((id) => placements.get(id))
          .filter((q): q is Placement => !!q);
        if (parents.length === 0) continue;

        const parentAvg = parents.reduce((s, q) => s + q.x, 0) / parents.length;
        const desiredDelta = parentAvg - p.x;
        const delta = clampShift(row, new Set([p.person.id]), desiredDelta);
        if (delta === 0) continue;

        placements.set(p.person.id, { ...p, x: p.x + delta });
      }
    }

    // The row list stores references, but we mutated the placements map.
    // Re-read positions for this row so the next child-couple's collision
    // check uses up-to-date x values.
    const refreshed = row.map((p) => placements.get(p.person.id)!);
    genGroups.set(y, refreshed);
  }

  // Deduplicate spouse pairs so each marriage line is drawn once.
  const drawnSpousePairs: Array<[string, string]> = [];
  const seenPair = new Set<string>();
  for (const p of placements.values()) {
    for (const sid of p.person.spouseIds) {
      if (!placements.has(sid)) continue;
      const key = [p.person.id, sid].sort().join("|");
      if (seenPair.has(key)) continue;
      seenPair.add(key);
      drawnSpousePairs.push([p.person.id, sid]);
    }
  }

  return { placements, drawnSpousePairs };
}

// ── Bezier path for parent→child connectors ──
function parentChildPath(px: number, py: number, cx: number, cy: number): string {
  const midY = (py + cy) / 2;
  return `M ${px},${py} C ${px},${midY} ${cx},${midY} ${cx},${cy}`;
}

// ── Card component ──
function TreeCard({ person, x, y }: { person: TreePerson; x: number; y: number }) {
  const gender = person.gender;
  const accent = gender === "M" ? "#92400e" : gender === "F" ? "#b45309" : "#6b7280";
  const bg = gender === "M" ? "#fffbeb" : gender === "F" ? "#fff7ed" : "#f9fafb";
  const name = `${person.firstName} ${person.lastName ?? ""}`.trim();
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const displayName = name.length > 20 ? name.slice(0, 18) + "..." : name;

  return (
    <g transform={`translate(${x - CARD_W / 2}, ${y})`}>
      <rect x={2} y={3} width={CARD_W} height={CARD_H} rx={10} fill="rgba(0,0,0,0.06)" />
      <rect width={CARD_W} height={CARD_H} rx={10} fill={bg} stroke={accent} strokeWidth={1.5} />
      <rect width={4} height={CARD_H} rx={2} fill={accent} />
      <circle cx={26} cy={CARD_H / 2} r={14} fill={accent} />
      <text
        x={26}
        y={CARD_H / 2 + 4}
        fill="white"
        fontSize={10}
        fontWeight="bold"
        textAnchor="middle"
      >
        {initials}
      </text>
      <text x={48} y={CARD_H / 2 - 3} fill="#1c1917" fontSize={12} fontWeight="700">
        {displayName}
      </text>
      {person.dateOfBirth && (
        <text x={48} y={CARD_H / 2 + 10} fill="#a1a1aa" fontSize={9}>
          {person.dateOfBirth}
          {person.dateOfDeath ? ` - ${person.dateOfDeath}` : ""}
        </text>
      )}
      {person.generation !== null && (
        <>
          <circle cx={CARD_W - 16} cy={16} r={10} fill={accent} />
          <text
            x={CARD_W - 16}
            y={20}
            fill="white"
            fontSize={8}
            fontWeight="bold"
            textAnchor="middle"
          >
            G{person.generation}
          </text>
        </>
      )}
      <a href={`/persons/${person.id}`} style={{ cursor: "pointer" }}>
        <rect width={CARD_W} height={CARD_H} fill="transparent" rx={10} />
      </a>
    </g>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main page
// ────────────────────────────────────────────────────────────────────────────
export default function TreePage() {
  const [persons, setPersons] = useState<TreePerson[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    fetch("/api/tree")
      .then((r) => r.json())
      .then((data) => {
        setPersons(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.2, Math.min(3, z - e.deltaY * 0.001)));
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("a")) return;
      setDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    },
    [pan]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    },
    [dragging, dragStart]
  );

  const handleMouseUp = useCallback(() => setDragging(false), []);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        touchStartRef.current = { x: t.clientX - pan.x, y: t.clientY - pan.y };
      }
    },
    [pan]
  );

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && touchStartRef.current) {
      const t = e.touches[0];
      setPan({
        x: t.clientX - touchStartRef.current.x,
        y: t.clientY - touchStartRef.current.y,
      });
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    touchStartRef.current = null;
  }, []);

  const zoomIn = () => setZoom((z) => Math.min(3, z + 0.2));
  const zoomOut = () => setZoom((z) => Math.max(0.2, z - 0.2));
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  if (loading) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Loading family tree...</p>
      </div>
    );
  }

  const { placements, drawnSpousePairs } = computePlacements(persons);
  const allPlacements = Array.from(placements.values());

  if (allPlacements.length === 0) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-amber-900 mb-4">Family Tree</h1>
        <p className="text-gray-500">
          No linked family data yet.{" "}
          <Link href="/persons/new" className="text-amber-700 underline">
            Add members
          </Link>{" "}
          and link them to build the tree.
        </p>
      </div>
    );
  }

  // ── Bounds ──
  const pad = 80;
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const p of allPlacements) {
    minX = Math.min(minX, p.x - CARD_W / 2);
    maxX = Math.max(maxX, p.x + CARD_W / 2);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y + CARD_H);
  }
  const svgW = maxX - minX + pad * 2;
  const svgH = maxY - minY + pad * 2;
  const oX = -minX + pad;
  const oY = -minY + pad;

  // ── Build parent→child connectors from the data ──
  // A child whose two parents are married to each other only gets ONE line,
  // drawn from the midpoint of the parents (at the bottom of their row) down
  // to the child. The marriage is the unit that produced the child, so
  // drawing two separate lines — one from each spouse — is wrong; it
  // represents the couple as if the parents were unrelated co-parents. We
  // still emit individual lines when:
  //   • the child has only one parent in the data (single-parent case), or
  //   • the child's two placed parents are not spouses of each other
  //     (step-parent / unmarried co-parents).
  interface ParentChildEdge {
    px: number;
    py: number;
    cx: number;
    cy: number;
    key: string;
  }
  const parentChildEdges: ParentChildEdge[] = [];

  // Group placed parents by their placed child.
  const parentsByChild = new Map<string, Placement[]>();
  for (const p of allPlacements) {
    for (const childId of p.person.childIds) {
      if (!placements.has(childId)) continue;
      if (!parentsByChild.has(childId)) parentsByChild.set(childId, []);
      parentsByChild.get(childId)!.push(p);
    }
  }

  function findMarriedPair(parents: Placement[]): [Placement, Placement] | null {
    for (let i = 0; i < parents.length; i++) {
      for (let j = i + 1; j < parents.length; j++) {
        if (parents[i].person.spouseIds.includes(parents[j].person.id)) {
          return [parents[i], parents[j]];
        }
      }
    }
    return null;
  }

  for (const [childId, parents] of parentsByChild.entries()) {
    const child = placements.get(childId)!;
    if (parents.length >= 2) {
      const pair = findMarriedPair(parents);
      if (pair) {
        // One line from the couple midpoint down to the child. We start from
        // the bottom of the parent row at the midpoint between the two cards
        // so the curve visibly descends from "between the parents" rather
        // than from either individual card.
        const [a, b] = pair;
        const midX = (a.x + b.x) / 2;
        parentChildEdges.push({
          px: midX,
          py: a.y + CARD_H,
          cx: child.x,
          cy: child.y,
          key: `couple-${[a.person.id, b.person.id].sort().join("-")}->${childId}`,
        });
        // Any additional parents (step-parents from a different marriage, etc.)
        // still get their own individual line.
        for (const extra of parents) {
          if (extra === a || extra === b) continue;
          parentChildEdges.push({
            px: extra.x,
            py: extra.y + CARD_H,
            cx: child.x,
            cy: child.y,
            key: `${extra.person.id}->${childId}`,
          });
        }
        continue;
      }
    }
    // Fallback: single-parent or unmarried co-parents — one line each.
    for (const p of parents) {
      parentChildEdges.push({
        px: p.x,
        py: p.y + CARD_H,
        cx: child.x,
        cy: child.y,
        key: `${p.person.id}->${childId}`,
      });
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-amber-900 mb-2">Family Tree</h1>
      <p className="text-sm text-gray-500 mb-4">
        Drag to pan, scroll to zoom. Click a card to view profile.
      </p>
      <div className="relative">
        <div
          ref={containerRef}
          className="rounded-xl shadow-lg border border-amber-200 overflow-hidden select-none"
          style={{
            width: "100%",
            height: "min(75vh, calc(100dvh - 180px))",
            minHeight: "400px",
            background:
              "linear-gradient(180deg, #fffbeb 0%, #ffffff 50%, #fefce8 100%)",
            cursor: dragging ? "grabbing" : "grab",
          }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${svgW} ${svgH}`}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center center",
            }}
          >
            {/* Parent-child curves */}
            {parentChildEdges.map((e) => (
              <path
                key={e.key}
                d={parentChildPath(e.px + oX, e.py + oY, e.cx + oX, e.cy + oY)}
                fill="none"
                stroke="#d97706"
                strokeWidth={2}
                strokeOpacity={0.45}
              />
            ))}

            {/* Marriage lines (one per unique pair) */}
            {drawnSpousePairs.map(([aId, bId]) => {
              const a = placements.get(aId)!;
              const b = placements.get(bId)!;
              // Sort so the left spouse is always "a" for line drawing.
              const left = a.x <= b.x ? a : b;
              const right = a.x <= b.x ? b : a;
              const x1 = left.x + CARD_W / 2 + oX;
              const x2 = right.x - CARD_W / 2 + oX;
              const y = left.y + CARD_H / 2 + oY;
              const midX = (x1 + x2) / 2;
              return (
                <g key={`m-${aId}-${bId}`}>
                  <line
                    x1={x1}
                    y1={y}
                    x2={x2}
                    y2={y}
                    stroke="#b45309"
                    strokeWidth={2}
                    strokeOpacity={0.6}
                  />
                  <circle
                    cx={midX}
                    cy={y}
                    r={7}
                    fill="#fff7ed"
                    stroke="#b45309"
                    strokeWidth={1.2}
                  />
                  <text
                    x={midX}
                    y={y + 3}
                    fill="#b45309"
                    fontSize={10}
                    textAnchor="middle"
                  >
                    &#9829;
                  </text>
                </g>
              );
            })}

            {/* Person cards */}
            {allPlacements.map((p) => (
              <TreeCard key={p.person.id} person={p.person} x={p.x + oX} y={p.y + oY} />
            ))}
          </svg>
        </div>

        {/* Zoom controls */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-1.5">
          <button
            onClick={zoomIn}
            className="w-9 h-9 bg-white border border-amber-300 rounded-lg shadow-md text-amber-800 font-bold text-lg hover:bg-amber-50 transition-colors flex items-center justify-center"
            title="Zoom in"
          >
            +
          </button>
          <button
            onClick={zoomOut}
            className="w-9 h-9 bg-white border border-amber-300 rounded-lg shadow-md text-amber-800 font-bold text-lg hover:bg-amber-50 transition-colors flex items-center justify-center"
            title="Zoom out"
          >
            -
          </button>
          <button
            onClick={resetView}
            className="w-9 h-9 bg-white border border-amber-300 rounded-lg shadow-md text-amber-800 hover:bg-amber-50 transition-colors flex items-center justify-center"
            title="Reset view"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>

        <div className="absolute bottom-4 left-4 text-xs text-gray-400 bg-white/80 px-2 py-1 rounded-md border border-gray-200">
          {Math.round(zoom * 100)}%
        </div>
      </div>
    </div>
  );
}
