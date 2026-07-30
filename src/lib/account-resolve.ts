import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The only way /me is allowed to learn which person is signed in: the auth
 * user's own identity row. Never a bare select on people, never limit(1) over
 * whatever RLS happens to expose (an admin can read every row), and never a
 * client-supplied personId.
 */
export async function resolveMyPersonId(
  supabase: SupabaseClient,
  authUserId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("identities")
    .select("person_id, is_primary, verified_at")
    .eq("auth_user_id", authUserId)
    .order("is_primary", { ascending: false })
    .limit(1);
  return (data?.[0]?.person_id as string | undefined) ?? null;
}
