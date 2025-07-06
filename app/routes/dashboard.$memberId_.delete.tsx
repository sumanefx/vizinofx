import type { ActionFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import invariant from "tiny-invariant";

import { getSupabaseClient } from "~/utils/getSupabaseClient";

export async function action({ params }: ActionFunctionArgs) {
  invariant(params.memberId, "Missing memberId param");

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("members")
    .delete()
    .eq("id", params.memberId);

  if (error) {
    throw new Response(error.message, { status: 500 });
  }

  return redirect("/dashboard");
}
