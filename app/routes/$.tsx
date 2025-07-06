import { Link } from "@remix-run/react";

export default function PrivateNotFound() {
  return (
    <main className="grow px-8 py-12 flex items-center justify-center">
      <div className="px-8 py-10 space-y-4 border rounded-sm shadow-sm border-cyan-500 bg-cyan-100/20 w-full max-w-4xl text-center">
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl lg:text-4xl">
          Page Not Found
        </h1>
        <p>The page you’re looking for doesn’t exist.</p>
        <Link to="/" className="underline text-cyan-600">
          Go back home
        </Link>
      </div>
    </main>
  );
}