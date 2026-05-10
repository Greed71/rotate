import { DEPLOY_TARGETS, type DeployTarget } from "../../secretDestinations";

type Props = {
  selected: string[];
  onToggle: (target: DeployTarget) => void;
};

export function DeployTargetsPicker({ selected, onToggle }: Props) {
  return (
    <div className="flex flex-wrap gap-2 text-xs text-ink">
      {DEPLOY_TARGETS.map((target) => (
        <label key={target} className="flex items-center gap-1.5 rounded-lg border border-surface-3 px-2 py-1">
          <input
            type="checkbox"
            checked={selected.includes(target)}
            onChange={() => onToggle(target)}
          />
          <span>{target}</span>
        </label>
      ))}
    </div>
  );
}
