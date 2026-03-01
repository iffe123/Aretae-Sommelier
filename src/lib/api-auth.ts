import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/firebase-admin";

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
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 }
    );
  }
}
