import type { EgConfigData } from "../store/Types";

// Build the equipment process-flow node list from the current config.
function buildNodes(config: EgConfigData): string[] {
  const nodes: string[] = ["Stripping Column"];

  if (config.eq_hasGFS === "yes" && config.eq_gfsArrangement === "Integrated Single Column") {
    nodes.push("Integrated Reab/GFS");
  } else {
    nodes.push("Reabsorber");
    if (config.eq_hasGFS === "yes") nodes.push("Glycol Feed Stripper");
  }

  nodes.push("Feed Preheat Train", "Glycol Reactor", "Evaporation System");

  if (config.oe_hasOther === "yes") nodes.push("Other Equipment");

  return nodes;
}

// Coarse, structural state rule keyed to the current phase / equipment leaf.
function nodeState(
  phaseNum: number,
  isEquipmentDetail: boolean,
  isEquipmentSelect: boolean,
  index: number,
): "active" | "completed" | "default" {
  if (phaseNum >= 2) return "completed"; // past Plant config
  if (isEquipmentDetail) return "active"; // whole present chain active
  if (isEquipmentSelect) return index === 0 ? "active" : "default"; // Stripping Column only
  return "default";
}

export default function BlockDiagram({
  config,
  phaseNum,
  isEquipmentSelect,
  isEquipmentDetail,
}: {
  config: EgConfigData;
  phaseNum: number;
  isEquipmentSelect: boolean;
  isEquipmentDetail: boolean;
}) {
  const nodes = buildNodes(config);

  return (
    <div>
      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
        Block Diagram
      </p>
      <div className="flex flex-col items-stretch">
        {nodes.map((node, i) => {
          const state = nodeState(phaseNum, isEquipmentDetail, isEquipmentSelect, i);
          return (
            <div key={node}>
              <div
                className={[
                  "rounded-md border px-3 py-2 text-xs font-medium text-center",
                  state === "active"
                    ? "bg-accent-blue-light border-accent-blue text-accent-blue"
                    : state === "completed"
                    ? "bg-accent-green-light border-accent-green text-accent-green"
                    : "bg-surface border-border text-text-secondary",
                ].join(" ")}
              >
                {node}
              </div>
              {i < nodes.length - 1 && (
                <div className="text-center text-text-secondary text-xs leading-tight py-0.5">
                  ↓
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
