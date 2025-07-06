import { redirect } from "@remix-run/node";
import { Outlet } from "@remix-run/react";

import Logo from "~/components/Logo";
import { getSupabaseClient } from "~/utils/getSupabaseClient";

export function loader() {
  try {
    getSupabaseClient(); // Throws an error if Supabase is not set
  } catch (error) {
    return redirect("/"); // Redirect to _index.tsx
  }

  return Response.json({});
}

export default function AuthLayout() {
  return (
    <main className="flex grow">
      <div className="absolute left-4 top-4">
        <Logo />
      </div>
      <div className="hidden p-8 bg-white lg:basis-5/12 lg:flex">
        <img src="/illustration_auth.svg" alt="Illustration" />
      </div>
      <div className="flex flex-col items-center justify-center w-full px-4 py-24 lg:px-8 lg:basis-7/12">
        <Outlet />
      </div>
    </main>
  );
}
