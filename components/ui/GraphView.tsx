"use client";

import { useEffect, useRef, useState } from "react";

interface GraphNode {
  id: string;
  label: string;
  type: "deck" | "card" | "tag";
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface GraphEdge {
  from: string;
  to: string;
}

interface GraphViewProps {
  decks: { id: string; name: string; color: string }[];
  cards: { id: string; front: string; deck_id: string; tags: string[] }[];
}

export default function GraphView({ decks, cards }: GraphViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const animRef = useRef<number>(0);
  const dragRef = useRef<{ node: GraphNode; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W * 2;
    canvas.height = H * 2;
    ctx.scale(2, 2);

    const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "").slice(0, 20);

    // Build nodes
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const tagSet = new Set<string>();

    // Deck nodes (larger)
    for (const d of decks) {
      nodes.push({
        id: `deck-${d.id}`,
        label: d.name,
        type: "deck",
        color: d.color,
        x: Math.random() * W,
        y: Math.random() * H,
        vx: 0, vy: 0,
        radius: 12,
      });
    }

    // Card nodes (small)
    for (const c of cards) {
      nodes.push({
        id: `card-${c.id}`,
        label: stripHtml(c.front),
        type: "card",
        color: "#f5f0e8",
        x: Math.random() * W,
        y: Math.random() * H,
        vx: 0, vy: 0,
        radius: 4,
      });
      edges.push({ from: `deck-${c.deck_id}`, to: `card-${c.id}` });

      for (const t of (c.tags ?? [])) {
        if (!tagSet.has(t)) {
          tagSet.add(t);
          nodes.push({
            id: `tag-${t}`,
            label: t,
            type: "tag",
            color: "#c9a552",
            x: Math.random() * W,
            y: Math.random() * H,
            vx: 0, vy: 0,
            radius: 8,
          });
        }
        edges.push({ from: `card-${c.id}`, to: `tag-${t}` });
      }
    }

    nodesRef.current = nodes;
    edgesRef.current = edges;

    // Force simulation
    function simulate() {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;

      // Repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 200 / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          nodes[i].vx -= fx;
          nodes[i].vy -= fy;
          nodes[j].vx += fx;
          nodes[j].vy += fy;
        }
      }

      // Attraction (edges)
      for (const e of edges) {
        const a = nodes.find((n) => n.id === e.from);
        const b = nodes.find((n) => n.id === e.to);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 60) * 0.005;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }

      // Center gravity
      for (const n of nodes) {
        n.vx += (W / 2 - n.x) * 0.001;
        n.vy += (H / 2 - n.y) * 0.001;
      }

      // Apply velocity
      for (const n of nodes) {
        if (dragRef.current?.node.id === n.id) continue;
        n.vx *= 0.85;
        n.vy *= 0.85;
        n.x += n.vx;
        n.y += n.vy;
        n.x = Math.max(20, Math.min(W - 20, n.x));
        n.y = Math.max(20, Math.min(H - 20, n.y));
      }
    }

    function draw() {
      ctx!.clearRect(0, 0, W, H);
      const nodes = nodesRef.current;
      const edges = edgesRef.current;

      // Edges
      for (const e of edges) {
        const a = nodes.find((n) => n.id === e.from);
        const b = nodes.find((n) => n.id === e.to);
        if (!a || !b) continue;
        ctx!.beginPath();
        ctx!.moveTo(a.x, a.y);
        ctx!.lineTo(b.x, b.y);
        ctx!.strokeStyle = "rgba(201, 165, 82, 0.08)";
        ctx!.lineWidth = 0.5;
        ctx!.stroke();
      }

      // Nodes
      for (const n of nodes) {
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.radius, 0, Math.PI * 2);

        if (n.type === "deck") {
          ctx!.fillStyle = n.color;
          ctx!.shadowColor = n.color;
          ctx!.shadowBlur = 8;
        } else if (n.type === "tag") {
          ctx!.fillStyle = "#c9a552aa";
          ctx!.shadowColor = "#c9a552";
          ctx!.shadowBlur = 4;
        } else {
          ctx!.fillStyle = "rgba(245, 240, 232, 0.3)";
          ctx!.shadowBlur = 0;
        }
        ctx!.fill();
        ctx!.shadowBlur = 0;

        // Label for deck and tag nodes
        if (n.type !== "card") {
          ctx!.font = `${n.type === "deck" ? "bold 10px" : "9px"} sans-serif`;
          ctx!.fillStyle = n.type === "deck" ? "#f5f0e8" : "#c9a552";
          ctx!.textAlign = "center";
          ctx!.fillText(n.label, n.x, n.y + n.radius + 12);
        }
      }

      // Hovered label
      if (hoveredNode && hoveredNode.type === "card") {
        ctx!.font = "10px sans-serif";
        ctx!.fillStyle = "#f5f0e8";
        ctx!.textAlign = "center";
        ctx!.fillText(hoveredNode.label, hoveredNode.x, hoveredNode.y - 10);
      }
    }

    function tick() {
      simulate();
      draw();
      animRef.current = requestAnimationFrame(tick);
    }
    tick();

    // Mouse interaction
    function getNodeAt(mx: number, my: number): GraphNode | null {
      const rect = canvas!.getBoundingClientRect();
      const x = mx - rect.left;
      const y = my - rect.top;
      for (const n of [...nodesRef.current].reverse()) {
        const dx = n.x - x;
        const dy = n.y - y;
        if (dx * dx + dy * dy < (n.radius + 4) * (n.radius + 4)) return n;
      }
      return null;
    }

    function onMouseMove(e: MouseEvent) {
      const node = getNodeAt(e.clientX, e.clientY);
      setHoveredNode(node);
      canvas!.style.cursor = node ? "grab" : "default";

      if (dragRef.current) {
        const rect = canvas!.getBoundingClientRect();
        dragRef.current.node.x = e.clientX - rect.left;
        dragRef.current.node.y = e.clientY - rect.top;
        dragRef.current.node.vx = 0;
        dragRef.current.node.vy = 0;
      }
    }

    function onMouseDown(e: MouseEvent) {
      const node = getNodeAt(e.clientX, e.clientY);
      if (node) {
        dragRef.current = { node, offsetX: 0, offsetY: 0 };
        canvas!.style.cursor = "grabbing";
      }
    }

    function onMouseUp() {
      dragRef.current = null;
    }

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseup", onMouseUp);

    return () => {
      cancelAnimationFrame(animRef.current);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mouseup", onMouseUp);
    };
  }, [decks, cards]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="w-full h-[400px] rounded-xl bg-[var(--navy)]"
      />
      <div className="absolute top-3 right-3 flex gap-3 text-[10px] text-[var(--slate)]">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[var(--gold)]" />Decks</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#c9a552aa]" />Tags</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[rgba(245,240,232,0.3)]" />Cartes</span>
      </div>
    </div>
  );
}
