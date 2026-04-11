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
  isLiving: boolean;
  photoUrl: string | null;
  generation: number | null;
  parentIds: string[];
  spouseIds: string[];
  childIds: string[];
}

// Pull just the four-digit year out of any of the accepted date formats
// (YYYY-MMM-DD, YYYY-MM-DD, YYYY). MMM-DD (no year) returns "" so we skip
// the date row on the card entirely rather than show "Apr-08" floating
// without context.
function yearOf(date: string | null | undefined): string {
  if (!date) return "";
  const m = date.match(/^(\d{4})/);
  return m ? m[1] : "";
}

interface Placement {
  person: TreePerson;
  x: number;
  y: number;
}

// ── Layout constants ──
const CARD_W = 220;
const CARD_H = 54;
const H_GAP = 50;        // min horizontal gap between any two non-related cards in the same row
const SPOUSE_GAP = 28;   // horizontal gap between married spouses
const V_GAP = 120;       // vertical gap between generation rows — deliberately generous so the Bezier parent→child curves have room to fan out and stay followable when many lines cross
const ROW_HEIGHT = CARD_H + V_GAP;
// Initial zoom for the canvas. 1.0 = one CSS pixel per layout unit, which
// (now that the SVG is sized to its intrinsic pixel dimensions rather than
// a fit-to-container viewBox) means every card renders at its natural
// CARD_W × CARD_H size regardless of how many people share the canvas.
// The user can zoom in/out freely with the wheel or the ± buttons; the
// reset button returns here.
const DEFAULT_ZOOM = 1;

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
  unlinkedPersons: TreePerson[];
} {
  const placements = new Map<string, Placement>();
  if (persons.length === 0) return { placements, drawnSpousePairs: [], unlinkedPersons: [] };

  const byId = new Map(persons.map((p) => [p.id, p]));

  // ── Effective generation ──────────────────────────────────────────────
  // recalculateGenerations() in the API is the usual source of the
  // `generation` column, but it can leave rows as null when a person
  // isn't in the same connected component as the reference person.
  // Previously we filtered those rows out of the tree entirely — which
  // hid real people from the diagram depending on which reference was
  // active, and was exactly the "where is Sherin and Robinson" bug.
  //
  // Instead, derive an effective generation for every person, seeded by
  // the stored value and then iteratively pulled from any relative that
  // already has one (spouse → same gen, parent → gen+1, child → gen-1).
  // Anyone still without a generation after this pass gets bucketed into
  // a "floating" row below the main tree so they remain visible.
  const effectiveGen = new Map<string, number>();
  for (const p of persons) {
    if (typeof p.generation === "number") effectiveGen.set(p.id, p.generation);
  }
  // Iterate until stable. Cap iterations to avoid pathological loops.
  for (let pass = 0; pass < persons.length + 5; pass++) {
    let progressed = false;
    for (const p of persons) {
      if (effectiveGen.has(p.id)) continue;
      // Same-generation relatives first (spouses) so couples stay aligned.
      for (const sid of p.spouseIds) {
        const g = effectiveGen.get(sid);
        if (g !== undefined) {
          effectiveGen.set(p.id, g);
          progressed = true;
          break;
        }
      }
      if (effectiveGen.has(p.id)) continue;
      // Parents → child is one generation down.
      for (const pid of p.parentIds) {
        const g = effectiveGen.get(pid);
        if (g !== undefined) {
          effectiveGen.set(p.id, g + 1);
          progressed = true;
          break;
        }
      }
      if (effectiveGen.has(p.id)) continue;
      // Children → parent is one generation up.
      for (const cid of p.childIds) {
        const g = effectiveGen.get(cid);
        if (g !== undefined) {
          effectiveGen.set(p.id, g - 1);
          progressed = true;
          break;
        }
      }
    }
    if (!progressed) break;
  }
  // Orphans (could not be reached by any relative chain) get parked in a
  // dedicated row just below the lowest derived generation so they're still
  // visible on the canvas. We also track them as `unlinkedPersons` so the
  // page can render an explicit warning listing their names — previously
  // these people would appear "off-screen" and look missing even though
  // they were technically placed.
  let maxDerivedGen = 0;
  for (const g of effectiveGen.values()) {
    if (g > maxDerivedGen) maxDerivedGen = g;
  }
  const ORPHAN_GEN = maxDerivedGen + 2;
  const unlinkedPersons: TreePerson[] = [];
  for (const p of persons) {
    if (!effectiveGen.has(p.id)) {
      effectiveGen.set(p.id, ORPHAN_GEN);
      unlinkedPersons.push(p);
    }
  }

  const genOf = (personId: string) => effectiveGen.get(personId) ?? 0;
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
    // Walk right until tryX is MIN_ROW_STRIDE away from every card already in
    // this generation row. When a collision is found, we snap tryX to the
    // colliding card's right edge (card.x + MIN_ROW_STRIDE) instead of blindly
    // bumping tryX by MIN_ROW_STRIDE. The old behaviour overshot whenever the
    // preferredX was itself already inside a collision zone — e.g. a spouse
    // couples-stick call hands in spouse.x + (CARD_W + SPOUSE_GAP) = spouse.x
    // + 248, which is 2px inside the spouse's own collision zone (because
    // MIN_ROW_STRIDE is 250). The old loop would then push the partner to
    // spouse.x + 498 and cascade from there, sending a married partner across
    // the whole row when the first snap wasn't enough. Snapping to the exact
    // right edge of each offending card produces the tight spacing the layout
    // was designed for and never overshoots past unrelated neighbours.
    const y = genY(gen);
    let tryX = x;
    let guard = 0;
    while (true) {
      let pushedTo: number | null = null;
      for (const p of placements.values()) {
        if (p.y !== y) continue;
        if (Math.abs(p.x - tryX) < MIN_ROW_STRIDE) {
          const snapped = p.x + MIN_ROW_STRIDE;
          if (pushedTo === null || snapped > pushedTo) pushedTo = snapped;
        }
      }
      if (pushedTo === null) return tryX;
      tryX = pushedTo;
      if (++guard > 500) return tryX; // defensive cap
    }
  }

  function place(person: TreePerson, preferredX: number): Placement {
    const gen = genOf(person.id);
    const y = genY(gen);
    // DO NOT clamp preferredX to the row cursor — doing so would force every
    // new placement to land right of everything already in the row, which
    // silently breaks the sibling-leftward rule (Sherin cannot land to the
    // left of Shirley if we pin her to the row's rightmost cursor). The
    // collision loop below handles actual overlap on its own; the row cursor
    // is ONLY used by "new component" (rule 5) to place unrelated clusters
    // to the right of existing content.
    const x = nextFreeXAtOrRightOf(preferredX, gen);
    const placement: Placement = { person, x, y };
    placements.set(person.id, placement);
    // Track the rightmost cursor for rule 5. A leftward placement must not
    // shrink the cursor, so we take the max of whatever was there before.
    const prev = rowCursor.get(gen) ?? Number.NEGATIVE_INFINITY;
    rowCursor.set(gen, Math.max(prev, x + MIN_ROW_STRIDE));
    return placement;
  }

  // Collect the placed siblings of `person` by walking each parent's other
  // children. A sibling is anyone who shares at least one parent, and only
  // counts when they've been placed on the same row as this person.
  function placedSiblingsOf(person: TreePerson): Placement[] {
    const seen = new Set<string>();
    const out: Placement[] = [];
    const myY = genY(genOf(person.id));
    for (const parentId of person.parentIds) {
      const parent = byId.get(parentId);
      if (!parent) continue;
      for (const sibId of parent.childIds) {
        if (sibId === person.id) continue;
        if (seen.has(sibId)) continue;
        seen.add(sibId);
        const sib = placements.get(sibId);
        if (sib && sib.y === myY) out.push(sib);
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
    // 2) Placed siblings in the same row: only use sibling-adjacent placement
    //    when the person being placed is SINGLE (or their spouse is already
    //    placed and was handled above). Married siblings whose partner is
    //    about to be stuck via couples-stick should be treated as their own
    //    couple unit — they fall through to the parent-centered rule below
    //    and let nextFreeXAtOrRightOf find a non-colliding slot. Trying to
    //    pack two married-sibling couples adjacent to each other was the
    //    root cause of Sherin+Robinson and Shirley+Geoffrey getting split:
    //    one sibling's sibling-adjacent placement left no room for the
    //    other sibling's spouse to stick, and the partner got cascaded off
    //    to the far right of the row.
    const bringsSpouse = person.spouseIds.some((sid) => {
      const spouse = byId.get(sid);
      if (!spouse) return false;
      if (placements.has(sid)) return false;
      return genOf(spouse.id) === genOf(person.id);
    });
    const siblings = bringsSpouse ? [] : placedSiblingsOf(person);
    if (siblings.length > 0) {
      const leftmost = siblings.reduce((a, b) => (a.x < b.x ? a : b));
      const rightmost = siblings.reduce((a, b) => (a.x > b.x ? a : b));
      const leftCandidate = leftmost.x - MIN_ROW_STRIDE;
      if (!collides(leftCandidate, genOf(person.id))) return leftCandidate;
      return rightmost.x + MIN_ROW_STRIDE;
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
    // 5) Brand-new disconnected component: use the row's OWN cursor so the
    //    new person lands in the next free slot in their own row, rather
    //    than being flung far to the right by the global-max cursor. This
    //    keeps an unlinked couple visible in a predictable position at the
    //    left edge of their band instead of off-screen.
    const gen = genOf(person.id);
    return rowCursor.get(gen) ?? 0;
  }

  // Seeds: deterministic traversal order. Process oldest generations first
  // (smallest effective generation — the tree's oldest known ancestors),
  // then break ties by id to keep renders stable across reloads. This
  // iterates over EVERY person in the dataset, including ones the DB left
  // without a stored generation — their effective generation was filled
  // in above by walking relatives.
  const seeds = [...persons].sort((a, b) => {
    const ag = genOf(a.id);
    const bg = genOf(b.id);
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
        if (genOf(spouse.id) !== genOf(person.id)) continue; // must share a row
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
    // The rule is simple: a moving card can't cross (or land inside the
    // collision zone of) any stationary card on its side of travel.
    //
    // The previous version only applied the constraint when the FULL desired
    // shift would have collided — it short-circuited on newGap >= STRIDE.
    // That skip is wrong: if another constraint later clamps `allowed` to a
    // smaller value, a moving card whose full-desired target cleanly jumped
    // over a stationary card can end up LANDING ON that card. Always
    // compute and record the per-card clamp; the min wins.
    if (desiredDelta === 0) return 0;
    // Pull each card's current x from `placements` rather than from `row`,
    // because an earlier couple in the same recenter pass may already have
    // shifted — the `row` list holds the original Placement snapshots.
    const current = (id: string) => placements.get(id)!;
    const stationaryIds = row.filter((p) => !moving.has(p.person.id)).map((p) => p.person.id);
    const movingIds = row.filter((p) => moving.has(p.person.id)).map((p) => p.person.id);
    let allowed = desiredDelta;
    for (const mid of movingIds) {
      const m = current(mid);
      for (const sid of stationaryIds) {
        const s = current(sid);
        // If the two cards are already overlapping the collision zone, any
        // shift only makes it worse (or at best neutral) — bail out.
        if (Math.abs(s.x - m.x) < MIN_ROW_STRIDE) return 0;
        if (desiredDelta > 0) {
          // Moving right — only stationary cards to our right can constrain us.
          if (s.x <= m.x) continue;
          const maxRight = s.x - MIN_ROW_STRIDE - m.x;
          if (maxRight < allowed) allowed = Math.max(0, maxRight);
        } else {
          // Moving left — only stationary cards to our left can constrain us.
          if (s.x >= m.x) continue;
          const minLeft = s.x + MIN_ROW_STRIDE - m.x;
          if (minLeft > allowed) allowed = Math.min(0, minLeft);
        }
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

  return { placements, drawnSpousePairs, unlinkedPersons };
}

// ── Bezier path for parent→child connectors ──
function parentChildPath(px: number, py: number, cx: number, cy: number): string {
  const midY = (py + cy) / 2;
  return `M ${px},${py} C ${px},${midY} ${cx},${midY} ${cx},${cy}`;
}

// ── Card color palette ──
// Blue for male, pink for female, neutral gray for unknown gender. The
// `accent` shade colors strokes, stripes, and the initials/photo frame;
// `accentDark` is used for the person's name (higher contrast); `bg` is
// the card fill.
const PALETTES = {
  M:       { accent: "#2563eb", accentDark: "#1e3a8a", bg: "#eff6ff" },
  F:       { accent: "#db2777", accentDark: "#831843", bg: "#fdf2f8" },
  unknown: { accent: "#6b7280", accentDark: "#374151", bg: "#f9fafb" },
} as const;

function paletteFor(gender: string | null) {
  if (gender === "M") return PALETTES.M;
  if (gender === "F") return PALETTES.F;
  return PALETTES.unknown;
}

// ── Card component ──
function TreeCard({
  person,
  x,
  y,
  onContextMenu,
  highlighted,
  dimmed,
}: {
  person: TreePerson;
  x: number;
  y: number;
  onContextMenu?: (personId: string, e: React.MouseEvent) => void;
  highlighted?: boolean;
  dimmed?: boolean;
}) {
  const palette = paletteFor(person.gender);
  // Deceased = explicit isLiving=false. We intentionally don't fall back to
  // "has a dateOfDeath" because the seed scripts sometimes leave the death
  // date unfilled on known-deceased ancestors.
  const isDeceased = person.isLiving === false;

  const name = `${person.firstName} ${person.lastName ?? ""}`.trim();
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const displayName = name.length > 20 ? name.slice(0, 18) + "..." : name;

  // Compact "1920 – 1990 †" style line. The full date string stays on the
  // profile page; cards only have room for year-only labels.
  const birthYear = yearOf(person.dateOfBirth);
  const deathYear = yearOf(person.dateOfDeath);
  const dateLine = isDeceased
    ? birthYear && deathYear
      ? `${birthYear} \u2013 ${deathYear} \u2020`
      : birthYear
        ? `${birthYear} \u2013 ? \u2020`
        : deathYear
          ? `? \u2013 ${deathYear} \u2020`
          : "\u2020 in memory"
    : birthYear || "";

  const avatarClipId = `tree-card-avatar-${person.id}`;

  return (
    <g
      transform={`translate(${x - CARD_W / 2}, ${y})`}
      opacity={dimmed ? 0.35 : 1}
      onContextMenu={(e) => {
        if (!onContextMenu) return;
        // Swallow the native browser context menu so our in-app menu can
        // take over, and stop propagation so the container's drag handler
        // doesn't think the right-click was the start of a pan.
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(person.id, e);
      }}
    >
      {/* Soft drop shadow */}
      <rect x={2} y={3} width={CARD_W} height={CARD_H} rx={10} fill="rgba(0,0,0,0.09)" />

      {/* Highlight halo — only drawn when a hovered edge has this card as
          one of its endpoints. A slightly larger rounded rect sits behind
          the card body and picks up the palette accent so both endpoints
          of a hovered line light up in the same color family as the line. */}
      {highlighted && (
        <rect
          x={-5}
          y={-5}
          width={CARD_W + 10}
          height={CARD_H + 10}
          rx={14}
          fill="none"
          stroke={palette.accent}
          strokeWidth={3}
          strokeOpacity={0.55}
        />
      )}

      {/* Card body. Dashed stroke for deceased people is the primary
          visual signal; the † in the date line backs it up. Stroke gets
          a touch thicker when highlighted so the selected pair pops. */}
      <rect
        width={CARD_W}
        height={CARD_H}
        rx={10}
        fill={palette.bg}
        stroke={palette.accent}
        strokeWidth={highlighted ? 2.5 : 1.5}
        strokeDasharray={isDeceased ? "5 3" : undefined}
      />

      {/* Solid accent stripe down the left edge. Stays solid even when the
          card border is dashed, so the gender color is always readable. */}
      <rect width={4} height={CARD_H} rx={2} fill={palette.accent} />

      {/* Avatar — photo when we have one, initials bubble otherwise. */}
      {person.photoUrl ? (
        <>
          <defs>
            <clipPath id={avatarClipId}>
              <circle cx={26} cy={CARD_H / 2} r={14} />
            </clipPath>
          </defs>
          <image
            href={person.photoUrl}
            x={26 - 14}
            y={CARD_H / 2 - 14}
            width={28}
            height={28}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${avatarClipId})`}
          />
          <circle
            cx={26}
            cy={CARD_H / 2}
            r={14}
            fill="none"
            stroke={palette.accent}
            strokeWidth={1.5}
          />
        </>
      ) : (
        <>
          <circle cx={26} cy={CARD_H / 2} r={14} fill={palette.accent} />
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
        </>
      )}

      {/* Name in the accent-dark color for better contrast on the pale bg. */}
      <text x={48} y={CARD_H / 2 - 3} fill={palette.accentDark} fontSize={12} fontWeight="700">
        {displayName}
      </text>
      {dateLine && (
        <text x={48} y={CARD_H / 2 + 10} fill="#6b7280" fontSize={9}>
          {dateLine}
        </text>
      )}
      {person.generation !== null && (
        <>
          <circle cx={CARD_W - 16} cy={16} r={10} fill={palette.accent} />
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
interface ContextMenuState {
  screenX: number;
  screenY: number;
  personId: string;
}

// Focus mode restricts the tree to a bloodline slice around a chosen
// person — `nUp` direct ancestors, `nDown` direct descendants, plus the
// immediate spouses of everyone in that set. Siblings / aunts / uncles /
// cousins are NOT included — "bloodline" here means the strict vertical
// line. If you want siblings, focus on a parent with nDown=1.
interface FocusState {
  personId: string;
  up: number;
  down: number;
}

const DEFAULT_FOCUS_UP = 2;
const DEFAULT_FOCUS_DOWN = 2;

export default function TreePage() {
  const [persons, setPersons] = useState<TreePerson[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  // People the user has chosen to hide via the context menu. Stored as a
  // Set of person ids; a filtered copy of `persons` with these ids stripped
  // is what gets handed to computePlacements(), so the layout naturally
  // drops them and re-packs the remaining cards without any other changes.
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  // Focus mode — when set, only the people in the focus bloodline are
  // rendered (plus their immediate spouses). Orthogonal to hiddenIds,
  // so the user can still hide individual people within a focused view.
  const [focus, setFocus] = useState<FocusState | null>(null);
  // Form values for the focus sub-panel in the context menu. Persisted
  // at the page level so they survive between menu openings — set ±1
  // once and every subsequent right-click defaults to the same range.
  const [focusUp, setFocusUp] = useState(DEFAULT_FOCUS_UP);
  const [focusDown, setFocusDown] = useState(DEFAULT_FOCUS_DOWN);
  // Which edge is currently under the mouse. `key` identifies the SVG
  // path; `personIds` are the cards to highlight at the same time so
  // hovering a parent→child curve also lights up the parents and child.
  // Other edges dim when this is set, which makes it possible to pick
  // out one line from a busy intersection. Null when nothing is hovered.
  const [hoveredEdge, setHoveredEdge] = useState<{
    key: string;
    personIds: string[];
  } | null>(null);

  useEffect(() => {
    fetch("/api/tree")
      .then((r) => r.json())
      .then((data) => {
        setPersons(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Close the context menu on any mousedown outside of it, on scroll, or
  // when Escape is pressed. Uses a data attribute rather than a ref so the
  // check works even if the menu was re-rendered between event and handler.
  useEffect(() => {
    if (!contextMenu) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest("[data-tree-context-menu]")) return;
      setContextMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [contextMenu]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.2, Math.min(3, z - e.deltaY * 0.001)));
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only left-click starts a pan. Right-click (button 2) would
      // otherwise grab the drag state and wedge the cursor into
      // "grabbing" mode on top of showing our context menu.
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest("a")) return;
      setDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    },
    [pan]
  );

  // Helpers that compute the full set of ids to drop for the two menu
  // actions. They deliberately go BEYOND strict ancestors / descendants —
  // the menu intent is "clean up the upper (or lower) half of the tree
  // relative to this person", so we also sweep up collateral relatives
  // (aunts, uncles, cousins, siblings-of-focus, etc.) and their in-laws
  // that would otherwise end up as dangling orphans once their parents
  // are hidden. The focus person and their descendants are protected so
  // Hide-ancestors never removes the person you right-clicked.

  // "Keep" set = the focus person + every descendant below them. These
  // are the people we MUST NOT hide. Shared by both helpers.
  const focusAndDescendants = useCallback(
    (personId: string): Set<string> => {
      const byId = new Map(persons.map((p) => [p.id, p]));
      const keep = new Set<string>();
      const q = [personId];
      while (q.length > 0) {
        const cur = q.shift()!;
        if (keep.has(cur)) continue;
        keep.add(cur);
        const p = byId.get(cur);
        if (!p) continue;
        for (const c of p.childIds) q.push(c);
      }
      return keep;
    },
    [persons]
  );

  // Hide-ancestors set: strict ancestors + every descendant of those
  // ancestors (aunts/uncles/cousins/siblings of the focus) + shallow
  // spouses of anyone in the hidden set. We do NOT walk upward from those
  // spouses — otherwise a cousin marrying into another branch of the tree
  // would drag that whole branch into the hidden set.
  const upwardHideSet = useCallback(
    (personId: string): Set<string> => {
      const byId = new Map(persons.map((p) => [p.id, p]));
      const keep = focusAndDescendants(personId);

      // Strict ancestors via parent BFS.
      const ancestors = new Set<string>();
      {
        const q = [personId];
        while (q.length > 0) {
          const cur = q.shift()!;
          const p = byId.get(cur);
          if (!p) continue;
          for (const pp of p.parentIds) {
            if (ancestors.has(pp)) continue;
            ancestors.add(pp);
            q.push(pp);
          }
        }
      }
      if (ancestors.size === 0) return new Set();

      const toHide = new Set<string>(ancestors);
      // Walk DOWN from each ancestor and pick up everyone in their
      // descendant subtree, except the focus's own line.
      const q: string[] = [...ancestors];
      while (q.length > 0) {
        const cur = q.shift()!;
        const p = byId.get(cur);
        if (!p) continue;
        // Spouses of whoever we're hiding — the aunt-by-marriage, the
        // grandfather's second wife, etc. Added but not traversed.
        for (const s of p.spouseIds) {
          if (keep.has(s)) continue;
          if (toHide.has(s)) continue;
          toHide.add(s);
        }
        for (const c of p.childIds) {
          if (keep.has(c)) continue;
          if (toHide.has(c)) continue;
          toHide.add(c);
          q.push(c);
        }
      }
      return toHide;
    },
    [persons, focusAndDescendants]
  );

  // Hide-descendants set: strict descendants + shallow spouses of each
  // descendant (sons- and daughters-in-law). Symmetric to upwardHideSet
  // but simpler — nothing needs to be protected on the parent side.
  const downwardHideSet = useCallback(
    (personId: string): Set<string> => {
      const byId = new Map(persons.map((p) => [p.id, p]));
      const descendants = new Set<string>();
      const root = byId.get(personId);
      if (!root) return descendants;
      const q: string[] = [...root.childIds];
      while (q.length > 0) {
        const cur = q.shift()!;
        if (descendants.has(cur)) continue;
        descendants.add(cur);
        const p = byId.get(cur);
        if (!p) continue;
        for (const c of p.childIds) q.push(c);
      }
      const toHide = new Set<string>(descendants);
      for (const id of descendants) {
        const p = byId.get(id);
        if (!p) continue;
        for (const s of p.spouseIds) {
          if (s === personId) continue;
          toHide.add(s);
        }
      }
      return toHide;
    },
    [persons]
  );

  const handleCardContextMenu = useCallback(
    (personId: string, e: React.MouseEvent) => {
      setContextMenu({ screenX: e.clientX, screenY: e.clientY, personId });
    },
    []
  );

  const hideAncestors = useCallback(
    (personId: string) => {
      const ids = upwardHideSet(personId);
      if (ids.size === 0) {
        setContextMenu(null);
        return;
      }
      setHiddenIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.add(id);
        return next;
      });
      setContextMenu(null);
    },
    [upwardHideSet]
  );

  const hideDescendants = useCallback(
    (personId: string) => {
      const ids = downwardHideSet(personId);
      if (ids.size === 0) {
        setContextMenu(null);
        return;
      }
      setHiddenIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.add(id);
        return next;
      });
      setContextMenu(null);
    },
    [downwardHideSet]
  );

  const hidePerson = useCallback((personId: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(personId);
      return next;
    });
    setContextMenu(null);
  }, []);

  // Compute the bloodline slice visible for a focus request. Includes
  //   - the focus person
  //   - up to `up` generations of strict ancestors via parentIds BFS
  //   - up to `down` generations of strict descendants via childIds BFS
  //   - every direct spouse of anyone in the set above (but NOT the
  //     spouses' families — "immediate spouse" is the rule, so in-laws
  //     don't drag their own branches onto the canvas)
  // Collateral relatives (siblings of ancestors, cousins, etc.) are
  // NOT included — that's "collateral bloodline" and the user can get
  // there by focusing on a parent with nDown bumped by one instead.
  const focusVisibleIds = useCallback(
    (personId: string, up: number, down: number): Set<string> => {
      const byId = new Map(persons.map((p) => [p.id, p]));
      const visible = new Set<string>();
      if (!byId.has(personId)) return visible;
      visible.add(personId);

      // Walk up `up` levels.
      let frontier = new Set<string>([personId]);
      for (let i = 0; i < up; i++) {
        const next = new Set<string>();
        for (const id of frontier) {
          const p = byId.get(id);
          if (!p) continue;
          for (const pid of p.parentIds) {
            if (visible.has(pid)) continue;
            visible.add(pid);
            next.add(pid);
          }
        }
        if (next.size === 0) break;
        frontier = next;
      }

      // Walk down `down` levels.
      frontier = new Set<string>([personId]);
      for (let i = 0; i < down; i++) {
        const next = new Set<string>();
        for (const id of frontier) {
          const p = byId.get(id);
          if (!p) continue;
          for (const cid of p.childIds) {
            if (visible.has(cid)) continue;
            visible.add(cid);
            next.add(cid);
          }
        }
        if (next.size === 0) break;
        frontier = next;
      }

      // Add immediate spouses of everyone in the bloodline set, but
      // stop there — we don't walk into the spouse's own family.
      const spouseIdsToAdd: string[] = [];
      for (const id of visible) {
        const p = byId.get(id);
        if (!p) continue;
        for (const sid of p.spouseIds) {
          if (visible.has(sid)) continue;
          spouseIdsToAdd.push(sid);
        }
      }
      for (const sid of spouseIdsToAdd) visible.add(sid);

      return visible;
    },
    [persons]
  );

  const applyFocus = useCallback(
    (personId: string) => {
      setFocus({ personId, up: focusUp, down: focusDown });
      setContextMenu(null);
    },
    [focusUp, focusDown]
  );

  // "Show all" now clears BOTH the hide set and the focus filter in one
  // shot, since both are ways of restricting visibility. The name stays
  // the same so the existing "Show all" button references keep working;
  // don't confuse this with `resetView` below, which handles zoom/pan.
  const showAll = useCallback(() => {
    setHiddenIds(new Set());
    setFocus(null);
    setContextMenu(null);
  }, []);

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
  // Reset snaps zoom back to DEFAULT_ZOOM and re-centers the pan. No
  // auto-fit — the user likes the default 180% level and wants the tree
  // to stay at that zoom regardless of how many people are visible.
  const resetView = () => {
    setZoom(DEFAULT_ZOOM);
    setPan({ x: 0, y: 0 });
  };

  if (loading) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Loading family tree...</p>
      </div>
    );
  }

  // Strip hidden people and anything outside the active focus bloodline,
  // and rewrite everyone else's parent/child/spouse id lists so they
  // don't dangle at ids that no longer exist in the dataset the layout
  // sees. computePlacements already tolerates missing ids, but keeping
  // the input self-consistent means the sibling and parent-centering
  // rules don't accidentally try to reach into a filtered-out branch.
  const focusVisibleSet = focus
    ? focusVisibleIds(focus.personId, focus.up, focus.down)
    : null;
  const isVisible = (id: string) =>
    !hiddenIds.has(id) && (focusVisibleSet === null || focusVisibleSet.has(id));
  const visiblePersons =
    hiddenIds.size === 0 && focusVisibleSet === null
      ? persons
      : persons
          .filter((p) => isVisible(p.id))
          .map((p) => ({
            ...p,
            parentIds: p.parentIds.filter(isVisible),
            childIds: p.childIds.filter(isVisible),
            spouseIds: p.spouseIds.filter(isVisible),
          }));

  const { placements, drawnSpousePairs, unlinkedPersons } = computePlacements(visiblePersons);
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
  // Base padding gives every card breathing room from the SVG edge so
  // the outer card border never brushes the container's border.
  const basePad = 100;
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

  // ── Top-generation centering ──────────────────────────────────────
  // The BFS layout above places everyone relative to whichever ancestor
  // was processed first, which typically leaves the top row sitting off
  // to one side of the horizontal midpoint. Asymmetrically expand the
  // left OR right padding so the centroid of the top generation lines
  // up with the horizontal center of the SVG — giving the "top in the
  // middle, everything fans out below" look the user asked for. We
  // don't move any card, we only pad the SVG, so the existing layout's
  // sibling-adjacency and couple-stick rules stay intact.
  const topRow = allPlacements.filter((p) => p.y === minY);
  const topCentroid =
    topRow.length > 0
      ? topRow.reduce((s, p) => s + p.x, 0) / topRow.length
      : (minX + maxX) / 2;
  const currentMidX = (minX + maxX) / 2;
  const delta = topCentroid - currentMidX;
  // If delta > 0 the top row is to the RIGHT of the bounds' midpoint;
  // we extend the right side by 2*delta so the new midpoint lands on
  // the top centroid. delta < 0 mirrors on the left.
  const padLeft = basePad + (delta < 0 ? -2 * delta : 0);
  const padRight = basePad + (delta > 0 ? 2 * delta : 0);

  const svgW = maxX - minX + padLeft + padRight;
  const svgH = maxY - minY + basePad * 2;
  const oX = -minX + padLeft;
  const oY = -minY + basePad;

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
    // IDs of the cards this edge connects, so hovering the edge can
    // light up both endpoints. For a joint-parent couple curve, both
    // parents AND the child are all highlighted at once.
    personIds: string[];
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
          personIds: [a.person.id, b.person.id, childId],
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
            personIds: [extra.person.id, childId],
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
        personIds: [p.person.id, childId],
      });
    }
  }

  // Exact counts from the raw API payload vs what actually ended up on
  // the canvas. `expectedRenderCount` is the size of the filtered set
  // (after both hide and focus), so "Rendering 5 of 19" is informative
  // rather than looking like a bug. A real mismatch — layout dropping a
  // row that the filters didn't ask to drop — still turns the counter
  // red and the number flags it.
  const apiPersonCount = persons.length;
  const renderedPersonCount = allPlacements.length;
  const hiddenCount = hiddenIds.size;
  const filtered = hiddenCount > 0 || focus !== null;
  const expectedRenderCount = visiblePersons.length;
  const countsMatch = renderedPersonCount === expectedRenderCount;

  // Label for the person currently being focused on, used by the
  // header status chip when focus mode is active.
  const focusPerson = focus ? persons.find((p) => p.id === focus.personId) : null;

  // Look up the name of the right-clicked person so we can label the
  // context menu. Falls back to the string id if the person isn't in the
  // current visible set (shouldn't happen — you can only right-click a
  // rendered card — but defensive).
  const contextMenuPerson = contextMenu
    ? persons.find((p) => p.id === contextMenu.personId)
    : null;
  const contextMenuHasParents = contextMenuPerson
    ? contextMenuPerson.parentIds.length > 0
    : false;
  const contextMenuHasChildren = contextMenuPerson
    ? contextMenuPerson.childIds.length > 0
    : false;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between mb-2 gap-1">
        <h1 className="text-2xl font-bold text-amber-900">Family Tree</h1>
        <span
          className={`text-xs font-medium flex items-center gap-2 flex-wrap ${
            countsMatch ? "text-gray-500" : "text-red-600"
          }`}
          title="How many people the tree is drawing vs how many are in the database"
        >
          <span>
            Rendering {renderedPersonCount} of {apiPersonCount}
            {hiddenCount > 0 ? ` (${hiddenCount} hidden)` : ""} from{" "}
            <Link href="/persons" className="underline hover:text-amber-700">
              /persons
            </Link>
            {countsMatch ? "" : " \u2014 mismatch!"}
          </span>
          {focus && focusPerson && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 border border-amber-200">
              Focused on {focusPerson.firstName} {focusPerson.lastName ?? ""}{" "}
              <span className="text-amber-600">
                (↑{focus.up}/↓{focus.down})
              </span>
            </span>
          )}
          {filtered && (
            <button
              type="button"
              onClick={showAll}
              className="text-amber-700 underline hover:text-amber-900"
            >
              Show all
            </button>
          )}
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Drag to pan, scroll to zoom. Click a card to view profile. Right-click a card to hide relatives or focus on a bloodline. Hover a line to trace the relationship and highlight both ends.
      </p>
      {unlinkedPersons.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="font-semibold text-amber-900 mb-1">
            {unlinkedPersons.length} {unlinkedPersons.length === 1 ? "person is" : "people are"} not connected to the main tree
          </p>
          <p className="text-xs text-amber-800 mb-2">
            They appear at the bottom of the canvas in a separate row. Add a parent, spouse, or child relationship on their profile to splice them into the main tree.
          </p>
          <ul className="flex flex-wrap gap-2">
            {unlinkedPersons.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/persons/${p.id}`}
                  className="inline-block rounded-full bg-amber-100 text-amber-900 text-xs px-3 py-1 hover:bg-amber-200 hover:underline"
                >
                  {p.firstName} {p.lastName ?? ""}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="relative">
        <div
          ref={containerRef}
          className="rounded-xl shadow-lg border border-amber-200 overflow-hidden select-none flex items-center justify-center"
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
          {/* The SVG is sized to its INTRINSIC pixel dimensions (svgW/svgH)
              rather than width="100%" + viewBox scaling. Earlier we let the
              viewBox fit into a 100%-sized SVG, which meant the "1x" base
              was already a function of svgW — so adding more people grew
              svgW, shrank the base fit, and made cards visibly smaller even
              though the zoom state hadn't changed. Now the SVG has a true
              pixel size that doesn't care how many people are on it; the
              flex parent centers it, `overflow: hidden` clips the excess
              when the tree is bigger than the viewport, and the CSS
              transform handles pan + zoom as pure multipliers on the
              natural size. One card = CARD_W pixels wide at zoom=1, always. */}
          <svg
            width={svgW}
            height={svgH}
            viewBox={`0 0 ${svgW} ${svgH}`}
            style={{
              flexShrink: 0,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center center",
            }}
          >
            {/* Parent-child curves. Each edge is rendered as TWO paths:
                a thick transparent "hit area" on top that captures hover
                with pointer-events, and the visible stroke underneath.
                When an edge is hovered we brighten it, thicken it, and
                dim every other edge so the path is easy to trace even in
                a crowded intersection. */}
            {parentChildEdges.map((e) => {
              const isHovered = hoveredEdge?.key === e.key;
              const someHovered = hoveredEdge !== null;
              const d = parentChildPath(e.px + oX, e.py + oY, e.cx + oX, e.cy + oY);
              return (
                <g key={e.key}>
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={18}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => setHoveredEdge({ key: e.key, personIds: e.personIds })}
                    onMouseLeave={() => setHoveredEdge(null)}
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke={isHovered ? "#92400e" : "#d97706"}
                    strokeWidth={isHovered ? 3.5 : 2}
                    strokeOpacity={isHovered ? 1 : someHovered ? 0.1 : 0.45}
                    pointerEvents="none"
                  />
                </g>
              );
            })}

            {/* Marriage lines (one per unique pair). Same hover treatment
                as the parent-child curves — a wide invisible hit area
                catches the mouse, the visible line + heart highlights on
                hover and dims when another edge is highlighted. */}
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
              const key = `m-${[aId, bId].sort().join("-")}`;
              const isHovered = hoveredEdge?.key === key;
              const someHovered = hoveredEdge !== null;
              const strokeColor = isHovered ? "#9f1239" : "#b45309";
              const opacity = isHovered ? 1 : someHovered ? 0.12 : 0.6;
              return (
                <g key={key}>
                  <line
                    x1={x1}
                    y1={y}
                    x2={x2}
                    y2={y}
                    stroke="transparent"
                    strokeWidth={18}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => setHoveredEdge({ key, personIds: [aId, bId] })}
                    onMouseLeave={() => setHoveredEdge(null)}
                  />
                  <line
                    x1={x1}
                    y1={y}
                    x2={x2}
                    y2={y}
                    stroke={strokeColor}
                    strokeWidth={isHovered ? 3 : 2}
                    strokeOpacity={opacity}
                    pointerEvents="none"
                  />
                  <circle
                    cx={midX}
                    cy={y}
                    r={7}
                    fill="#fff7ed"
                    stroke={strokeColor}
                    strokeWidth={1.2}
                    strokeOpacity={opacity}
                    pointerEvents="none"
                  />
                  <text
                    x={midX}
                    y={y + 3}
                    fill={strokeColor}
                    fillOpacity={opacity}
                    fontSize={10}
                    textAnchor="middle"
                    pointerEvents="none"
                  >
                    &#9829;
                  </text>
                </g>
              );
            })}

            {/* Person cards. When an edge is hovered, cards at the endpoints
                get a bright halo; every other card dims so the picked pair
                stands out visually. */}
            {allPlacements.map((p) => {
              const isEndpoint = hoveredEdge?.personIds.includes(p.person.id) ?? false;
              const someHovered = hoveredEdge !== null;
              return (
                <TreeCard
                  key={p.person.id}
                  person={p.person}
                  x={p.x + oX}
                  y={p.y + oY}
                  onContextMenu={handleCardContextMenu}
                  highlighted={isEndpoint}
                  dimmed={someHovered && !isEndpoint}
                />
              );
            })}
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

      {/* Context menu. Rendered as `position: fixed` in viewport coords so
          it lands where the user right-clicked regardless of page scroll or
          tree pan/zoom. Dismissed by the mousedown / Escape listeners in
          the effect above. */}
      {contextMenu && contextMenuPerson && (
        <div
          data-tree-context-menu
          className="fixed z-50 bg-white border border-gray-200 rounded-md shadow-lg py-1 text-sm min-w-[240px]"
          style={{
            top: Math.min(contextMenu.screenY, window.innerHeight - 340),
            left: Math.min(contextMenu.screenX, window.innerWidth - 260),
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="px-3 py-1.5 text-xs text-gray-400 border-b border-gray-100 truncate">
            {contextMenuPerson.firstName} {contextMenuPerson.lastName ?? ""}
          </div>
          <button
            type="button"
            disabled={!contextMenuHasParents}
            onClick={() => hideAncestors(contextMenu.personId)}
            className="w-full text-left px-3 py-2 hover:bg-amber-50 text-gray-700 disabled:text-gray-300 disabled:hover:bg-transparent disabled:cursor-not-allowed"
          >
            Hide ancestors
          </button>
          <button
            type="button"
            disabled={!contextMenuHasChildren}
            onClick={() => hideDescendants(contextMenu.personId)}
            className="w-full text-left px-3 py-2 hover:bg-amber-50 text-gray-700 disabled:text-gray-300 disabled:hover:bg-transparent disabled:cursor-not-allowed"
          >
            Hide descendants
          </button>
          <button
            type="button"
            onClick={() => hidePerson(contextMenu.personId)}
            className="w-full text-left px-3 py-2 hover:bg-amber-50 text-gray-700"
          >
            Hide this person
          </button>
          {/* Focus sub-panel. Inline form with +/- steppers and an
              Apply button so the user can dial in exactly how many
              generations they want to keep in view without leaving the
              menu. Only the direct bloodline plus immediate spouses is
              kept; collaterals (aunts, uncles, cousins, siblings) are
              excluded on purpose — that's the definition of bloodline. */}
          <div className="border-t border-gray-100 mt-1 pt-2 px-3 pb-2 bg-amber-50/30">
            <div className="text-xs font-semibold text-gray-600 mb-2">
              Focus on this bloodline
            </div>
            <div className="flex items-center justify-between gap-2 text-xs text-gray-700 mb-1.5">
              <span>Ancestors up</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setFocusUp((v) => Math.max(0, v - 1))}
                  className="w-6 h-6 rounded border border-gray-300 hover:bg-white text-gray-600"
                  aria-label="Decrease ancestors"
                >
                  −
                </button>
                <span className="w-6 text-center font-mono">{focusUp}</span>
                <button
                  type="button"
                  onClick={() => setFocusUp((v) => Math.min(10, v + 1))}
                  className="w-6 h-6 rounded border border-gray-300 hover:bg-white text-gray-600"
                  aria-label="Increase ancestors"
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs text-gray-700 mb-2.5">
              <span>Descendants down</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setFocusDown((v) => Math.max(0, v - 1))}
                  className="w-6 h-6 rounded border border-gray-300 hover:bg-white text-gray-600"
                  aria-label="Decrease descendants"
                >
                  −
                </button>
                <span className="w-6 text-center font-mono">{focusDown}</span>
                <button
                  type="button"
                  onClick={() => setFocusDown((v) => Math.min(10, v + 1))}
                  className="w-6 h-6 rounded border border-gray-300 hover:bg-white text-gray-600"
                  aria-label="Increase descendants"
                >
                  +
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => applyFocus(contextMenu.personId)}
              className="w-full px-3 py-1.5 rounded bg-amber-700 text-white text-xs font-medium hover:bg-amber-800"
            >
              Apply focus
            </button>
          </div>
          {filtered && (
            <>
              <div className="border-t border-gray-100 my-1" />
              <button
                type="button"
                onClick={showAll}
                className="w-full text-left px-3 py-2 hover:bg-amber-50 text-amber-700 font-medium"
              >
                Show all
                {hiddenCount > 0 && ` (${hiddenCount} hidden)`}
                {focus && " · clear focus"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
