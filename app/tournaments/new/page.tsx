"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import TemplateDesigner from "@/components/TemplateDesigner";
import { metaFromRows, detectHeaderRow, mapColumns } from "@/lib/sheet-meta";
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
  selected,
  onSelect,
  onChange,
  onRemove,
}: {
  field: FieldConfig;
  index: number;
  columns: string[];
  selected: boolean;
  onSelect: () => void;
  onChange: (f: FieldConfig) => void;
  onRemove: () => void;
}) {
  const set = (k: keyof FieldConfig, v: string | number) =>
    onChange({ ...field, [k]: v });

  const isTick = field.format === "tick";

  return (
    <div
      onClick={onSelect}
      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
        selected ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500" : "border-gray-200 bg-gray-50"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-medium text-sm text-gray-700">
          {isTick ? "✓ " : ""}
          {field.label || `Field ${index + 1}`}
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="text-red-400 hover:text-red-600 text-sm"
        >
          Remove
        </button>
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
          <label className="block text-xs text-gray-500 mb-1">Type</label>
          <select
            className="w-full border rounded px-2 py-1.5 text-sm"
            value={field.format}
            onChange={(e) => set("format", e.target.value as FieldConfig["format"])}
          >
            <option value="text">Text</option>
            <option value="number">Number (strip .0)</option>
            <option value="ordinal">Ordinal (1st, 2nd…)</option>
            <option value="tick">✓ Tick / Checkbox</option>
          </select>
        </div>

        {/* Where the value comes from */}
        <div className={isTick ? "" : "col-span-2"}>
          <label className="block text-xs text-gray-500 mb-1">
            {isTick ? "Tick when this…" : "Value from"}
          </label>
          <select
            className="w-full border rounded px-2 py-1.5 text-sm"
            value={field.source === "meta" ? `meta:${field.metaKey ?? "category"}` : "column"}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "column") {
                onChange({ ...field, source: "column", metaKey: undefined });
              } else {
                onChange({
                  ...field,
                  source: "meta",
                  metaKey: v.slice(5) as FieldConfig["metaKey"],
                });
              }
            }}
          >
            <option value="column">Spreadsheet column (per participant)</option>
            <option value="meta:category">Category — e.g. &quot;Under 8 Boys&quot;</option>
            <option value="meta:age">Age group — e.g. &quot;8&quot;</option>
            <option value="meta:gender">Gender — Boys / Girls / Open</option>
            <option value="meta:rounds">Number of rounds — e.g. &quot;6&quot;</option>
            <option value="meta:title">Tournament title from the sheet</option>
          </select>
        </div>

        {field.source === "meta" ? (
          isTick ? (
            <div>
              <label className="block text-xs text-gray-500 mb-1">…equals this value</label>
              <input
                className="w-full border rounded px-2 py-1.5 text-sm"
                placeholder="e.g. 8 — blank = always tick"
                value={field.matchValue ?? ""}
                onChange={(e) => set("matchValue", e.target.value)}
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Prefix</label>
                <input
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  placeholder="e.g. &quot;after &quot;"
                  value={field.prefix ?? ""}
                  onChange={(e) => set("prefix", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Suffix</label>
                <input
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  placeholder="e.g. &quot; Rounds&quot;"
                  value={field.suffix ?? ""}
                  onChange={(e) => set("suffix", e.target.value)}
                />
              </div>
            </>
          )
        ) : (
          <>
            <div className={isTick ? "" : "col-span-2"}>
              <label className="block text-xs text-gray-500 mb-1">Spreadsheet Column</label>
              {columns.length > 0 ? (
                <select
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  value={field.columnIndex}
                  onChange={(e) => set("columnIndex", Number(e.target.value))}
                >
                  {isTick && <option value={-1}>The category name</option>}
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
            {isTick && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">…equals this value</label>
                <input
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  placeholder="blank = always tick"
                  value={field.matchValue ?? ""}
                  onChange={(e) => set("matchValue", e.target.value)}
                />
              </div>
            )}
          </>
        )}

        <div>
          <label className="block text-xs text-gray-500 mb-1">
            {isTick ? "Tick Size (px)" : "Font Size (px)"}
          </label>
          <input
            type="number"
            className="w-full border rounded px-2 py-1.5 text-sm"
            value={field.fontSize}
            onChange={(e) => set("fontSize", Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Box Height (px)</label>
          <input
            type="number"
            className="w-full border rounded px-2 py-1.5 text-sm"
            value={field.boxHeight ?? Math.round(field.fontSize * 1.4)}
            onChange={(e) => set("boxHeight", Number(e.target.value))}
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
        <div className="col-span-2">
          <label className="block text-xs text-gray-500 mb-1">
            {isTick ? "Box Width (px)" : "Max Width (px)"}
          </label>
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
  /** Parsed from the sheet header; editable by the organiser. */
  age: string;
  gender: string;
  rounds: string;
  autoFilled: boolean;
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
    { id: `cat_${Date.now()}`, name: "", file: null, age: "", gender: "", rounds: "", autoFilled: false },
  ]);
  const [headerRowIndex, setHeaderRowIndex] = useState(0);
  const [textColor, setTextColor] = useState("#8B1E1E");
  const [fields, setFields] = useState<FieldConfig[]>(DEFAULT_FIELDS);
  const [columns, setColumns] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState("");
  const [error, setError] = useState("");
  const templateRef = useRef<HTMLInputElement>(null);

  // Visual designer + live preview
  const [templateUrl, setTemplateUrl] = useState<string | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  // Raw sheet rows kept so the header row can be changed without re-uploading
  const [sheetRows, setSheetRows] = useState<unknown[][]>([]);
  const [autoMap, setAutoMap] = useState(true);
  const [previewCatId, setPreviewCatId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState("");

  // Keep an object URL for the uploaded template so the designer can show it
  useEffect(() => {
    if (!templateFile) { setTemplateUrl(null); return; }
    const url = URL.createObjectURL(templateFile);
    setTemplateUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [templateFile]);

  async function handleDraftPreview(catId?: string) {
    const firstWithFile = categories.find((c) => c.id === (catId ?? previewCatId) && c.file)
      ?? categories.find((c) => c.file);
    if (!templateFile || !firstWithFile?.file) {
      setPreviewError("Upload the template and at least one participant list first.");
      return;
    }
    setPreviewing(true);
    setPreviewError("");

    const fd = new FormData();
    fd.append("template", templateFile);
    fd.append("data", firstWithFile.file);
    fd.append("categoryName", firstWithFile.name.trim() || "Open");
    fd.append("metaOverrides", JSON.stringify({
      age: firstWithFile.age,
      gender: firstWithFile.gender,
      rounds: firstWithFile.rounds,
    }));
    fd.append("config", JSON.stringify({ headerRowIndex, textColor, fields }));

    try {
      const res = await fetch("/api/preview-draft", { method: "POST", body: fd });
      if (res.ok) {
        const blob = await res.blob();
        setPreviewUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(blob); });
        const n = res.headers.get("X-Recipient-Name");
        setPreviewName(n ? decodeURIComponent(n) : "");
      } else {
        const body = await res.json().catch(() => ({}));
        setPreviewError(body.error || "Preview failed.");
      }
    } catch (err: unknown) {
      setPreviewError(err instanceof Error ? err.message : String(err));
    }
    setPreviewing(false);
  }

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
    setDetectMsg("Reading the certificate and matching it to your spreadsheet…");
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

      // A real value per column so the model matches on data, not just headers
      const firstDataRow = (sheetRows[headerRowIndex + 1] ?? []) as unknown[];
      const samples = columns.map((_, i) => {
        const v = firstDataRow[i];
        return v === undefined || v === null || v === "" ? "" : String(v).slice(0, 40);
      });

      const cat = categories.find((c) => c.file);
      const res = await fetch("/api/detect-placement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          mediaType: templateFile.type || "image/jpeg",
          columns,
          samples,
          meta: cat
            ? { category: cat.name, age: cat.age, gender: cat.gender, rounds: cat.rounds }
            : undefined,
          width: dims.w,
          height: dims.h,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDetectMsg(data.error || "Auto-detection failed.");
      } else {
        type Detected = Omit<FieldConfig, "id"> & { metaKey?: string; source?: string };
        const detected: FieldConfig[] = (data.fields as Detected[]).map((f, i) => ({
          ...f,
          id: `detected_${i}`,
          // The model returns "none"/-1 placeholders for the unused half of the union
          metaKey: f.source === "meta" ? (f.metaKey as FieldConfig["metaKey"]) : undefined,
          source: f.source === "meta" ? "meta" : "column",
          matchValue: f.matchValue || undefined,
          prefix: f.prefix || undefined,
          suffix: f.suffix || undefined,
        }));
        setFields(detected);
        setSelectedFieldId(detected[0]?.id ?? null);
        if (data.textColor) setTextColor(data.textColor);
        const ticks = detected.filter((f) => f.format === "tick").length;
        setDetectMsg(
          `✓ Found ${detected.length} field${detected.length === 1 ? "" : "s"}` +
          (ticks ? ` (${ticks} tick box${ticks === 1 ? "" : "es"})` : "") +
          `. ${data.notes ?? ""} Render a preview to check placement.`
        );
      }
    } catch (err: unknown) {
      setDetectMsg(`Auto-detection failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    setDetecting(false);
  }

  /** Point the standard fields at the columns whose headers match them. */
  function applyAutoMap(headerRow: unknown[], headerIdx: number) {
    const mapped = mapColumns(headerRow);
    if (mapped.length === 0) {
      setDetectMsg("Couldn't recognise the column headers — map them manually below.");
      return;
    }
    const byKey = Object.fromEntries(mapped.map((m) => [m.key, m.columnIndex]));
    setFields((prev) =>
      prev.map((f) => {
        if (f.source === "meta") return f;
        const idx =
          f.id === "name" ? byKey.name
          : f.id === "org" ? byKey.club
          : f.id === "pts" ? byKey.points
          : f.id === "place" ? byKey.rank
          : undefined;
        return idx === undefined ? f : { ...f, columnIndex: idx };
      })
    );
    setDetectMsg(
      `✓ Read the sheet: header on row ${headerIdx}, mapped ${mapped.length} columns automatically.`
    );
  }

  /** Re-read columns when the organiser changes the header row by hand. */
  function applyHeaderRow(idx: number) {
    setHeaderRowIndex(idx);
    if (sheetRows.length === 0) return;
    const headerRow = (sheetRows[idx] || []) as unknown[];
    setColumns(headerRow.map((c) => String(c ?? "")));
    if (autoMap) applyAutoMap(headerRow, idx);
  }

  function handleCategoryFile(catId: string, file: File) {
    setCategories((prev) => prev.map((c) => (c.id === catId ? { ...c, file } : c)));
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target?.result, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][];

      // Results exports have several lines of text above the table — find the
      // real header row instead of assuming row 0.
      const detectedHeader = detectHeaderRow(rows);
      const headerIdx = detectedHeader || headerRowIndex;
      if (detectedHeader) setHeaderRowIndex(detectedHeader);

      const headerRow = (rows[headerIdx] || rows[0] || []) as unknown[];
      setColumns(headerRow.map((c) => String(c ?? "")));

      setSheetRows(rows);

      // Point the standard fields at the right columns automatically
      if (autoMap) applyAutoMap(headerRow, headerIdx);

      // Category / rounds parsed straight out of the sheet's header text
      const meta = metaFromRows(rows, headerIdx);
      setCategories((prev) =>
        prev.map((c) =>
          c.id === catId
            ? {
                ...c,
                age: c.age || meta.age,
                gender: c.gender || meta.gender,
                rounds: c.rounds || meta.rounds,
                name: c.name || meta.category,
                autoFilled: !!(meta.age || meta.gender || meta.rounds),
              }
            : c
        )
      );
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
    fd.append("categories", JSON.stringify(validCategories.map((c) => ({
      name: c.name.trim(),
      age: c.age,
      gender: c.gender,
      rounds: c.rounds,
    }))));
    validCategories.forEach((c, i) => fd.append(`categoryData_${i}`, c.file!));
    fd.append("config", JSON.stringify(config));

    // Cycle through status messages so the user knows it's working
    const steps = [
      "Uploading certificate template…",
      "Uploading participant list…",
      "Saving the tournament…",
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
    <div className="max-w-5xl mx-auto">
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
                    setCategories((prev) => [{ ...(prev[0] ?? { id: `cat_${Date.now()}`, file: null, age: "", gender: "", rounds: "", autoFilled: false }), name: "Open" }]);
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
                  onClick={() => setCategories([...categories, { id: `cat_${Date.now()}`, name: "", file: null, age: "", gender: "", rounds: "", autoFilled: false }])}
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
              {categories.map((cat) => {
                const setCat = (patch: Partial<CategoryEntry>) =>
                  setCategories((prev) => prev.map((c) => (c.id === cat.id ? { ...c, ...patch } : c)));
                return (
                  <div key={cat.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                    <div className="flex items-center gap-3">
                      {eventType !== "open" && (
                        <input
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-44 shrink-0"
                          placeholder="e.g. Under 10 Open"
                          value={cat.name}
                          onChange={(e) => setCat({ name: e.target.value })}
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

                    {/* Category details — auto-read from the sheet header, editable */}
                    {cat.file && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-2">
                          {cat.autoFilled
                            ? "✓ Read from the sheet header — edit if anything is wrong."
                            : "Couldn't read these from the sheet — fill them in manually."}
                        </p>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Age group</label>
                            <input
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                              placeholder="8"
                              value={cat.age}
                              onChange={(e) => setCat({ age: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Gender</label>
                            <select
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                              value={cat.gender}
                              onChange={(e) => setCat({ gender: e.target.value })}
                            >
                              <option value="">—</option>
                              <option value="Boys">Boys</option>
                              <option value="Girls">Girls</option>
                              <option value="Open">Open</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Rounds</label>
                            <input
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                              placeholder="6"
                              value={cat.rounds}
                              onChange={(e) => setCat({ rounds: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Column mapping override */}
          {sheetRows.length > 0 && (
            <div className="mt-6 border-t border-gray-100 pt-5">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-medium text-gray-900 text-sm">Columns</h3>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={autoMap}
                      onChange={(e) => setAutoMap(e.target.checked)}
                    />
                    Auto-map columns
                  </label>
                  <button
                    type="button"
                    onClick={() => applyAutoMap((sheetRows[headerRowIndex] || []) as unknown[], headerRowIndex)}
                    className="text-xs text-brand-500 hover:text-brand-600 font-medium"
                  >
                    Re-run auto-map
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-3">
                Auto-mapping is a starting point — override any column below, or turn it off to map
                everything by hand. Uncheck it before uploading more files to keep your choices.
              </p>

              <div className="flex items-end gap-4 mb-3">
                <div className="w-40">
                  <label className="block text-xs text-gray-500 mb-1">Header row</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={headerRowIndex}
                    onChange={(e) => applyHeaderRow(Number(e.target.value))}
                  />
                </div>
                <p className="text-xs text-gray-400 pb-2">
                  0-based. The row holding <em>Rk. / Name / Pts.</em> — detected automatically on upload.
                </p>
              </div>

              {/* Column reference with sample values */}
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="text-left px-3 py-2 w-12">#</th>
                      <th className="text-left px-3 py-2">Header</th>
                      <th className="text-left px-3 py-2">Sample value</th>
                      <th className="text-left px-3 py-2">Used by</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {columns.map((c, i) => {
                      const sample = String(
                        (sheetRows[headerRowIndex + 1] as unknown[] | undefined)?.[i] ?? ""
                      );
                      const usedBy = fields
                        .filter((f) => f.source !== "meta" && f.columnIndex === i)
                        .map((f) => f.label);
                      return (
                        <tr key={i} className={usedBy.length ? "bg-brand-50/50" : ""}>
                          <td className="px-3 py-1.5 font-mono text-gray-400">{i}</td>
                          <td className="px-3 py-1.5 font-medium text-gray-700">{c || <em className="text-gray-300">blank</em>}</td>
                          <td className="px-3 py-1.5 text-gray-500 truncate max-w-[200px]">{sample}</td>
                          <td className="px-3 py-1.5 text-brand-500">{usedBy.join(", ")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {categories.some((c) => c.file) && (
            <div className="mt-4 grid grid-cols-2 gap-4">
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
              + Text
            </button>
            <button
              type="button"
              onClick={() => {
                const id = `tick_${Date.now()}`;
                setFields([...fields, {
                  id,
                  label: "Tick Box",
                  columnIndex: -1,
                  centerX: 800,
                  topY: 500,
                  maxWidth: 40,
                  boxHeight: 40,
                  fontSize: 34,
                  format: "tick",
                  matchValue: "",
                }]);
                setSelectedFieldId(id);
              }}
              className="text-sm text-brand-500 hover:text-brand-600 font-medium"
            >
              + Tick
            </button>
            </div>
          </div>
          {detectMsg && (
            <p className={`text-xs mb-2 ${detectMsg.startsWith("✓") ? "text-green-600" : "text-amber-600"}`}>{detectMsg}</p>
          )}

          {/* Visual designer */}
          {templateUrl ? (
            <div className="mb-5">
              <TemplateDesigner
                imageUrl={templateUrl}
                fields={fields}
                selectedId={selectedFieldId}
                onSelect={setSelectedFieldId}
                onChange={setFields}
                onCreate={(box) => {
                  const id = `field_${Date.now()}`;
                  setFields((prev) => [
                    ...prev,
                    {
                      id,
                      label: `Field ${prev.length + 1}`,
                      columnIndex: 0,
                      centerX: box.centerX,
                      topY: box.topY,
                      maxWidth: box.maxWidth,
                      boxHeight: box.boxHeight,
                      fontSize: Math.max(10, Math.round(box.boxHeight * 0.65)),
                      format: "text",
                    },
                  ]);
                  setSelectedFieldId(id);
                }}
              />
            </div>
          ) : (
            <div className="mb-5 border-2 border-dashed border-gray-200 rounded-lg py-10 text-center text-sm text-gray-400">
              Upload a certificate template above to draw field boxes directly on it.
            </div>
          )}

          {/* Live preview */}
          <div className="border-t border-gray-100 pt-5 mb-5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-medium text-gray-900 text-sm">Preview before creating</h3>
                <p className="text-xs text-gray-400">
                  Renders a real certificate for the longest name — the hardest case to fit. Adjust boxes and
                  re-render as many times as you like.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
              {categories.filter((c) => c.file).length > 1 && (
                <select
                  value={previewCatId ?? ""}
                  onChange={(e) => { setPreviewCatId(e.target.value); handleDraftPreview(e.target.value); }}
                  className="border border-gray-300 rounded-lg px-2 py-2 text-sm"
                >
                  <option value="">First category</option>
                  {categories.filter((c) => c.file).map((c) => (
                    <option key={c.id} value={c.id}>{c.name || "Unnamed"}</option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() => handleDraftPreview()}
                disabled={previewing || !templateFile || !categories.some((c) => c.file)}
                className="px-4 py-2 border border-brand-500 text-brand-500 hover:bg-brand-50 disabled:opacity-40 rounded-lg text-sm font-medium flex items-center gap-2"
              >
                {previewing && (
                  <span className="inline-block w-3.5 h-3.5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                )}
                {previewing ? "Rendering…" : previewUrl ? "Re-render Preview" : "Render Preview"}
              </button>
              </div>
            </div>
            {previewError && <p className="text-red-600 text-sm mt-2">{previewError}</p>}
            {previewUrl && (
              <div className="mt-3 rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    Sample for: <strong className="text-gray-700">{previewName || "longest name"}</strong>
                  </p>
                  <a href={previewUrl} download="preview.png" className="text-xs text-blue-600 hover:underline">
                    Download
                  </a>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="Certificate preview" className="w-full" />
              </div>
            )}
          </div>

          <p className="text-xs text-gray-400 mb-3">
            Each box maps a certificate blank to a spreadsheet column. Coordinates are in pixels from the
            top-left of the template. Use a <strong>Tick / Checkbox</strong> field for boxes that get a ✓
            instead of text — for example, ticking the matching age group on a category certificate.
          </p>
          <div className="space-y-3">
            {fields.map((f, i) => (
              <FieldEditor
                key={f.id}
                field={f}
                index={i}
                columns={columns}
                selected={f.id === selectedFieldId}
                onSelect={() => setSelectedFieldId(f.id)}
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
                Uploading your template and participant lists — this takes 15–30 seconds.
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
