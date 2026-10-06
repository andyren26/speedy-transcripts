import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/admin-auth";

/** PATCH /api/admin/support/:id — admins mark a support ticket open or closed. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { user, isAdmin } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const status = body.status === "closed" || body.status === "open" ? body.status : null;
  if (!status) {
    return NextResponse.json({ error: "status must be 'open' or 'closed'" }, { status: 400 });
  }

  const { data, error } = await createAdminClient()
    .from("support_tickets")
    .update({ status })
    .eq("id", id)
    .select("id, status")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(data);
}
