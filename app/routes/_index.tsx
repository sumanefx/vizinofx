import type { MetaFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";

import Guide from "~/components/Guide";
import Logo from "~/components/Logo";
import { getSupabaseClient } from "~/utils/getSupabaseClient";

export async function loader() {
  let isSupabaseAvailable = true;

  try {
    getSupabaseClient();
  } catch (error) {
    isSupabaseAvailable = false;
  }

  if (isSupabaseAvailable) {
    return redirect("/login");
  }

  return Response.json({});
}

export const meta: MetaFunction = () => {
  return [
    { title: "New Remix App" },
    { name: "description", content: "Welcome to Remix!" },
  ];
};

export default function Index() {
  return (
    <>
      <nav className="flex justify-center w-full px-4 pt-8">
        <Logo />
      </nav>
      <main className="grow">
        <Guide />
      </main>
      <footer className="w-full px-4 pb-8 mx-auto max-w-7xl">
        <p className="text-sm text-center">
          &copy; {new Date().getFullYear()} Netlify. All rights reserved.
        </p>
      </footer>
    </>
  );
}
