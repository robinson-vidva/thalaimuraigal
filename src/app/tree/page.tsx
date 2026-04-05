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
      const fillColor =
        gender === "M" ? "#92400e" : gender === "F" ? "#b45309" : "#78716c";

      return (
        <g>
          <circle r={20} fill={fillColor} stroke="#fbbf24" strokeWidth={2} />
          <text
            fill="white"
            fontSize={12}
            fontWeight="bold"
            textAnchor="middle"
            dy={4}
          >
            {nodeDatum.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)}
          </text>
          <text
            fill="#1c1917"
            fontSize={12}
            fontWeight="600"
            textAnchor="middle"
            dy={-30}
          >
            {nodeDatum.name}
          </text>
          {nodeDatum.attributes?.spouse && (
            <text
              fill="#78716c"
              fontSize={10}
              textAnchor="middle"
              dy={42}
            >
              &amp; {nodeDatum.attributes.spouse}
            </text>
          )}
          {nodeDatum.attributes?.born && (
            <text
              fill="#a1a1aa"
              fontSize={9}
              textAnchor="middle"
              dy={55}
            >
              {nodeDatum.attributes.born}
              {nodeDatum.attributes.died
                ? ` - ${nodeDatum.attributes.died}`
                : ""}
            </text>
          )}
          {nodeDatum._id && (
            <a href={`/persons/${nodeDatum._id}`}>
              <rect
                x={-15}
                y={-20}
                width={30}
                height={40}
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

  // If multiple roots, wrap in a single root
  const data: TreeNode =
    treeData.length === 1
      ? treeData[0]
      : { name: "Family", children: treeData, attributes: {} };

  return (
    <div>
      <h1 className="text-2xl font-bold text-amber-900 mb-4">Family Tree</h1>
      <p className="text-sm text-gray-500 mb-4">
        Click and drag to pan. Scroll to zoom. Click a node to expand/collapse.
      </p>
      <div
        ref={containerRef}
        className="bg-white rounded-lg shadow-md border border-amber-100"
        style={{ width: "100%", height: "70vh" }}
      >
        <Tree
          data={data}
          translate={translate}
          orientation="vertical"
          pathFunc="step"
          collapsible={true}
          separation={{ siblings: 2, nonSiblings: 2.5 }}
          nodeSize={{ x: 200, y: 120 }}
          renderCustomNodeElement={(rd3tProps) =>
            renderCustomNode(rd3tProps as { nodeDatum: TreeNode })
          }
          pathClassFunc={() => "stroke-amber-300"}
        />
      </div>
    </div>
  );
}
