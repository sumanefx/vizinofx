import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, Link, useLoaderData, useNavigation } from "@remix-run/react";
import invariant from "tiny-invariant";

import Button from "~/components/Button";
import { GlobalErrorBoundary } from "~/components/GlobalErrorBoundary";
import TextField from "~/components/TextField";
import { getSupabaseClient } from "~/utils/getSupabaseClient";

export const meta: MetaFunction = () => {
  return [
    {
      title: "Edit Member | Remix Dashboard",
    },
  ];
};

export async function action({ params, request }: ActionFunctionArgs) {
  invariant(params.memberId, "Missing memberId param");
  const formData = await request.formData();
  const updates = Object.fromEntries(formData);

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("members")
    .update(updates)
    .eq("id", params.memberId);

  if (error) {
    throw new Response(error.message, { status: 500 });
  }

  return redirect(`/dashboard/${params.memberId}`);
}

export const loader = async ({ params }: LoaderFunctionArgs) => {
  invariant(params.memberId, "Missing memberId param");

  const supabase = getSupabaseClient();
  const { data: member, error } = await supabase
    .from("members")
    .select("*")
    .eq("id", params.memberId)
    .single();

  if (error) {
    throw new Response(error.message, { status: 500 });
  }

  return Response.json({ member });
};

export default function EditMember() {
  const { member } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <>
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-2xl font-semibold text-slate-900 lg:text-3xl">
          Edit Member
        </h1>
        <Link to="/dashboard" className="text-sm hover:underline">
          &larr; Back to member list
        </Link>
      </div>
      <div className="w-full px-8 py-10 bg-white shadow-md rounded-xl lg:px-10 lg:py-12">
        <Form method="POST">
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
              defaultValue={member.name}
            />
            <TextField
              id="email"
              name="email"
              type="email"
              label="Email"
              required
              placeholder="Email address"
              defaultValue={member.email}
            />
            <TextField
              id="location"
              name="location"
              type="text"
              label="Location"
              required
              placeholder="Country"
              defaultValue={member.location}
            />
            <TextField
              id="avatar_url"
              name="avatar_url"
              type="url"
              label="Avatar URL"
              placeholder="https://i.pravatar.cc/120?img=7"
              defaultValue={member.avatar_url}
            />
            <div className="flex items-center justify-center w-full gap-4 md:justify-end">
              <Button to="/dashboard" variant="outlined">
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting}>
                Save Changes
              </Button>
            </div>
          </fieldset>
        </Form>
      </div>
    </>
  );
}

export function ErrorBoundary() {
  return <GlobalErrorBoundary />;
}
