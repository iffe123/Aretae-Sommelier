import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/firebase-admin";

function isFirebaseAdminConfigError(error: unknown): boolean {
  const errorObj = error as { code?: string; message?: string };
  const code = (errorObj.code || "").toLowerCase();
  const message = (errorObj.message || "").toLowerCase();

  return (
    code.includes("app/invalid-credential") ||
    message.includes("failed to parse firebase_service_account_key") ||
    message.includes("default credentials") ||
    message.includes("could not load the default credentials") ||
    message.includes("metadata")
  );
}

export async function authenticateRequest(
  request: NextRequest
): Promise<{ uid: string } | NextResponse> {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    return NextResponse.json(
      { error: "Missing Authorization header" },
      { status: 401 }
    );
  }

  if (!authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Invalid Authorization header format. Expected: Bearer <token>" },
      { status: 401 }
    );
  }

  const token = authHeader.slice(7);

  if (!token) {
    return NextResponse.json(
      { error: "Missing token in Authorization header" },
      { status: 401 }
    );
  }

  try {
    const { uid } = await verifyIdToken(token);
    return { uid };
  } catch (error) {
    console.error("Token verification failed:", error);

    if (isFirebaseAdminConfigError(error)) {
      return NextResponse.json(
        { error: "Server auth configuration error. Check FIREBASE_SERVICE_ACCOUNT_KEY in Vercel." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 }
    );
  }
}
