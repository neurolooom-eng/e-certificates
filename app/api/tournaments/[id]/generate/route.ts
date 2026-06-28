import { NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { getTournament, saveTournament, getUploadsDir } from "@/lib/storage";
import { createFolder, uploadFile } from "@/lib/google-drive";
import type { Certificate } from "@/lib/types";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tournament = getTournament(id);
  if (!tournament) return NextResponse.json({ error: "Not found" }, { status: 404 });

  tournament.status = "generating";
  saveTournament(tournament);

  const outputDir = path.join(getUploadsDir(id), "certificates");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const configPath = path.join(getUploadsDir(id), "config.json");
  fs.writeFileSync(configPath, JSON.stringify(tournament.config, null, 2));

  try {
    const generated = await runPythonScript(
      tournament.templatePath,
      tournament.dataPath,
      configPath,
      outputDir
    );

    const folder = await createFolder(`${tournament.name} – Certificates`);
    tournament.driveFolderId = folder.id;
    tournament.driveFolderLink = folder.link;

    const certificates: Certificate[] = [];
    for (const item of generated) {
      const filePath = path.join(outputDir, item.file);
      const { id: fileId, link } = await uploadFile(
        filePath,
        item.file,
        "image/png",
        folder.id
      );
      certificates.push({
        rowIndex: item.rowIndex,
        recipientName: item.name,
        driveFileId: fileId,
        driveLink: link,
        generatedAt: new Date().toISOString(),
      });
    }

    tournament.certificates = certificates;
    tournament.status = "ready";
    saveTournament(tournament);
    return NextResponse.json({ status: "ready", count: certificates.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    tournament.status = "error";
    tournament.errorMessage = msg;
    saveTournament(tournament);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function runPythonScript(
  templatePath: string,
  dataPath: string,
  configPath: string,
  outputDir: string
): Promise<{ rowIndex: number; name: string; file: string }[]> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), "scripts", "generate_certificates.py");
    const proc = spawn("python3", [
      scriptPath,
      "--template", templatePath,
      "--data", dataPath,
      "--config", configPath,
      "--output-dir", outputDir,
    ]);

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d));
    proc.stderr.on("data", (d) => (stderr += d));

    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(`Python script failed: ${stderr}`));
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error(`Invalid JSON from script: ${stdout}`));
      }
    });
  });
}
