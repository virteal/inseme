import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

// Simple Spring/Force simulation constants
const CENTER_X = 400;
const CENTER_Y = 300;
const RADIUS = 200;

export default function FractalGraph({ feeds = [] }) {
  const [nodes, setNodes] = useState([]);
  const [instanceName, setInstanceName] = useState("Corte");

  useEffect(() => {
    // 1. Define Nodes
    // Center Node (Us)
    const centerNode = { id: "root", label: instanceName, type: "self", x: CENTER_X, y: CENTER_Y };

    // Satellite Nodes (Feeds)
    const satellites = feeds.map((feed, index) => {
      const angle = (index / feeds.length) * 2 * Math.PI - Math.PI / 2; // Start from top
      return {
        id: feed.id,
        label: feed.title
          .replace("Export Fédéré", "")
          .replace("Flux Externe", "")
          .replace(/[()]/g, "")
          .trim(),
        type: feed.category === "local-export" ? "export" : "import",
        feedType: feed.title.toLowerCase().includes("wiki")
          ? "wiki"
          : feed.title.toLowerCase().includes("prop")
            ? "proposition"
            : "post",
        x: CENTER_X + RADIUS * Math.cos(angle),
        y: CENTER_Y + RADIUS * Math.sin(angle),
        url: feed.url,
      };
    });

    setNodes([centerNode, ...satellites]);
  }, [feeds, instanceName]);

  return (
    <div className="w-full bg-gray-900 rounded-xl overflow-hidden shadow-2xl relative border border-gray-700">
      <div className="absolute top-4 left-4 z-10">
        <h3 className="text-white font-bold text-lg">Cartographie Fractale</h3>
        <p className="text-gray-400 text-xs">Visualisation des flux de données</p>
      </div>

      <svg viewBox="0 0 800 600" className="w-full h-auto max-h-[600px] pointer-events-auto">
        <defs>
          {/* Gradients */}
          <radialGradient id="grad-center" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="1" />
            <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0.8" />
          </radialGradient>
          <radialGradient id="grad-wiki" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="1" />
            <stop offset="100%" stopColor="#5b21b6" stopOpacity="0.8" />
          </radialGradient>
          <radialGradient id="grad-prop" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#10b981" stopOpacity="1" />
            <stop offset="100%" stopColor="#065f46" stopOpacity="0.8" />
          </radialGradient>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="28"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
          </marker>
        </defs>

        {/* Links */}
        {nodes
          .filter((n) => n.id !== "root")
          .map((node) => (
            <g key={`link-${node.id}`}>
              {/* Line */}
              <line
                x1={CENTER_X}
                y1={CENTER_Y}
                x2={node.x}
                y2={node.y}
                stroke="#475569"
                strokeWidth="2"
                strokeDasharray="5,5"
              />

              {/* Flow Particle Animation */}
              {/* Direction depends on Export vs Import */}
              <circle r="4" fill={node.type === "export" ? "#60a5fa" : "#34d399"}>
                <animateMotion
                  dur="3s"
                  repeatCount="indefinite"
                  path={`M${node.type === "export" ? CENTER_X : node.x},${node.type === "export" ? CENTER_Y : node.y} L${node.type === "export" ? node.x : CENTER_X},${node.type === "export" ? node.y : CENTER_Y}`}
                />
              </circle>
            </g>
          ))}

        {/* Nodes */}
        {nodes.map((node) => (
          <g key={node.id} className="cursor-pointer hover:opacity-80 transition-opacity">
            <circle
              cx={node.x}
              cy={node.y}
              r={node.id === "root" ? 40 : 25}
              fill={
                node.id === "root"
                  ? "url(#grad-center)"
                  : node.feedType === "wiki"
                    ? "url(#grad-wiki)"
                    : node.feedType === "proposition"
                      ? "url(#grad-prop)"
                      : "#64748b"
              }
              stroke="#ffffff"
              strokeWidth="2"
              filter="drop-shadow(0 0 10px rgba(59, 130, 246, 0.5))"
            />
            {/* Icon/Text inside */}
            <text
              x={node.x}
              y={node.y + 5}
              textAnchor="middle"
              fill="white"
              fontSize={node.id === "root" ? "24" : "16"}
              pointerEvents="none"
            >
              {node.id === "root"
                ? "🏠"
                : node.feedType === "wiki"
                  ? "📚"
                  : node.feedType === "proposition"
                    ? "🗳️"
                    : "📢"}
            </text>

            {/* Label */}
            <text
              x={node.x}
              y={node.y + (node.id === "root" ? 60 : 45)}
              textAnchor="middle"
              fill="#e2e8f0"
              fontSize="12"
              fontWeight="bold"
              className="select-none"
              style={{ textShadow: "0 1px 2px black" }}
            >
              {node.label}
            </text>
            <text
              x={node.x}
              y={node.y + (node.id === "root" ? 75 : 60)}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize="10"
              className="select-none"
            >
              {node.type === "export"
                ? "↗ Export"
                : node.id === "root"
                  ? "Instance Locale"
                  : "↙ Import"}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
