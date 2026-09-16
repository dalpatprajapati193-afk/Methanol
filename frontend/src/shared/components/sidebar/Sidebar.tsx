"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Globe,
  GitBranch,
  Zap,
  Boxes,
  Shield,
  LayoutGrid,
  Database,
  Settings,
  BarChart2,
  FileText,
  Users,
  Lock,
  Home,
  Activity,
  Layers,
  Server,
  Monitor,
  Cpu,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Telescope,
  MonitorCog,
  Computer
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import React from "react";

/** Map of Lucide icon name strings → components. Extend as needed. */
const ICON_MAP: Record<string, LucideIcon> = {
  Globe,
  GitBranch,
  Zap,
  Boxes,
  Shield,
  LayoutGrid,
  Database,
  Settings,
  BarChart2,
  FileText,
  Users,
  Lock,
  Home,
  Activity,
  Layers,
  Server,
  Monitor,
  Cpu,
  LayoutDashboard,
  Telescope,
  MonitorCog,
  Computer
};

type SidebarNavItem = {
  title: string;
  url: string;
  icon: string | null;
};

type Props = {
  navItems: SidebarNavItem[];
  showAdmin: boolean;
};

export default function Sidebar({ navItems, showAdmin }: Props) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = React.useState(true);

  return (
    <aside className={`flex flex-col h-full bg-surface border-r border-border shrink-0 transition-all duration-300 ease-in-out ${isCollapsed ? "w-[68px]" : "w-[20%] min-w-[220px] max-w-[280px]"}`}>

      {/* Brand */}
      <div className={`h-16 w-full shrink-0 flex items-center gap-2.5 border-b border-border shadow-sm overflow-hidden ${isCollapsed ? "px-2.5 justify-center" : "px-5"}`}>
        <div
          className="w-8 h-8 rounded-lg border border-accent-blue flex items-center justify-center shrink-0 overflow-hidden cursor-pointer hover:bg-accent-blue/10 transition-colors"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title="Toggle Sidebar"
        >
          <Image src="/favicon.ico" alt="Ingenero logo" width={24} height={24} />
        </div>
        {!isCollapsed && (
          <div>
            <p className="text-sm font-semibold text-text-primary leading-tight whitespace-nowrap">
              I360
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className={`flex-1 w-full flex flex-col py-4 overflow-hidden ${isCollapsed ? "px-3" : "px-5"}`}>
        <nav className="flex-1 flex flex-col gap-1 overflow-y-auto overflow-x-hidden">
          {!isCollapsed && (
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-widest px-2 mb-2 whitespace-nowrap">
              Navigation
            </p>
          )}

          {navItems.length === 0 && !isCollapsed && (
            <p className="text-xs text-text-secondary px-2 whitespace-nowrap">No menu items available.</p>
          )}

          {navItems.map(({ title, url, icon }) => {
            const isActive = pathname === url || pathname.startsWith(url + "/");
            const Icon: LucideIcon = ICON_MAP[icon ?? ""] ?? LayoutDashboard;
            return (
              <Link
                key={url}
                href={url}
                onClick={() => setIsCollapsed(true)}
                title={isCollapsed ? title : undefined}
                className={[
                  "flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap",
                  isCollapsed ? "px-0 justify-center" : "px-3",
                  isActive
                    ? "bg-accent-blue text-white shadow-sm"
                    : "text-text-secondary hover:bg-surface-hover hover:text-text-primary",
                ].join(" ")}
              >
                <Icon size={17} className="shrink-0" />
                {!isCollapsed && <span>{title}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Admin link (conditionally shown) */}
        {showAdmin && (
          <div className="mt-auto mb-2">
            <Link
              href="/admin"
              onClick={() => setIsCollapsed(true)}
              title={isCollapsed ? "Security & Admin" : undefined}
              className={[
                "flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap",
                isCollapsed ? "px-0 justify-center" : "px-3",
                pathname.startsWith("/admin")
                  ? "bg-accent-blue/10 text-accent-blue shadow-sm"
                  : "text-text-secondary hover:bg-surface-hover hover:text-text-primary",
              ].join(" ")}
            >
              <Shield size={17} className="shrink-0" />
              {!isCollapsed && <span>Security &amp; Admin</span>}
            </Link>
          </div>
        )}

        {/* Toggle Collapse */}
        <div className={`mb-3 ${!showAdmin ? "mt-auto" : ""}`}>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            className={[
              "w-full flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 text-text-secondary hover:bg-surface-hover hover:text-text-primary whitespace-nowrap",
              isCollapsed ? "px-0 justify-center" : "px-3"
            ].join(" ")}
          >
            {isCollapsed ? (
              <PanelLeftOpen size={17} className="shrink-0" />
            ) : (
              <PanelLeftClose size={17} className="shrink-0" />
            )}
            {!isCollapsed && <span>Collapse</span>}
          </button>
        </div>

        {/* Footer */}
        <div className={`pt-3 border-t border-border overflow-hidden ${isCollapsed ? "text-center" : ""}`}>
          <p className="text-xs text-text-secondary whitespace-nowrap">
            {isCollapsed ? "©" : `© ${new Date().getFullYear()} Ingenero`}
          </p>
        </div>
      </div>
    </aside>
  );
}
