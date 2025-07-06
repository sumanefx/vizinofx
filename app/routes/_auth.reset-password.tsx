import type { MetaFunction } from "@remix-run/node";
import { Form } from "@remix-run/react";

import Button from "~/components/Button";
import TextField from "~/components/TextField";

export const meta: MetaFunction = () => {
  return [
    {
      title: "Reset password | Remix Dashboard",
    },
  ];
};

export default function ResetPassword() {
  return (
    <div className="w-full max-w-2xl px-8 py-10 space-y-8 bg-white shadow-md rounded-xl lg:space-y-10 lg:px-10 lg:py-12 ">
      <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl lg:text-4xl">
        Forgot your password?
      </h1>
      <Form method="POST" className="w-full space-y-4 lg:space-y-6">
        <TextField
          id="email"
          name="email"
          label="Email address"
          required
          type="email"
          placeholder="Email address"
        />
        <Button type="submit" className="w-full">
          Reset Password
        </Button>
      </Form>
    </div>
  );
}
