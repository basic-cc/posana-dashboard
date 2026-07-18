import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

async function requireAdmin() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  }
  return { user };
}

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const admin = createAdminClient();
  const { data, error: listError } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (listError) return NextResponse.json({ error: listError.message }, { status: 500 });

  const emails = data.users.map((u) => ({ id: u.id, email: u.email }));
  return NextResponse.json({ emails });
}

export async function PATCH(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id, email } = await request.json();
  if (!id || !email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "A valid id and email are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error: updateError } = await admin.auth.admin.updateUserById(id, { email });
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  return NextResponse.json({ id: data.user.id, email: data.user.email });
}
