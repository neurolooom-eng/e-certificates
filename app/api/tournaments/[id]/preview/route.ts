import { NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { getTournament, getUploadsDir } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tournament = getTournament(id);
  if (!tournament) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const previewDir = path.join(getUploadsDir(id), "preview");
  if (!fs.existsSync(previewDir)) fs.mkdirSync(previewDir, { recursive: true });

  const configPath = path.join(getUploadsDir(id), "config.json");
  fs.writeFileSync(configPath, JSON.stringify(tournament.config, null, 2));

  const scriptPath = path.join(process.cwd(), "scripts", "generate_certificates.py");
  const result = await new Promise<{ name: string; file: string }[]>((resolve, reject) => {
    const proc = spawn("python3", [
      scriptPath,
      "--template", tournament.templatePath,
      "--data", tournament.dataPath,
      "--config", configPath,
      "--output-dir", previewDir,
      "--preview",
    ]);
    let out = "", err = "";
    proc.stdout.on("data", (d) => (out += d));
    proc.stderr.on("data", (d) => (err += d));
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(err));
      try { resolve(JSON.parse(out)); } catch { reject(new Error(out)); }
    });
  });

  if (!result[0]) return NextResponse.json({ error: "No data rows" }, { status: 400 });
  const imgPath = path.join(previewDir, result[0].file);
  const img = fs.readFileSync(imgPath);
  return new Response(img, { headers: { "Content-Type": "image/png" } });
}
