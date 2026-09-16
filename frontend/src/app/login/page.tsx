"use client";
import { useState } from "react";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { signInAction, devBypassAction } from "./actions/LoginAction";
import Image from "next/image";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    await signInAction();
  };

  const handleDevBypass = async () => {
    setIsLoading(true);
    await devBypassAction();
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-background text-text-primary selection:bg-accent-blue/20 overflow-hidden">

      {/* Dynamic background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-accent-blue/5 rounded-full filter blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-accent-green/5 rounded-full filter blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md p-6 relative z-10 animate-fade-in">

        {/* Central Auth Card */}
        <div className="bg-surface/60 backdrop-blur-xl border border-border rounded-2xl p-8 shadow-2xl flex flex-col items-center text-center">

          {/* Brand Icon */}
          <div className="w-14 h-14">
            <Image src="/favicon.ico" alt="Ingenero logo" width={64} height={64} />
          </div>

          {/* Heading */}
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            Sign in to i360
          </h1>

          {/* Login button container */}
          <div className="w-full mt-8 flex flex-col gap-3">
            <button
              onClick={handleLogin}
              disabled={isLoading}
              className={[
                "w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-border bg-background hover:bg-surface-hover hover:border-accent-blue text-sm font-semibold text-text-primary transition-all duration-150 active:scale-98 shadow-sm group",
                isLoading ? "opacity-70 cursor-not-allowed" : "cursor-pointer"
              ].join(" ")}
            >
              {isLoading ? (
                /* Spinner */
                <div className="w-5 h-5 rounded-full border-2 border-text-secondary border-t-transparent animate-spin" />
              ) : (
                /* Microsoft Logo Vector representation */
                <div className="grid grid-cols-2 gap-0.5 w-4 h-4 shrink-0">
                  <div className="bg-[#f25022] w-1.5 h-1.5" />
                  <div className="bg-[#7fba00] w-1.5 h-1.5" />
                  <div className="bg-[#00a4ef] w-1.5 h-1.5" />
                  <div className="bg-[#ffb900] w-1.5 h-1.5" />
                </div>
              )}
              <span>{isLoading ? "Redirecting..." : "Sign in with Entra ID"}</span>
              {!isLoading && (
                <ArrowRight size={14} className="text-text-secondary group-hover:translate-x-0.5 group-hover:text-accent-blue transition-all" />
              )}
            </button>

            {/* SSO Dev Bypass Button */}
            <button
              onClick={handleDevBypass}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border bg-surface hover:bg-surface-hover hover:border-accent-green text-xs font-semibold text-text-secondary hover:text-text-primary transition-all duration-150 active:scale-98 cursor-pointer disabled:opacity-50"
            >
              <span>Bypass SSO (Local Dev Mode)</span>
            </button>
          </div>

          {/* Policy / Trust footer */}
          <div className="flex items-center gap-1.5 mt-8 text-[11px] text-text-secondary">
            <ShieldCheck size={13} className="text-accent-green" />
            <span>Single Sign-On secured by Microsoft Entra ID</span>
          </div>

        </div>

        {/* Global Copyright */}
        <p className="text-center text-xs text-text-secondary mt-6">
          © {new Date().getFullYear()} Ingenero. All rights reserved.
        </p>

      </div>
    </div>
  );
}
