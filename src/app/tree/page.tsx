"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

const Tree = dynamic(() => import("react-d3-tree"), { ssr: false });

interface TreeNode {
  name: string;
  attributes?: Record<string, string>;
  children?: TreeNode[];
  _id?: string;
}

export default function TreePage() {
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });

  useEffect(() => {
    fetch("/api/tree")
      .then((r) => r.json())
      .then((data) => {
        setTreeData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      const { width } = containerRef.current.getBoundingClientRect();
      setTranslate({ x: width / 2, y: 60 });
    }
  }, [loading]);

  const renderCustomNode = useCallback(
    ({ nodeDatum }: { nodeDatum: TreeNode }) => {
      const gender = nodeDatum.attributes?.gender;
      const bgColor =
        gender === "M" ? "#92400e" : gender === "F" ? "#d97706" : "#78716c";
      const hasSpouse = !!nodeDatum.attributes?.spouse;
      const cardWidth = hasSpouse ? 240 : 140;
      const cardX = -cardWidth / 2;

      return (
        <g>
          {/* Card background */}
          <rect
            x={cardX}
            y={-35}
            width={cardWidth}
            height={hasSpouse ? 75 : 65}
            rx={10}
            ry={10}
            fill="white"
            stroke="#fbbf24"
            strokeWidth={2}
            filter="url(#shadow)"
          />

          {/* Person circle */}
          <circle
            cx={hasSpouse ? cardX + 35 : 0}
            cy={0}
            r={18}
            fill={bgColor}
            stroke="white"
            strokeWidth={2}
          />
          <text
            x={hasSpouse ? cardX + 35 : 0}
            y={5}
            fill="white"
            fontSize={11}
            fontWeight="bold"
            textAnchor="middle"
          >
            {nodeDatum.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </text>

          {/* Person name */}
          <text
            x={hasSpouse ? cardX + 60 : 0}
            y={-15}
            fill="#1c1917"
            fontSize={11}
            fontWeight="700"
            textAnchor={hasSpouse ? "start" : "middle"}
          >
            {nodeDatum.name}
          </text>

          {/* Dates */}
          {nodeDatum.attributes?.born && (
            <text
              x={hasSpouse ? cardX + 60 : 0}
              y={-3}
              fill="#a1a1aa"
              fontSize={9}
              textAnchor={hasSpouse ? "start" : "middle"}
            >
              {nodeDatum.attributes.born}
              {nodeDatum.attributes.died ? ` – ${nodeDatum.attributes.died}` : ""}
            </text>
          )}

          {/* Spouse section */}
          {hasSpouse && (
            <>
              {/* Heart / connector */}
              <text
                x={cardX + 35}
                y={28}
                fill="#f59e0b"
                fontSize={10}
                textAnchor="middle"
              >
                ♥
              </text>

              {/* Spouse name */}
              <text
                x={cardX + 50}
                y={30}
                fill="#78716c"
                fontSize={10}
                fontWeight="600"
                textAnchor="start"
              >
                {nodeDatum.attributes?.spouse}
              </text>
            </>
          )}

          {/* Generation badge */}
          {nodeDatum.attributes?.generation && (
            <rect
              x={cardX + cardWidth - 28}
              y={-33}
              width={24}
              height={16}
              rx={8}
              fill="#fef3c7"
              stroke="#f59e0b"
              strokeWidth={1}
            />
          )}
          {nodeDatum.attributes?.generation && (
            <text
              x={cardX + cardWidth - 16}
              y={-21}
              fill="#92400e"
              fontSize={8}
              fontWeight="bold"
              textAnchor="middle"
            >
              G{nodeDatum.attributes.generation}
            </text>
          )}

          {/* Clickable overlay */}
          {nodeDatum._id && (
            <a href={`/persons/${nodeDatum._id}`}>
              <rect
                x={cardX}
                y={-35}
                width={cardWidth}
                height={hasSpouse ? 75 : 65}
                fill="transparent"
                style={{ cursor: "pointer" }}
              />
            </a>
          )}
        </g>
      );
    },
    []
  );

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

  const data: TreeNode =
    treeData.length === 1
      ? treeData[0]
      : { name: "Family", children: treeData, attributes: {} };

  return (
    <div>
      <h1 className="text-2xl font-bold text-amber-900 mb-2">Family Tree</h1>
      <p className="text-sm text-gray-500 mb-4">
        Drag to pan, scroll to zoom, click nodes to expand/collapse. Click a name to view profile.
      </p>
      <div
        ref={containerRef}
        className="bg-gradient-to-b from-amber-50 to-white rounded-lg shadow-md border border-amber-200"
        style={{ width: "100%", height: "75vh" }}
      >
        <svg style={{ position: "absolute", width: 0, height: 0 }}>
          <defs>
            <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#00000015" />
            </filter>
          </defs>
        </svg>
        <Tree
          data={data}
          translate={translate}
          orientation="vertical"
          pathFunc="step"
          collapsible={true}
          separation={{ siblings: 1.8, nonSiblings: 2.2 }}
          nodeSize={{ x: 280, y: 130 }}
          renderCustomNodeElement={(rd3tProps) =>
            renderCustomNode(rd3tProps as { nodeDatum: TreeNode })
          }
          pathClassFunc={() => "stroke-amber-400"}
          zoom={0.85}
        />
      </div>
    </div>
  );
}
