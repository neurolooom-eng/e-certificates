"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { FieldConfig } from "@/lib/types";

type Drag =
  | { mode: "draw"; startX: number; startY: number; curX: number; curY: number }
  | { mode: "move"; id: string; offX: number; offY: number }
  | { mode: "resize"; id: string; anchorX: number; anchorY: number };

interface Props {
  imageUrl: string;
  fields: FieldConfig[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (fields: FieldConfig[]) => void;
  onCreate: (box: { centerX: number; topY: number; maxWidth: number; boxHeight: number }) => void;
}

export default function TemplateDesigner({
  imageUrl,
  fields,
  selectedId,
  onSelect,
  onChange,
  onCreate,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [displayW, setDisplayW] = useState(0);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [gridStep, setGridStep] = useState(100);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  // Scale factor: template px → screen px
  const scale = natural.w > 0 && displayW > 0 ? displayW / natural.w : 1;

  const measure = useCallback(() => {
    if (wrapRef.current) setDisplayW(wrapRef.current.clientWidth);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  // Convert a mouse event to template-pixel coordinates
  function toTemplateCoords(e: { clientX: number; clientY: number }) {
    const rect = imgRef.current!.getBoundingClientRect();
    return {
      x: Math.round((e.clientX - rect.left) / scale),
      y: Math.round((e.clientY - rect.top) / scale),
    };
  }

  // A field's box in template px (centerX/topY → left/top)
  function boxOf(f: FieldConfig) {
    return {
      left: f.centerX - f.maxWidth / 2,
      top: f.topY,
      width: f.maxWidth,
      height: f.boxHeight ?? Math.round(f.fontSize * 1.4),
    };
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    const { x, y } = toTemplateCoords(e);
    setDrag({ mode: "draw", startX: x, startY: y, curX: x, curY: y });
    onSelect(null);
  }

  function handleMouseMove(e: React.MouseEvent) {
    const { x, y } = toTemplateCoords(e);
    setCursor({ x, y });
    if (!drag) return;

    if (drag.mode === "draw") {
      setDrag({ ...drag, curX: x, curY: y });
    } else if (drag.mode === "move") {
      onChange(
        fields.map((f) =>
          f.id === drag.id
            ? { ...f, centerX: x - drag.offX + f.maxWidth / 2, topY: y - drag.offY }
            : f
        )
      );
    } else if (drag.mode === "resize") {
      const width = Math.max(20, x - drag.anchorX);
      const height = Math.max(12, y - drag.anchorY);
      onChange(
        fields.map((f) =>
          f.id === drag.id
            ? {
                ...f,
                maxWidth: Math.round(width),
                boxHeight: Math.round(height),
                centerX: Math.round(drag.anchorX + width / 2),
                topY: drag.anchorY,
                fontSize: Math.max(10, Math.round(height * 0.65)),
              }
            : f
        )
      );
    }
  }

  function handleMouseUp() {
    if (drag?.mode === "draw") {
      const left = Math.min(drag.startX, drag.curX);
      const top = Math.min(drag.startY, drag.curY);
      const width = Math.abs(drag.curX - drag.startX);
      const height = Math.abs(drag.curY - drag.startY);
      // Ignore accidental clicks
      if (width > 15 && height > 8) {
        onCreate({
          centerX: Math.round(left + width / 2),
          topY: Math.round(top),
          maxWidth: Math.round(width),
          boxHeight: Math.round(height),
        });
      }
    }
    setDrag(null);
  }

  // Grid lines in template px
  const gridLines: { pos: number; vertical: boolean }[] = [];
  if (showGrid && natural.w > 0) {
    for (let x = gridStep; x < natural.w; x += gridStep) gridLines.push({ pos: x, vertical: true });
    for (let y = gridStep; y < natural.h; y += gridStep) gridLines.push({ pos: y, vertical: false });
  }

  const previewBox =
    drag?.mode === "draw"
      ? {
          left: Math.min(drag.startX, drag.curX),
          top: Math.min(drag.startY, drag.curY),
          width: Math.abs(drag.curX - drag.startX),
          height: Math.abs(drag.curY - drag.startY),
        }
      : null;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-4 mb-3 text-sm">
        <label className="flex items-center gap-2 text-gray-700">
          <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
          Show grid
        </label>
        <label className="flex items-center gap-2 text-gray-700">
          Grid step
          <select
            value={gridStep}
            onChange={(e) => setGridStep(Number(e.target.value))}
            className="border rounded px-2 py-1 text-sm"
          >
            {[25, 50, 100, 200].map((s) => (
              <option key={s} value={s}>{s} px</option>
            ))}
          </select>
        </label>
        <span className="text-gray-400">
          Template: {natural.w} × {natural.h} px
        </span>
        {cursor && (
          <span className="ml-auto font-mono text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">
            x: {cursor.x}, y: {cursor.y}
          </span>
        )}
      </div>

      <p className="text-xs text-gray-500 mb-2">
        <strong>Drag on the certificate</strong> to draw a box where text should go — the box's pixel
        position becomes the field's placement. Click a box to select it, drag to move, or drag its
        bottom-right corner to resize.
      </p>

      {/* Canvas */}
      <div
        ref={wrapRef}
        className="relative border border-gray-200 rounded-lg overflow-hidden select-none bg-gray-50"
        style={{ cursor: drag?.mode === "draw" ? "crosshair" : "default" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setDrag(null); setCursor(null); }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Certificate template"
          className="w-full block pointer-events-none"
          draggable={false}
          onLoad={(e) => {
            const el = e.currentTarget;
            setNatural({ w: el.naturalWidth, h: el.naturalHeight });
            measure();
          }}
        />

        {/* Grid */}
        {gridLines.map((l, i) => (
          <div
            key={i}
            className="absolute pointer-events-none"
            style={
              l.vertical
                ? { left: l.pos * scale, top: 0, bottom: 0, width: 1, background: "rgba(59,130,246,0.25)" }
                : { top: l.pos * scale, left: 0, right: 0, height: 1, background: "rgba(59,130,246,0.25)" }
            }
          />
        ))}
        {showGrid &&
          gridLines
            .filter((l) => l.pos % (gridStep * 2) === 0)
            .map((l, i) => (
              <span
                key={`lbl-${i}`}
                className="absolute pointer-events-none text-[9px] font-mono text-blue-500 bg-white/70 px-0.5 rounded"
                style={
                  l.vertical
                    ? { left: l.pos * scale + 2, top: 2 }
                    : { top: l.pos * scale + 2, left: 2 }
                }
              >
                {l.pos}
              </span>
            ))}

        {/* Existing field boxes */}
        {fields.map((f) => {
          const b = boxOf(f);
          const isSel = f.id === selectedId;
          return (
            <div
              key={f.id}
              className={`absolute group ${isSel ? "z-20" : "z-10"}`}
              style={{
                left: b.left * scale,
                top: b.top * scale,
                width: b.width * scale,
                height: b.height * scale,
                border: `2px solid ${isSel ? "#8B1E1E" : "rgba(139,30,30,0.5)"}`,
                background: isSel ? "rgba(139,30,30,0.12)" : "rgba(139,30,30,0.06)",
                cursor: "move",
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                onSelect(f.id);
                const { x, y } = toTemplateCoords(e);
                setDrag({ mode: "move", id: f.id, offX: x - b.left, offY: y - b.top });
              }}
            >
              <span
                className={`absolute -top-5 left-0 text-[10px] font-medium px-1 rounded whitespace-nowrap ${
                  isSel ? "bg-brand-500 text-white" : "bg-white/90 text-gray-600 border border-gray-200"
                }`}
              >
                {f.format === "tick" ? "✓ " : ""}
                {f.label}
              </span>
              {/* Resize handle */}
              <div
                className="absolute -right-1.5 -bottom-1.5 w-3 h-3 bg-white border-2 border-brand-500 rounded-sm"
                style={{ cursor: "nwse-resize" }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onSelect(f.id);
                  setDrag({ mode: "resize", id: f.id, anchorX: b.left, anchorY: b.top });
                }}
              />
            </div>
          );
        })}

        {/* Box being drawn */}
        {previewBox && (
          <div
            className="absolute border-2 border-dashed border-brand-500 bg-brand-500/10 pointer-events-none z-30"
            style={{
              left: previewBox.left * scale,
              top: previewBox.top * scale,
              width: previewBox.width * scale,
              height: previewBox.height * scale,
            }}
          >
            <span className="absolute -bottom-5 left-0 text-[10px] font-mono bg-brand-500 text-white px-1 rounded whitespace-nowrap">
              {previewBox.width} × {previewBox.height} px
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
