import { Link } from "@remix-run/react";

const Logo = () => {
  return (
    <Link to="/" className="flex items-center gap-3">
      <svg
        width="40"
        height="40"
        viewBox="0 0 40 40"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M20 0C8.9543 0 0 8.82745 0 19.7167C11.0457 19.7167 20 10.8892 20 0Z"
          fill="#CEFAFE"
        />
        <path
          d="M20 39.4333C31.0457 39.4333 40 30.6059 40 19.7167C28.9543 19.7167 20 28.5441 20 39.4333Z"
          fill="#CEFAFE"
        />
        <path
          d="M20 0C31.0457 0 40 8.82745 40 19.7167C28.9543 19.7167 20 10.8892 20 0Z"
          fill="#53EAFD"
        />
        <path
          d="M20 39.4333C8.9543 39.4333 -9.65645e-07 30.6059 0 19.7167C11.0457 19.7167 20 28.5441 20 39.4333Z"
          fill="#53EAFD"
        />
      </svg>
      <span className="text-xl text-slate-900 font-semibold uppercase">
        Remix Admin
      </span>
    </Link>
  );
};
export default Logo;
