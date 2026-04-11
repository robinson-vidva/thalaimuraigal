"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";

interface Partner {
  name: string;
  attributes?: Record<string, string>;
  _id?: string;
}

interface TreeNode {
  name: string;
  attributes?: Record<string, string>;
  children?: TreeNode[];
  _id?: string;
  partner?: Partner;
}

interface FlatNode {
  node: TreeNode | Partner;
  x: number;
  y: number;
}

interface Connector {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface Marriage {
  x1: number;
  x2: number;
  y: number;
}

// ── Layout constants ──
const CARD_W = 220;
const CARD_H = 54;
const PAIR_GAP = 28;  // horizontal gap between spouses inside a couple
const H_GAP = 30;     // horizontal gap between sibling subtrees
const V_GAP = 70;     // vertical gap between generations

// A person + their spouse takes two cards side by side.
function pairWidth(node: TreeNode): number {
  return node.partner ? 2 * CARD_W + PAIR_GAP : CARD_W;
}

// ── Recursive layout engine ──
// Returns the width of the subtree and sets x positions relative to center
interface LayoutResult {
  node: TreeNode;
  relX: number; // relative x (center of card, 0 = center of subtree)
  depth: number;
  width: number;
  children: LayoutResult[];
}

function computeLayout(node: TreeNode, depth: number): LayoutResult {
  const kids = (node.children || []).map((c) => computeLayout(c, depth + 1));
  const selfW = pairWidth(node);

  if (kids.length === 0) {
    return { node, relX: 0, depth, width: selfW, children: [] };
  }

  // Total width of children placed side by side
  const totalChildW = kids.reduce((s, k, i) => s + k.width + (i > 0 ? H_GAP : 0), 0);
  const subtreeW = Math.max(selfW, totalChildW);

  // Position children left-to-right, centered under parent
  let cursor = -totalChildW / 2;
  for (const k of kids) {
    k.relX = cursor + k.width / 2;
    cursor += k.width + H_GAP;
  }

  return { node, relX: 0, depth, width: subtreeW, children: kids };
}

// ── Flatten to absolute positions ──
// `absX` represents the CENTER of the node's slot. For a couple that's the
// midpoint between the two spouse cards; for a single person it's the card
// center. Children always descend from this midpoint so the generation flow
// stays straight.
function flatten(
  lr: LayoutResult,
  parentAbsX: number,
  absY: number
): { nodes: FlatNode[]; connectors: Connector[]; marriages: Marriage[] } {
  const absX = parentAbsX + lr.relX;
  const hasPartner = !!lr.node.partner;
  const nodes: FlatNode[] = [];
  const marriages: Marriage[] = [];

  if (hasPartner) {
    // Two cards side-by-side, separated by PAIR_GAP.
    const offset = (CARD_W + PAIR_GAP) / 2;
    const primaryX = absX - offset;
    const partnerX = absX + offset;
    nodes.push({ node: lr.node, x: primaryX, y: absY });
    nodes.push({ node: lr.node.partner!, x: partnerX, y: absY });
    // Marriage line between the inner edges of the two cards, vertically centered.
    marriages.push({
      x1: primaryX + CARD_W / 2,
      x2: partnerX - CARD_W / 2,
      y: absY + CARD_H / 2,
    });
  } else {
    nodes.push({ node: lr.node, x: absX, y: absY });
  }

  const connectors: Connector[] = [];
  const childY = absY + CARD_H + V_GAP;

  for (const kid of lr.children) {
    const kidAbsX = absX + kid.relX;
    // Parent-child connector: start from the couple midpoint (or single-card
    // center) at the bottom of the card row, curve down to the child's top.
    connectors.push({
      x1: absX,
      y1: absY + CARD_H,
      x2: kidAbsX,
      y2: childY,
    });

    const sub = flatten(kid, absX, childY);
    nodes.push(...sub.nodes);
    connectors.push(...sub.connectors);
    marriages.push(...sub.marriages);
  }

  return { nodes, connectors, marriages };
}

// ── Curved connector path ──
function connectorPath(c: Connector): string {
  const midY = (c.y1 + c.y2) / 2;
  return `M ${c.x1},${c.y1} C ${c.x1},${midY} ${c.x2},${midY} ${c.x2},${c.y2}`;
}

// ── Tree card component ──
// Renders a single person card. Couples are two of these side by side.
function TreeCard({ node, x, y }: { node: TreeNode | Partner; x: number; y: number }) {
  const gender = node.attributes?.gender;
  const accent = gender === "M" ? "#92400e" : gender === "F" ? "#b45309" : "#6b7280";
  const bg = gender === "M" ? "#fffbeb" : gender === "F" ? "#fff7ed" : "#f9fafb";
  const initials = node.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <g transform={`translate(${x - CARD_W / 2}, ${y})`}>
      {/* Shadow */}
      <rect x={2} y={3} width={CARD_W} height={CARD_H} rx={10} fill="rgba(0,0,0,0.06)" />
      {/* Card */}
      <rect width={CARD_W} height={CARD_H} rx={10} fill={bg} stroke={accent} strokeWidth={1.5} />
      {/* Left accent bar */}
      <rect width={4} height={CARD_H} rx={2} fill={accent} />
      {/* Avatar circle */}
      <circle cx={26} cy={CARD_H / 2} r={14} fill={accent} />
      <text x={26} y={CARD_H / 2 + 4} fill="white" fontSize={10} fontWeight="bold" textAnchor="middle">{initials}</text>
      {/* Name */}
      <text x={48} y={CARD_H / 2 - 3} fill="#1c1917" fontSize={12} fontWeight="700">
        {node.name.length > 20 ? node.name.slice(0, 18) + "..." : node.name}
      </text>
      {/* Dates */}
      {node.attributes?.born && (
        <text x={48} y={CARD_H / 2 + 10} fill="#a1a1aa" fontSize={9}>
          {node.attributes.born}{node.attributes.died ? ` - ${node.attributes.died}` : ""}
        </text>
      )}
      {/* Generation badge */}
      {node.attributes?.generation && (
        <>
          <circle cx={CARD_W - 16} cy={16} r={10} fill={accent} />
          <text x={CARD_W - 16} y={20} fill="white" fontSize={8} fontWeight="bold" textAnchor="middle">G{node.attributes.generation}</text>
        </>
      )}
      {/* Clickable overlay */}
      {node._id && (
        <a href={`/persons/${node._id}`} style={{ cursor: "pointer" }}>
          <rect width={CARD_W} height={CARD_H} fill="transparent" rx={10} />
        </a>
      )}
    </g>
  );
}

// ── Main page ──
export default function TreePage() {
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    fetch("/api/tree")
      .then((r) => r.json())
      .then((data) => { setTreeData(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // ── Mouse pan/zoom ──
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.2, Math.min(3, z - e.deltaY * 0.001)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("a")) return; // don't drag on links
    setDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [dragging, dragStart]);

  const handleMouseUp = useCallback(() => setDragging(false), []);

  // ── Touch pan ──
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      touchStartRef.current = { x: t.clientX - pan.x, y: t.clientY - pan.y };
    }
  }, [pan]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && touchStartRef.current) {
      const t = e.touches[0];
      setPan({ x: t.clientX - touchStartRef.current.x, y: t.clientY - touchStartRef.current.y });
    }
  }, []);

  const handleTouchEnd = useCallback(() => { touchStartRef.current = null; }, []);

  // ── Zoom controls ──
  const zoomIn = () => setZoom((z) => Math.min(3, z + 0.2));
  const zoomOut = () => setZoom((z) => Math.max(0.2, z - 0.2));
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  if (loading) {
    return <div className="text-center py-16"><p className="text-gray-500">Loading family tree...</p></div>;
  }

  if (treeData.length === 0) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-amber-900 mb-4">Family Tree</h1>
        <p className="text-gray-500">
          No family data yet.{" "}
          <Link href="/persons/new" className="text-amber-700 underline">Add members</Link>{" "}
          and link them to build the tree.
        </p>
      </div>
    );
  }

  // ── Layout multiple root trees side by side (no synthetic "Family" node) ──
  const layouts = treeData.map((root) => computeLayout(root, 0));

  const allNodes: FlatNode[] = [];
  const allConnectors: Connector[] = [];
  const allMarriages: Marriage[] = [];

  // Place each root tree next to each other horizontally
  let offsetX = 0;
  for (const lr of layouts) {
    const { nodes, connectors, marriages } = flatten(lr, offsetX, 0);
    allNodes.push(...nodes);
    allConnectors.push(...connectors);
    allMarriages.push(...marriages);
    offsetX += lr.width + H_GAP * 2;
  }

  // Calculate SVG bounds
  const pad = 80;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const n of allNodes) {
    minX = Math.min(minX, n.x - CARD_W / 2);
    maxX = Math.max(maxX, n.x + CARD_W / 2);
    minY = Math.min(minY, n.y);
    maxY = Math.max(maxY, n.y + CARD_H);
  }
  const svgW = maxX - minX + pad * 2;
  const svgH = maxY - minY + pad * 2;
  const oX = -minX + pad;
  const oY = -minY + pad;

  return (
    <div>
      <h1 className="text-2xl font-bold text-amber-900 mb-2">Family Tree</h1>
      <p className="text-sm text-gray-500 mb-4">
        Drag to pan, scroll to zoom. Click a card to view profile.
      </p>
      <div className="relative">
        {/* Tree canvas */}
        <div
          ref={containerRef}
          className="rounded-xl shadow-lg border border-amber-200 overflow-hidden select-none"
          style={{
            width: "100%",
            height: "min(75vh, calc(100dvh - 180px))",
            minHeight: "400px",
            background: "linear-gradient(180deg, #fffbeb 0%, #ffffff 50%, #fefce8 100%)",
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
            {/* Parent-child curved connectors */}
            {allConnectors.map((c, i) => (
              <path
                key={`c-${i}`}
                d={connectorPath({
                  x1: c.x1 + oX,
                  y1: c.y1 + oY,
                  x2: c.x2 + oX,
                  y2: c.y2 + oY,
                })}
                fill="none"
                stroke="#d97706"
                strokeWidth={2}
                strokeOpacity={0.45}
              />
            ))}

            {/* Marriage connectors (horizontal line + heart between spouses) */}
            {allMarriages.map((m, i) => {
              const x1 = m.x1 + oX;
              const x2 = m.x2 + oX;
              const y = m.y + oY;
              const midX = (x1 + x2) / 2;
              return (
                <g key={`m-${i}`}>
                  <line
                    x1={x1}
                    y1={y}
                    x2={x2}
                    y2={y}
                    stroke="#b45309"
                    strokeWidth={2}
                    strokeOpacity={0.6}
                  />
                  <circle cx={midX} cy={y} r={7} fill="#fff7ed" stroke="#b45309" strokeWidth={1.2} />
                  <text x={midX} y={y + 3} fill="#b45309" fontSize={10} textAnchor="middle">&#9829;</text>
                </g>
              );
            })}

            {/* Cards */}
            {allNodes.map((n, i) => (
              <TreeCard key={i} node={n.node} x={n.x + oX} y={n.y + oY} />
            ))}
          </svg>
        </div>

        {/* Zoom/Pan controls */}
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Zoom level indicator */}
        <div className="absolute bottom-4 left-4 text-xs text-gray-400 bg-white/80 px-2 py-1 rounded-md border border-gray-200">
          {Math.round(zoom * 100)}%
        </div>
      </div>
    </div>
  );
}
