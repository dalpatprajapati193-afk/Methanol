"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, Users, LockKeyhole, LayoutGrid } from "lucide-react";

export default function AdminTabs() {
  const pathname = usePathname();

  const tabs = [
    { label: "Security Groups", href: "/admin/groups", icon: Shield },
    { label: "User Mappings", href: "/admin/mappings", icon: Users },
    { label: "Resources", href: "/admin/resources", icon: LayoutGrid },
    { label: "Access Control Entries", href: "/admin/access-control", icon: LockKeyhole },
  ];

  return (
    <div className="flex items-center gap-6">
      {tabs.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={[
              "flex items-center gap-2 pb-3 border-b-2 transition-colors",
              isActive
                ? "border-accent-blue text-accent-blue"
                : "border-transparent text-text-secondary hover:text-text-primary hover:border-border",
            ].join(" ")}
          >
            <Icon size={16} />
            <span className="text-sm font-medium">{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
