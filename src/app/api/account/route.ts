import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import {
  AccountDeletionConfigError,
  createFirebaseAccountDeletionDeps,
  deleteAccount,
} from "@/lib/account-deletion";

/**
 * DELETE /api/account
 *
 * Permanently deletes the signed-in user's wines, wine photos, rate-limit records
 * and Firebase Auth account. Body must be { "confirm": "DELETE" } so a stray
 * request cannot wipe an account.
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;

    let body: { confirm?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
    }

    if (body.confirm !== "DELETE") {
      return NextResponse.json(
        { success: false, error: 'Confirmation required: send { "confirm": "DELETE" }.' },
        { status: 400 }
      );
    }

    const result = await deleteAccount(auth.uid, createFirebaseAccountDeletionDeps());
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof AccountDeletionConfigError) {
      console.error("[account] deletion not configured:", error.message);
      return NextResponse.json(
        { success: false, error: "Account deletion is temporarily unavailable. Please contact support." },
        { status: 500 }
      );
    }

    console.error("[account] deletion failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json(
      { success: false, error: "We couldn't delete your account. Please try again." },
      { status: 500 }
    );
  }
}
