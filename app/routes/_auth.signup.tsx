import type { MetaFunction } from "@remix-run/node";
import { Form, Link, useNavigation, useSearchParams } from "@remix-run/react";

import Button from "~/components/Button";
import TextField from "~/components/TextField";

export const meta: MetaFunction = () => {
  return [
    {
      title: "Sign Up | Remix Dashboard",
    },
  ];
};

export default function SignUp() {
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();

  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="w-full max-w-2xl px-8 py-10 space-y-8 bg-white shadow-md rounded-xl lg:space-y-10 lg:px-10 lg:py-12 ">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl lg:text-4xl">
          Sign Up for Remix Dashboard
        </h1>
        <p className="text-sm">
          Already have an account?{" "}
          <Link
            className="underline text-cyan-600"
            to={{
              pathname: "/login",
              search: searchParams.toString(),
            }}
          >
            Sign in
          </Link>
        </p>
      </div>
      <Form method="POST">
        <fieldset
          className="w-full space-y-4 lg:space-y-6 disabled:opacity-70"
          disabled={isSubmitting}
        >
          <TextField
            id="name"
            name="name"
            label="Name"
            required
            type="text"
            placeholder="Name Surname"
          />
          <TextField
            id="password"
            name="password"
            label="Password"
            required
            type="password"
            placeholder="password"
          />
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Login
          </Button>
        </fieldset>
      </Form>
    </div>
  );
}
