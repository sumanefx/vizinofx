import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    {
      title: "User | Remix Dashboard",
    },
  ];
};

export default function User() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900 lg:text-3xl">
        User Details
      </h1>
      <div className="flex flex-col overflow-hidden bg-white shadow-md rounded-xl md:flex-row">
        <div className="flex flex-col w-full px-8 py-10 bg-slate-50 md:basis-1/3 md:items-center lg:py-12">
          <img
            className="object-cover w-20 h-20 rounded-full ring-2 ring-cyan-300 lg:w-28 lg:h-28"
            src="/user.jpg"
            alt="Thomas Radcliffe"
          />
        </div>
        <div className="px-8 py-10 md:basis-2/3 lg:px-10 lg:py-12">
          <div className="mb-6 space-y-1">
            <p className="text-sm">Name</p>
            <p className="font-medium">Thomas Radcliffe</p>
          </div>
          <div className="mb-6 space-y-1 overflow-hidden">
            <p className="text-sm">Email</p>
            <p className="font-medium truncate">radcliffe@demoemail.com</p>
          </div>
          <div className="mb-6 space-y-1">
            <p className="text-sm">Description</p>
            <p className="font-medium">Thomas Radcliffe is a seasoned Database Administrator (DBA) with five years of experience, specializing in Supabase, PostgreSQL, and cloud-based database management. With a strong background in Remix and Netlify integrations, he helps developers build scalable, high-performance web applications with seamless database connectivity.</p>
          </div>
        </div>
      </div>
    </>
  );
}
