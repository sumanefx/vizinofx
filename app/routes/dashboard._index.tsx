import type { ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, useFetcher, useLoaderData } from "@remix-run/react";

import Button from "~/components/Button";
import { GlobalErrorBoundary } from "~/components/GlobalErrorBoundary";
import DeleteIcon from "~/components/icons/Delete";
import EditIcon from "~/components/icons/Edit";
import ViewIcon from "~/components/icons/View";
import { formatDate } from "~/utils/formatDate";
import { getInitials } from "~/utils/getInitials";
import { getSupabaseClient } from "~/utils/getSupabaseClient";

type Member = {
  id: number;
  created_at: string;
  name: string;
  email: string;
  location: string;
  avatar_url?: string;
};

export const meta: MetaFunction = () => {
  return [
    {
      title: "Member List | Remix Dashboard",
    },
  ];
};

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const memberId = formData.get("memberId");

  const supabase = getSupabaseClient();
  const { error } = await supabase.from("members").delete().eq("id", memberId);

  if (error) {
    throw new Response(error.message, { status: 500 });
  }

  return Response.json({ message: "Member deleted successfully" });
}

export async function loader() {
  const supabase = getSupabaseClient();
  const { data: members, error } = await supabase
    .from("members")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Response(error.message, { status: 500 });
  }

  return Response.json({ members });
}

export default function MemberList() {
  const { members } = useLoaderData<{ members: Member[] }>();
  const deleteMemberFetcher = useFetcher();

  return (
    <>
      <div className="flex justify-between gap-2 mb-8">
        <h1 className="text-2xl font-semibold text-slate-900 lg:text-3xl">
          Member List
        </h1>
        <Button to="/dashboard/new">Add Member</Button>
      </div>
      <div className="pb-10 overflow-x-auto overflow-y-visible bg-white shadow-md rounded-xl md:pb-12">
        <table className="w-full text-sm bg-white">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-6 font-medium text-left text-slate-900">
                {members.length} {members.length === 1 ? "member" : "members"}
              </th>
              <th className="p-6 font-medium text-left text-slate-900">
                Location
              </th>
              <th className="p-6 font-medium text-left text-slate-900">
                Created
              </th>
              <th className="p-6 font-medium text-left text-slate-900"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              return (
                <tr
                  key={member.id}
                  className="transition border-b border-slate-200 hover:border-cyan-300"
                >
                  <td className="p-6">
                    <div className="flex items-center gap-4">
                      {member.avatar_url ? (
                        <img
                          className="object-cover w-12 h-12 rounded-full"
                          src={member.avatar_url}
                          alt={`${member.name} avatar`}
                        />
                      ) : (
                        <div className="flex items-center justify-center w-12 h-12 font-medium tracking-wide text-white rounded-full bg-cyan-500">
                          {getInitials(member.name)}
                        </div>
                      )}
                      <div className="space-y-0.5 overflow-hidden">
                        <p className="font-semibold">{member.name}</p>
                        <p className="truncate">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-6">{member.location}</td>
                  <td className="p-6 whitespace-nowrap">
                    {formatDate(member.created_at)}
                  </td>
                  <td className="p-6">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/dashboard/${member.id}`}
                        className="flex items-center justify-center w-8 h-8 transition rounded-md cursor-pointer text-slate-300 hover:text-cyan-600 hover:bg-cyan-50"
                        aria-label="View details"
                      >
                        <ViewIcon />
                      </Link>
                      <Link
                        to={`/dashboard/${member.id}/edit`}
                        className="flex items-center justify-center w-8 h-8 transition rounded-md cursor-pointer text-slate-300 hover:text-cyan-600 hover:bg-cyan-50"
                        aria-label="Edit"
                      >
                        <EditIcon />
                      </Link>
                      <deleteMemberFetcher.Form
                        method="POST"
                        action="/dashboard?index"
                      >
                        <input
                          type="hidden"
                          name="memberId"
                          value={member.id}
                        />
                        <button
                          type="submit"
                          className="flex items-center justify-center w-8 h-8 transition rounded-md cursor-pointer text-slate-300 hover:text-cyan-600 hover:bg-cyan-50"
                          aria-label="Delete"
                        >
                          <DeleteIcon />
                        </button>
                      </deleteMemberFetcher.Form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function ErrorBoundary() {
  return <GlobalErrorBoundary />;
}