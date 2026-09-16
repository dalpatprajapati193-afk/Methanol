import { LogOut, User, Activity } from "lucide-react";
import { signOutAction } from "@/app/login/actions/LogoutAction";
import { auth } from "@/auth";
import Image from "next/image";

export default async function Header() {
  const session = await auth();


  return (
    <header className="flex items-center justify-between px-6 py-4 bg-surface border-b border-border h-16 shrink-0 shadow-sm">
      {/* Brand/System Status */}
      <div className="flex items-center gap-2">

      </div>

      {/* User Actions */}
      <div className="flex items-center gap-4">
        {/* User profile capsule */}
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-background border border-border">
          <div className="w-6 h-6 rounded-full bg-accent-blue/10 flex items-center justify-center text-accent-blue text-xs font-bold border border-accent-blue/20">
            {session?.user?.image ? (
              <Image src={session.user.image} height={30} width={30} alt={session.user.name || "User"} className="w-full h-full rounded-full" />
            ) : (
              <User size={14} />
            )}
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs font-semibold text-text-primary leading-tight capitalize">
              {session?.user?.name || "Unknown User"}
            </span>
            <span className="text-[10px] text-text-secondary leading-none">
              {session?.user?.email || ""}
            </span>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={signOutAction}
          className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-text-secondary hover:text-accent-red hover:bg-accent-red/5 rounded-lg border border-border hover:border-accent-red/20 shadow-sm bg-background"
          title="Sign out of i360"
        >
          <LogOut size={14} />
        </button>
      </div>
    </header>
  );
}
