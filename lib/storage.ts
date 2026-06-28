import fs from "fs";
import path from "path";
import type { Tournament } from "./types";

const DATA_FILE = path.join(process.cwd(), "data", "tournaments.json");

function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function readTournaments(): Tournament[] {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return [];
  }
}

export function writeTournaments(tournaments: Tournament[]) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(tournaments, null, 2));
}

export function getTournament(id: string): Tournament | null {
  return readTournaments().find((t) => t.id === id) ?? null;
}

export function saveTournament(tournament: Tournament) {
  const all = readTournaments();
  const idx = all.findIndex((t) => t.id === tournament.id);
  if (idx >= 0) all[idx] = tournament;
  else all.push(tournament);
  writeTournaments(all);
}

export function getUploadsDir(tournamentId: string) {
  const dir = path.join(process.cwd(), "uploads", tournamentId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
