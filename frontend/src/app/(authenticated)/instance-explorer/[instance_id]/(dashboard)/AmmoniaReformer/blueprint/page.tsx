"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSetAtom } from "jotai";
import { loadDefaultBlueprintAtom } from "../store/Index";
import { BlueprintTab } from "../components/Index";
import { SYSTEM_NAME, formatSystemName } from "../Constants";

export default function BlueprintAdminPage() {
  const { instance_id } = useParams<{ instance_id: string }>();
  const loadDefaultBlueprint = useSetAtom(loadDefaultBlueprintAtom);

  useEffect(() => {
    loadDefaultBlueprint();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* Admin info bar */}
      <div className="bg-surface border-b border-border px-5 h-9 flex items-center gap-2 shrink-0">
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-surface border border-border rounded-full text-[11px] text-accent-orange">
          Admin · Blueprint Editor
        </span>
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-surface border border-border rounded-full text-[11px] text-text-secondary">
          System:&nbsp;<strong className="text-text-primary font-semibold">{formatSystemName(SYSTEM_NAME)}</strong>
        </span>

        <Link
          href={`/instance-explorer/${instance_id}/AmmoniaReformer`}
          className="ml-auto inline-flex items-center gap-1 px-2.5 py-0.5 border border-border rounded-full text-[11px] text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
        >
          ← Back to Config
        </Link>
      </div>

      {/* Blueprint editor */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <BlueprintTab />
      </div>

    </div>
  );
}
