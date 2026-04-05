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
      setTranslate({ x: width / 2, y: 80 });
    }
  }, [loading]);

  const renderCustomNode = useCallback(
    ({ nodeDatum }: { nodeDatum: TreeNode }) => {
      const gender = nodeDatum.attributes?.gender;
      const hasSpouse = !!nodeDatum.attributes?.spouse;

      // Colors
      const accentColor = gender === "M" ? "#b45309" : gender === "F" ? "#d97706" : "#78716c";
      const bgGradient = gender === "M" ? "#fef3c7" : gender === "F" ? "#fff7ed" : "#f5f5f4";

      const cardWidth = hasSpouse ? 220 : 150;
      const cardHeight = hasSpouse ? 70 : 55;
      const cardX = -cardWidth / 2;
      const cardY = -cardHeight / 2;

      const initials = nodeDatum.name.split(" ").map((n) => n[0]).join("").slice(0, 2);

      return (
        <g>
          {/* Shadow */}
          <rect
            x={cardX + 2}
            y={cardY + 3}
            width={cardWidth}
            height={cardHeight}
            rx={12}
            fill="rgba(0,0,0,0.06)"
          />

          {/* Card */}
          <rect
            x={cardX}
            y={cardY}
            width={cardWidth}
            height={cardHeight}
            rx={12}
            fill={bgGradient}
            stroke={accentColor}
            strokeWidth={1.5}
          />

          {/* Left accent bar */}
          <rect
            x={cardX}
            y={cardY}
            width={5}
            height={cardHeight}
            rx={2}
            fill={accentColor}
          />

          {/* Avatar circle */}
          <circle
            cx={cardX + 28}
            cy={0}
            r={15}
            fill={accentColor}
          />
          <text
            x={cardX + 28}
            y={4}
            fill="white"
            fontSize={10}
            fontWeight="bold"
            textAnchor="middle"
          >
            {initials}
          </text>

          {/* Name */}
          <text
            x={cardX + 50}
            y={hasSpouse ? -10 : -3}
            fill="#292524"
            fontSize={11}
            fontWeight="700"
          >
            {nodeDatum.name}
          </text>

          {/* Dates below name */}
          {nodeDatum.attributes?.born && (
            <text
              x={cardX + 50}
              y={hasSpouse ? 3 : 10}
              fill="#78716c"
              fontSize={9}
            >
              {nodeDatum.attributes.born}
              {nodeDatum.attributes.died ? ` – ${nodeDatum.attributes.died}` : ""}
            </text>
          )}

          {/* Spouse section */}
          {hasSpouse && (
            <>
              {/* Divider line */}
              <line
                x1={cardX + 15}
                y1={14}
                x2={cardX + cardWidth - 15}
                y2={14}
                stroke={accentColor}
                strokeWidth={0.5}
                strokeOpacity={0.3}
              />
              {/* Heart + spouse name */}
              <text
                x={cardX + 18}
                y={28}
                fill={accentColor}
                fontSize={9}
              >
                ♥
              </text>
              <text
                x={cardX + 30}
                y={28}
                fill="#78716c"
                fontSize={10}
                fontWeight="500"
              >
                {nodeDatum.attributes?.spouse}
              </text>
            </>
          )}

          {/* Generation badge */}
          {nodeDatum.attributes?.generation && (
            <>
              <circle
                cx={cardX + cardWidth - 12}
                cy={cardY + 12}
                r={9}
                fill={accentColor}
              />
              <text
                x={cardX + cardWidth - 12}
                y={cardY + 15}
                fill="white"
                fontSize={7}
                fontWeight="bold"
                textAnchor="middle"
              >
                G{nodeDatum.attributes.generation}
              </text>
            </>
          )}

          {/* Clickable overlay */}
          {nodeDatum._id && (
            <a href={`/persons/${nodeDatum._id}`}>
              <rect
                x={cardX}
                y={cardY}
                width={cardWidth}
                height={cardHeight}
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
        Drag to pan, scroll to zoom. Click a card to view profile.
      </p>
      <div
        ref={containerRef}
        className="rounded-xl shadow-lg border border-amber-100 overflow-hidden"
        style={{
          width: "100%",
          height: "75vh",
          background: "linear-gradient(180deg, #fffbeb 0%, #ffffff 40%, #fefce8 100%)",
        }}
      >
        <Tree
          data={data}
          translate={translate}
          orientation="vertical"
          pathFunc="step"
          collapsible={true}
          separation={{ siblings: 1.5, nonSiblings: 2 }}
          nodeSize={{ x: 260, y: 110 }}
          renderCustomNodeElement={(rd3tProps) =>
            renderCustomNode(rd3tProps as { nodeDatum: TreeNode })
          }
          pathClassFunc={() => "!stroke-amber-300"}
          zoom={0.9}
        />
      </div>
    </div>
  );
}
