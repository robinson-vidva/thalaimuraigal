"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";

interface TreeNode {
  name: string;
  attributes?: Record<string, string>;
  children?: TreeNode[];
  _id?: string;
}

interface LayoutNode {
  node: TreeNode;
  x: number;
  y: number;
  width: number;
  children: LayoutNode[];
}

const CARD_W = 200;
const CARD_H_SINGLE = 50;
const CARD_H_SPOUSE = 70;
const H_GAP = 40;
const V_GAP = 40;

function cardHeight(node: TreeNode): number {
  return node.attributes?.spouse ? CARD_H_SPOUSE : CARD_H_SINGLE;
}

function layoutTree(node: TreeNode, depth: number): LayoutNode {
  const children = (node.children || []).map((c) => layoutTree(c, depth + 1));

  const totalChildWidth = children.reduce((sum, c, i) => sum + c.width + (i > 0 ? H_GAP : 0), 0);
  const selfWidth = Math.max(CARD_W, totalChildWidth);

  let childX = -totalChildWidth / 2;
  for (const child of children) {
    child.x = childX + child.width / 2;
    childX += child.width + H_GAP;
  }

  return {
    node,
    x: 0,
    y: depth * (CARD_H_SPOUSE + V_GAP),
    width: selfWidth,
    children,
  };
}

function flattenNodes(layout: LayoutNode, offsetX: number, offsetY: number): { nodes: LayoutNode[]; lines: { x1: number; y1: number; x2: number; y2: number }[] } {
  const absX = offsetX + layout.x;
  const absY = offsetY + layout.y;
  const h = cardHeight(layout.node);

  const result: { nodes: LayoutNode[]; lines: { x1: number; y1: number; x2: number; y2: number }[] } = {
    nodes: [{ ...layout, x: absX, y: absY }],
    lines: [],
  };

  for (const child of layout.children) {
    const childAbsX = absX + child.x;
    const childAbsY = absY + layout.y + h + V_GAP - offsetY - layout.y;

    // Line from parent bottom to child top
    result.lines.push({
      x1: absX,
      y1: absY + h,
      x2: absX + child.x,
      y2: absY + h + V_GAP,
    });

    const sub = flattenNodes(child, absX, absY + h + V_GAP);
    result.nodes.push(...sub.nodes);
    result.lines.push(...sub.lines);
  }

  return result;
}

function TreeCard({ node, x, y }: { node: TreeNode; x: number; y: number }) {
  const gender = node.attributes?.gender;
  const hasSpouse = !!node.attributes?.spouse;
  const h = cardHeight(node);
  const accentColor = gender === "M" ? "#92400e" : gender === "F" ? "#b45309" : "#6b7280";
  const bgColor = gender === "M" ? "#fffbeb" : gender === "F" ? "#fff7ed" : "#f9fafb";
  const initials = node.name.split(" ").map((n) => n[0]).join("").slice(0, 2);

  return (
    <g transform={`translate(${x - CARD_W / 2}, ${y})`}>
      {/* Shadow */}
      <rect x={2} y={3} width={CARD_W} height={h} rx={10} fill="rgba(0,0,0,0.08)" />
      {/* Card bg */}
      <rect x={0} y={0} width={CARD_W} height={h} rx={10} fill={bgColor} stroke={accentColor} strokeWidth={1.2} />
      {/* Left accent */}
      <rect x={0} y={0} width={4} height={h} rx={2} fill={accentColor} />

      {/* Avatar */}
      <circle cx={24} cy={hasSpouse ? 22 : h / 2} r={13} fill={accentColor} />
      <text x={24} y={hasSpouse ? 26 : h / 2 + 4} fill="white" fontSize={9} fontWeight="bold" textAnchor="middle">{initials}</text>

      {/* Name */}
      <text x={44} y={hasSpouse ? 18 : h / 2 - 4} fill="#1c1917" fontSize={11} fontWeight="700">{node.name}</text>

      {/* Dates */}
      {node.attributes?.born && (
        <text x={44} y={hasSpouse ? 30 : h / 2 + 8} fill="#a1a1aa" fontSize={8}>
          {node.attributes.born}{node.attributes.died ? ` – ${node.attributes.died}` : ""}
        </text>
      )}

      {/* Spouse */}
      {hasSpouse && (
        <>
          <line x1={10} y1={40} x2={CARD_W - 10} y2={40} stroke={accentColor} strokeWidth={0.4} strokeOpacity={0.4} />
          <text x={14} y={57} fill={accentColor} fontSize={10}>♥</text>
          <text x={28} y={57} fill="#78716c" fontSize={10} fontWeight="500">{node.attributes?.spouse}</text>
        </>
      )}

      {/* Gen badge */}
      {node.attributes?.generation && (
        <>
          <circle cx={CARD_W - 14} cy={14} r={9} fill={accentColor} />
          <text x={CARD_W - 14} y={17} fill="white" fontSize={7} fontWeight="bold" textAnchor="middle">G{node.attributes.generation}</text>
        </>
      )}

      {/* Clickable link */}
      {node._id && (
        <a href={`/persons/${node._id}`} style={{ cursor: "pointer" }}>
          <rect x={0} y={0} width={CARD_W} height={h} fill="transparent" />
        </a>
      )}
    </g>
  );
}

export default function TreePage() {
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewBox, setViewBox] = useState("0 0 800 600");
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    fetch("/api/tree")
      .then((r) => r.json())
      .then((data) => {
        setTreeData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.3, Math.min(3, z - e.deltaY * 0.001)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [dragging, dragStart]);

  const handleMouseUp = useCallback(() => setDragging(false), []);

  if (loading) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Loading family tree...</p>
      </div>
    );
  }

  if (treeData.length === 0) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-amber-900 mb-4">Family Tree</h1>
        <p className="text-gray-500">
          No family data yet.{" "}
          <Link href="/persons/new" className="text-amber-700 underline">
            Add members
          </Link>{" "}
          and link them to build the tree.
        </p>
      </div>
    );
  }

  // Layout all trees
  const rootNode: TreeNode =
    treeData.length === 1
      ? treeData[0]
      : { name: "Family", children: treeData, attributes: {} };

  const layout = layoutTree(rootNode, 0);
  const { nodes, lines } = flattenNodes(layout, 0, 0);

  // Calculate SVG bounds
  const padding = 60;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x - CARD_W / 2);
    maxX = Math.max(maxX, n.x + CARD_W / 2);
    minY = Math.min(minY, n.y);
    maxY = Math.max(maxY, n.y + CARD_H_SPOUSE);
  }

  const svgW = maxX - minX + padding * 2;
  const svgH = maxY - minY + padding * 2;
  const offsetX = -minX + padding;
  const offsetY = -minY + padding;

  return (
    <div>
      <h1 className="text-2xl font-bold text-amber-900 mb-2">Family Tree</h1>
      <p className="text-sm text-gray-500 mb-4">
        Drag to pan, scroll to zoom. Click a card to view profile.
      </p>
      <div
        ref={containerRef}
        className="rounded-xl shadow-lg border border-amber-100 overflow-hidden"
        style={{
          width: "100%",
          height: "min(75vh, calc(100dvh - 180px))",
          background: "linear-gradient(180deg, #fffbeb 0%, #ffffff 40%, #fefce8 100%)",
          cursor: dragging ? "grabbing" : "grab",
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
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
          {/* Connector lines */}
          {lines.map((line, i) => (
            <g key={`line-${i}`}>
              <line
                x1={line.x1 + offsetX}
                y1={line.y1 + offsetY}
                x2={line.x1 + offsetX}
                y2={(line.y1 + line.y2) / 2 + offsetY}
                stroke="#d97706"
                strokeWidth={1.5}
                strokeOpacity={0.35}
              />
              <line
                x1={line.x1 + offsetX}
                y1={(line.y1 + line.y2) / 2 + offsetY}
                x2={line.x2 + offsetX}
                y2={(line.y1 + line.y2) / 2 + offsetY}
                stroke="#d97706"
                strokeWidth={1.5}
                strokeOpacity={0.35}
              />
              <line
                x1={line.x2 + offsetX}
                y1={(line.y1 + line.y2) / 2 + offsetY}
                x2={line.x2 + offsetX}
                y2={line.y2 + offsetY}
                stroke="#d97706"
                strokeWidth={1.5}
                strokeOpacity={0.35}
              />
            </g>
          ))}

          {/* Node cards */}
          {nodes.map((n, i) => (
            <TreeCard key={i} node={n.node} x={n.x + offsetX} y={n.y + offsetY} />
          ))}
        </svg>
      </div>
    </div>
  );
}
