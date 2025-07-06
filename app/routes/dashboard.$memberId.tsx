import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";

import { GlobalErrorBoundary } from "~/components/GlobalErrorBoundary";
import { formatDate } from "~/utils/formatDate";
import { getInitials } from "~/utils/getInitials";
import { getSupabaseClient } from "~/utils/getSupabaseClient";

export const meta: MetaFunction = () => {
  return [
    {
      title: "Member | Remix Dashboard",
    },
  ];
};

export async function loader({ params }: LoaderFunctionArgs) {
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
}

export default function Member() {
  const { member } = useLoaderData<typeof loader>();

  return (
    <>
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-2xl font-semibold text-slate-900 lg:text-3xl">
          Member Details
        </h1>
        <Link to="/dashboard" className="text-sm hover:underline">
          &larr; Back to member list
        </Link>
      </div>
      <div className="flex flex-col overflow-hidden bg-white shadow-md rounded-xl md:flex-row">
        <div className="flex flex-col w-full px-8 py-10 bg-slate-50 md:basis-1/3 md:items-center lg:py-12">
          {member.avatar_url ? (
            <img
              className="object-cover w-20 h-20 rounded-full ring-2 ring-cyan-300 lg:w-28 lg:h-28"
              src={member.avatar_url}
              alt={`${member.name} avatar`}
            />
          ) : (
            <div className="flex items-center justify-center w-20 h-20 text-xl font-medium tracking-wide text-white rounded-full bg-cyan-500 ring-2 ring-cyan-300 lg:w-28 lg:h-28 lg:text-2xl">
              {getInitials(member.name)}
            </div>
          )}
        </div>
        <div className="px-8 py-10 md:basis-2/3 lg:px-10 lg:py-12">
          <div className="mb-6 space-y-1">
            <p className="text-sm">Name</p>
            <p className="font-medium">{member.name}</p>
          </div>
          <div className="mb-6 space-y-1 overflow-hidden">
            <p className="text-sm">Email</p>
            <p className="font-medium truncate">{member.email}</p>
          </div>
          <div className="mb-6 space-y-1">
            <p className="text-sm">Location</p>
            <p className="font-medium">{member.location}</p>
          </div>
          <div className="mb-6 space-y-1">
            <p className="text-sm">Created</p>
            <p className="font-medium">{formatDate(member.created_at)}</p>
          </div>
        </div>
      </div>
    </>
  );
}

export function ErrorBoundary() {
  return <GlobalErrorBoundary />;
}
