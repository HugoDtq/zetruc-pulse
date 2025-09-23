export const runtime = "nodejs";

import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]); // pas de SVG pour éviter XSS

function uniqueName(originalName: string) {
  const ext = path.extname(originalName).toLowerCase() || ".png";
  const base = crypto.randomBytes(8).toString("hex");
  const y = new Date().getFullYear();
  const m = String(new Date().getMonth() + 1).padStart(2, "0");
  return { relDir: `uploads/logos/${y}/${m}`, file: `${base}${ext}` };
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier reçu" }, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: "Type de fichier non autorisé (png, jpg, webp)" }, { status: 415 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Fichier trop volumineux (max 2 Mo)" }, { status: 413 });
    }

    const { relDir, file: filename } = uniqueName(file.name);
    const publicDir = path.join(process.cwd(), "public", relDir);
    await fs.mkdir(publicDir, { recursive: true });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const absPath = path.join(publicDir, filename);
    await fs.writeFile(absPath, buffer, { flag: "wx" });

    // URL publique
    const url = `/${relDir}/${filename}`;

    return NextResponse.json({ url }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: "Échec de l’upload" }, { status: 500 });
  }
}
