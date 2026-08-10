"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import type { FieldConfig, TournamentConfig } from "@/lib/types";

const DEFAULT_FIELDS: FieldConfig[] = [
  { id: "name",  label: "Recipient Name", columnIndex: 4,  centerX: 795,  topY: 608, maxWidth: 470, fontSize: 28, format: "text" },
  { id: "org",   label: "Club / City",    columnIndex: 9,  centerX: 1285, topY: 608, maxWidth: 420, fontSize: 28, format: "text" },
  { id: "pts",   label: "Points Scored",  columnIndex: 10, centerX: 648,  topY: 860, maxWidth: 80,  fontSize: 26, format: "number" },
  { id: "place", label: "Place / Rank",   columnIndex: 0,  centerX: 1142, topY: 860, maxWidth: 120, fontSize: 26, format: "ordinal" },
];

function FieldEditor({
  field,
  index,
  columns,
  onChange,
  onRemove,
}: {
  field: FieldConfig;
  index: number;
  columns: string[];
  onChange: (f: FieldConfig) => void;
  onRemove: () => void;
}) {
  const set = (k: keyof FieldConfig, v: string | number) =>
    onChange({ ...field, [k]: v });

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <span className="font-medium text-sm text-gray-700">Field {index + 1}</span>
        <button onClick={onRemove} className="text-red-400 hover:text-red-600 text-sm">Remove</button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Label</label>
          <input
            className="w-full border rounded px-2 py-1.5 text-sm"
            value={field.label}
            onChange={(e) => set("label", e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Spreadsheet Column</label>
          {columns.length > 0 ? (
            <select
              className="w-full border rounded px-2 py-1.5 text-sm"
              value={field.columnIndex}
              onChange={(e) => set("columnIndex", Number(e.target.value))}
            >
              {columns.map((c, i) => (
                <option key={i} value={i}>{i}: {c}</option>
              ))}
            </select>
          ) : (
            <input
              type="number"
              className="w-full border rounded px-2 py-1.5 text-sm"
              value={field.columnIndex}
              onChange={(e) => set("columnIndex", Number(e.target.value))}
              placeholder="Column index (0-based)"
            />
          )}
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Format</label>
          <select
            className="w-full border rounded px-2 py-1.5 text-sm"
            value={field.format}
            onChange={(e) => set("format", e.target.value as FieldConfig["format"])}
          >
            <option value="text">Text</option>
            <option value="number">Number (strip .0)</option>
            <option value="ordinal">Ordinal (1st, 2nd…)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Font Size (px)</label>
          <input
            type="number"
            className="w-full border rounded px-2 py-1.5 text-sm"
            value={field.fontSize}
            onChange={(e) => set("fontSize", Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Center X (px)</label>
          <input
            type="number"
            className="w-full border rounded px-2 py-1.5 text-sm"
            value={field.centerX}
            onChange={(e) => set("centerX", Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Top Y (px)</label>
          <input
            type="number"
            className="w-full border rounded px-2 py-1.5 text-sm"
            value={field.topY}
            onChange={(e) => set("topY", Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Max Width (px)</label>
          <input
            type="number"
            className="w-full border rounded px-2 py-1.5 text-sm"
            value={field.maxWidth}
            onChange={(e) => set("maxWidth", Number(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
}

interface CategoryEntry {
  id: string;
  name: string;
  file: File | null;
}

type EventType = "open" | "open_category" | "category";

export default function NewTournamentPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventType, setEventType] = useState<EventType>("open");
  const [detecting, setDetecting] = useState(false);
  const [detectMsg, setDetectMsg] = useState("");
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateSizeKb, setTemplateSizeKb] = useState<number | null>(null);
  const [categories, setCategories] = useState<CategoryEntry[]>([
    { id: `cat_${Date.now()}`, name: "", file: null },
  ]);
  const [headerRowIndex, setHeaderRowIndex] = useState(0);
  const [textColor, setTextColor] = useState("#8B1E1E");
  const [fields, setFields] = useState<FieldConfig[]>(DEFAULT_FIELDS);
  const [columns, setColumns] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState("");
  const [error, setError] = useState("");
  const templateRef = useRef<HTMLInputElement>(null);

  // Compress + resize template image client-side to stay under Vercel's 4.5MB body limit
  function compressImage(file: File): Promise<File> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 1600;
        let { width, height } = img;
        if (width > MAX) { height = Math.round((height * MAX) / width); width = MAX; }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => resolve(blob ? new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }) : file),
          "image/jpeg",
          0.88
        );
      };
      img.onerror = () => resolve(file); // fallback: use original
      img.src = url;
    });
  }

  async function handleAutoDetect() {
    if (!templateFile || columns.length === 0) {
      setDetectMsg("Upload the template and at least one Excel file first.");
      return;
    }
    setDetecting(true);
    setDetectMsg("Analyzing certificate template…");
    try {
      const buf = await templateFile.arrayBuffer();
      const base64 = btoa(new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), ""));
      const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(templateFile);
        img.onload = () => { URL.revokeObjectURL(url); resolve({ w: img.width, h: img.height }); };
        img.onerror = reject;
        img.src = url;
      });
      const res = await fetch("/api/detect-placement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          mediaType: templateFile.type || "image/jpeg",
          columns,
          width: dims.w,
          height: dims.h,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDetectMsg(data.error || "Auto-detection failed.");
      } else {
        setFields(
          data.fields.map((f: Omit<FieldConfig, "id">, i: number) => ({ ...f, id: `detected_${i}` }))
        );
        if (data.textColor) setTextColor(data.textColor);
        setDetectMsg(`✓ Detected ${data.fields.length} fields. Review below and preview before generating.`);
      }
    } catch (err: unknown) {
      setDetectMsg(`Auto-detection failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    setDetecting(false);
  }

  function handleCategoryFile(catId: string, file: File) {
    setCategories((prev) => prev.map((c) => (c.id === catId ? { ...c, file } : c)));
    // Read columns from the first uploaded file for the field editors
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target?.result, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][];
      const headerRow = rows[headerRowIndex] || rows[0] || [];
      setColumns(headerRow.map(String));
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validCategories = categories
      .map((c) => (eventType === "open" ? { ...c, name: c.name.trim() || "Open" } : c))
      .filter((c) => c.file && c.name.trim());
    if (!templateFile || validCategories.length === 0) {
      setError("Please upload the certificate template and at least one category with a name and Excel file.");
      return;
    }
    setSubmitting(true);
    setError("");
    setSubmitStep("Preparing files…");

    const config: TournamentConfig = { headerRowIndex, textColor, fields };
    const fd = new FormData();
    fd.append("name", name);
    fd.append("eventDate", eventDate);
    fd.append("eventType", eventType);
    fd.append("template", templateFile);
    fd.append("categories", JSON.stringify(validCategories.map((c) => ({ name: c.name.trim() }))));
    validCategories.forEach((c, i) => fd.append(`categoryData_${i}`, c.file!));
    fd.append("config", JSON.stringify(config));

    // Cycle through status messages so the user knows it's working
    const steps = [
      "Uploading certificate template…",
      "Uploading participant list…",
      "Saving to Google Drive…",
      "Almost done…",
    ];
    let stepIdx = 0;
    const stepTimer = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, steps.length - 1);
      setSubmitStep(steps[stepIdx]);
    }, 4000);

    try {
      const res = await fetch("/api/tournaments", { method: "POST", body: fd });
      clearInterval(stepTimer);
      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Failed to create tournament.");
        setSubmitting(false);
        setSubmitStep("");
        return;
      }
      const created = await res.json();
      router.push(`/tournaments/${created.id}`);
    } catch (err: unknown) {
      clearInterval(stepTimer);
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Request failed: ${msg}. Check your Vercel environment variables (GOOGLE_SERVICE_ACCOUNT_JSON).`);
      setSubmitting(false);
      setSubmitStep("");
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <a href="/tournaments" className="text-sm text-gray-500 hover:text-gray-700">← Back to tournaments</a>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Create New Tournament</h1>
        <p className="text-gray-500 text-sm mt-1">Upload a certificate template and participant list to get started.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Tournament Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Tournament Name *</label>
              <input
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="e.g. City Chess Open 2025"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Type *</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={eventType}
                onChange={(e) => {
                  const t = e.target.value as EventType;
                  setEventType(t);
                  if (t === "open") {
                    setCategories((prev) => [{ ...(prev[0] ?? { id: `cat_${Date.now()}`, file: null }), name: "Open" }]);
                  }
                }}
              >
                <option value="open">Open (single list)</option>
                <option value="open_category">Open + Category (multiple lists)</option>
                <option value="category">Category (multiple lists)</option>
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Date</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* File Uploads */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Upload Files</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Certificate Template *</label>
              <p className="text-xs text-gray-400 mb-2">JPG or PNG with signature blanks</p>
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-brand-500 transition-colors"
                onClick={() => templateRef.current?.click()}
              >
                {templateFile ? (
                  <div>
                    <p className="text-sm text-green-600">✓ {templateFile.name}</p>
                    {templateSizeKb && <p className="text-xs text-gray-400 mt-0.5">{templateSizeKb} KB (compressed)</p>}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Click to upload template image</p>
                )}
              </div>
              <input
                ref={templateRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const compressed = await compressImage(f);
                  setTemplateFile(compressed);
                  setTemplateSizeKb(Math.round(compressed.size / 1024));
                }}
              />
            </div>
          </div>

          {/* Categories */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                {eventType === "open" ? "Participant List *" : "Categories *"}
              </label>
              {eventType !== "open" && (
                <button
                  type="button"
                  onClick={() => setCategories([...categories, { id: `cat_${Date.now()}`, name: "", file: null }])}
                  className="text-sm text-brand-500 hover:text-brand-600 font-medium"
                >
                  + Add Category
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 mb-3">
              {eventType === "open"
                ? "One participant Excel (.xlsx) for the whole event."
                : "Each category has its own participant Excel (.xlsx). All use the same certificate template."}
            </p>
            <div className="space-y-3">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center gap-3 border border-gray-200 rounded-lg p-3 bg-gray-50">
                  {eventType !== "open" && (
                    <input
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-44 shrink-0"
                      placeholder="e.g. Under 10 Open"
                      value={cat.name}
                      onChange={(e) =>
                        setCategories((prev) => prev.map((c) => (c.id === cat.id ? { ...c, name: e.target.value } : c)))
                      }
                    />
                  )}
                  <label className="flex-1 border-2 border-dashed border-gray-300 rounded-lg px-3 py-2 text-center cursor-pointer hover:border-brand-500 transition-colors">
                    {cat.file ? (
                      <span className="text-sm text-green-600">✓ {cat.file.name}</span>
                    ) : (
                      <span className="text-sm text-gray-400">Upload .xlsx</span>
                    )}
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleCategoryFile(cat.id, e.target.files[0])}
                    />
                  </label>
                  {eventType !== "open" && categories.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setCategories((prev) => prev.filter((c) => c.id !== cat.id))}
                      className="text-red-400 hover:text-red-600 text-sm shrink-0"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {categories.some((c) => c.file) && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Header Row Index</label>
                <p className="text-xs text-gray-400 mb-1">0-based. Use 3 for Chess-Results.com exports.</p>
                <input
                  type="number"
                  min="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={headerRowIndex}
                  onChange={(e) => setHeaderRowIndex(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Certificate Text Color</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="h-9 w-16 rounded border cursor-pointer"
                  />
                  <span className="text-sm text-gray-500">{textColor}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Field Configuration */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-gray-900">Field Placement</h2>
            <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleAutoDetect}
              disabled={detecting || !templateFile || columns.length === 0}
              className="text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5"
            >
              {detecting && <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {detecting ? "Detecting…" : "✨ Auto-Detect Placement"}
            </button>
            <button
              type="button"
              onClick={() =>
                setFields([...fields, {
                  id: `field_${Date.now()}`,
                  label: "New Field",
                  columnIndex: 0,
                  centerX: 800,
                  topY: 500,
                  maxWidth: 400,
                  fontSize: 26,
                  format: "text",
                }])
              }
              className="text-sm text-brand-500 hover:text-brand-600 font-medium"
            >
              + Add Field
            </button>
            </div>
          </div>
          {detectMsg && (
            <p className={`text-xs mb-2 ${detectMsg.startsWith("✓") ? "text-green-600" : "text-amber-600"}`}>{detectMsg}</p>
          )}
          <p className="text-xs text-gray-400 mb-4">
            Map each certificate blank to a spreadsheet column and configure its position on the template.
            Coordinates are in pixels from the top-left of the template image.
          </p>
          <div className="space-y-3">
            {fields.map((f, i) => (
              <FieldEditor
                key={f.id}
                field={f}
                index={i}
                columns={columns}
                onChange={(updated) => setFields(fields.map((x, j) => (j === i ? updated : x)))}
                onRemove={() => setFields(fields.filter((_, j) => j !== i))}
              />
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {submitting && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 flex items-center gap-4">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-900">{submitStep}</p>
              <p className="text-xs text-blue-500 mt-0.5">
                Files are being uploaded to Google Drive — this takes 15–30 seconds.
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <a href="/tournaments" className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
            Cancel
          </a>
          <button
            type="submit"
            disabled={submitting}
            className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
          >
            {submitting && (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {submitting ? "Creating…" : "Create Tournament"}
          </button>
        </div>
      </form>
    </div>
  );
}
