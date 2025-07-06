import type { ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";

import Button from "~/components/Button";
import TextField from "~/components/TextField";
import { getSupabaseClient } from "~/utils/getSupabaseClient";

export const meta: MetaFunction = () => {
  return [
    {
      title: "Create New Member | Remix Dashboard",
    },
  ];
};

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get("email");
  const updates = Object.fromEntries(formData);

  const supabase = getSupabaseClient();
  const { data: existingMember, error: fetchError } = await supabase
    .from("members")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (fetchError) {
    return Response.json(
      { error: "Error checking existing members" },
      { status: 500 }
    );
  }

  if (existingMember) {
    return Response.json(
      { error: "A member with this email already exists" },
      { status: 400 }
    );
  }

  const { data: newMember, error: insertError } = await supabase
    .from("members")
    .insert([updates])
    .select()
    .single();

  if (insertError) {
    return Response.json({ error: "Error adding new member" }, { status: 500 });
  }

  return redirect(`/dashboard/${newMember.id}`);
}

export default function NewMember() {
  const actionData = useActionData<{ error?: string }>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <>
      <h1 className="mb-8 text-2xl font-semibold text-slate-900 lg:text-3xl">
        New Member
      </h1>
      <div className="w-full px-8 py-10 bg-white shadow-md rounded-xl lg:px-10 lg:py-12">
        <Form method="POST">
          {actionData?.error && (
            <p className="p-3 mb-4 text-sm rounded-md bg-rose-50 text-rose-700">
              {actionData.error}
            </p>
          )}
          <fieldset
            className="w-full space-y-4 lg:space-y-6 disabled:opacity-70"
            disabled={isSubmitting}
          >
            <TextField
              id="name"
              name="name"
              type="text"
              label="Name"
              required
              placeholder="Name Surname"
            />
            <TextField
              id="email"
              name="email"
              type="email"
              label="Email"
              required
              placeholder="Email address"
            />
            <TextField
              id="location"
              name="location"
              type="text"
              label="Location"
              required
              placeholder="Country"
            />
            <TextField
              id="avatar_url"
              name="avatar_url"
              type="url"
              label="Avatar URL"
              placeholder="https://i.pravatar.cc/120?img=7"
            />
            <div className="flex items-center justify-center w-full gap-4 md:justify-end">
              <Button to="/dashboard" variant="outlined">
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting}>
                Create Member
              </Button>
            </div>
          </fieldset>
        </Form>
      </div>
    </>
  );
}
