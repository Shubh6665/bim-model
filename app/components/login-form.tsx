"use client";
import { useState } from "react";
import { useAuth } from "@/app/hooks/use-auth";

export function LoginForm() {
  const { login, isLoading } = useAuth();
  const [clicked, setClicked] = useState(false);

  const handleGoogleLogin = async () => {
    setClicked(true);
    await login();
    setClicked(false);
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-2xl border-0 flex flex-col items-center justify-center py-12 px-8 min-h-[480px]">
      {/* Logo */}
      <div className="mb-6 flex flex-col items-center">
        <span className="text-3xl font-bold text-black mb-2">Logo</span>
      </div>
      {/* Heading */}
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Sign into your account
      </h2>
      {/* Google Button */}
      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={isLoading}
        className={`w-full flex items-center justify-center gap-3 h-12 bg-black text-white rounded-md font-semibold text-lg shadow transition-colors mb-8 mt-6 focus:outline-none focus:ring-2 focus:ring-black/20 ${
          isLoading
            ? "cursor-not-allowed opacity-70"
            : "hover:bg-gray-900 cursor-pointer"
        }`}
      >
        <svg className="h-5 w-5" viewBox="0 0 48 48">
          <g>
            <path
              fill="#4285F4"
              d="M24 9.5c3.54 0 6.7 1.22 9.19 3.23l6.85-6.85C35.64 2.09 30.13 0 24 0 14.82 0 6.73 5.48 2.69 13.44l7.98 6.2C12.13 13.09 17.62 9.5 24 9.5z"
            />
            <path
              fill="#34A853"
              d="M46.1 24.55c0-1.64-.15-3.22-.42-4.74H24v9.01h12.42c-.54 2.9-2.18 5.36-4.66 7.01l7.19 5.6C43.98 37.09 46.1 31.27 46.1 24.55z"
            />
            <path
              fill="#FBBC05"
              d="M10.67 28.65A14.5 14.5 0 019.5 24c0-1.62.28-3.19.77-4.65l-7.98-6.2A23.97 23.97 0 000 24c0 3.77.9 7.34 2.49 10.49l8.18-5.84z"
            />
            <path
              fill="#EA4335"
              d="M24 48c6.13 0 11.28-2.03 15.04-5.52l-7.19-5.6c-2.01 1.35-4.59 2.15-7.85 2.15-6.38 0-11.87-3.59-14.33-8.69l-8.18 5.84C6.73 42.52 14.82 48 24 48z"
            />
            <path fill="none" d="M0 0h48v48H0z" />
          </g>
        </svg>
        {isLoading ? (
          <>
            <svg
              className="animate-spin h-5 w-5 mr-1 text-white"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            Signing in...
          </>
        ) : (
          "Sign in with Google"
        )}
      </button>
      {/* Terms and Privacy */}
      <div className="mt-8 text-xs text-gray-600 text-center max-w-xs">
        <span>
          By signing in, you agree to our
          <a
            href="/terms"
            className="text-black underline hover:text-blue-700 mx-1"
          >
            Terms of Service
          </a>
          and
          <a
            href="/privacy"
            className="text-black underline hover:text-blue-700 mx-1"
          >
            Privacy Policy
          </a>
          .
        </span>
        <div className="mt-2 text-gray-500">
          We value your privacy and use your information only to provide a
          secure and personalized experience. If you have any questions, feel
          free to contact our support team.
        </div>
      </div>
    </div>
  );
}
