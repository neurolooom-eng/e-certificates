import { NextResponse } from "next/server";

export async function GET() {
  const hasDriveKey = !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const hasNextAuthSecret = !!process.env.NEXTAUTH_SECRET;
  const isVercel = !!process.env.VERCEL;

  let driveKeyValid = false;
  let driveEmail = "";
  if (hasDriveKey) {
    try {
      const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
      driveKeyValid = parsed.type === "service_account" && !!parsed.private_key;
      driveEmail = parsed.client_email ?? "";
    } catch {
      driveKeyValid = false;
    }
  }

  return NextResponse.json({
    ok: hasDriveKey && driveKeyValid && hasNextAuthSecret,
    env: isVercel ? "vercel" : "local",
    checks: {
      NEXTAUTH_SECRET: hasNextAuthSecret,
      GOOGLE_SERVICE_ACCOUNT_JSON: hasDriveKey,
      driveKeyValid,
      driveEmail,
    },
  });
}
