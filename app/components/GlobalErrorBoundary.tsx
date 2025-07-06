import { isRouteErrorResponse, useRouteError } from "@remix-run/react";

export function GlobalErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <div className="px-8 py-10 space-y-4 border rounded-sm shadow-sm border-cyan-500 bg-cyan-100/20">
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl lg:text-4xl">
          {error.status} {error.statusText}
        </h1>
        <p>{error.data}</p>
      </div>
    );
  } else if (error instanceof Error) {
    return (
      <div className="px-8 py-10 space-y-4 border rounded-sm shadow-sm border-cyan-500 bg-cyan-100/20">
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl lg:text-4xl">
          Error
        </h1>
        <p>{error.message}</p>
        <p>The stack trace is:</p>
        <pre>{error.stack}</pre>
      </div>
    );
  } else {
    return (
      <div className="px-8 py-10 space-y-4 border rounded-sm shadow-sm border-cyan-500 bg-cyan-100/20">
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl lg:text-4xl">
          Unknown Error
        </h1>
      </div>
    );
  }
}
