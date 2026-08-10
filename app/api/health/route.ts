import { NextResponse } from "next/server";

export async function GET() {
  const hasNextAuthSecret = !!process.env.NEXTAUTH_SECRET;
  const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN;
  const isVercel = !!process.env.VERCEL;

  return NextResponse.json({
    ok: hasNextAuthSecret && hasBlobToken,
    env: isVercel ? "vercel" : "local",
    checks: {
      NEXTAUTH_SECRET: hasNextAuthSecret,
      BLOB_READ_WRITE_TOKEN: hasBlobToken,
    },
  });
}
