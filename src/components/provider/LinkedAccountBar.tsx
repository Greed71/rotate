import type { ReactNode } from "react";

type Props = {
  details: ReactNode;
  actions: ReactNode;
};

export function LinkedAccountBar({ details, actions }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-surface-3/80 bg-surface-1/80 px-5 py-4">
      <div>{details}</div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}
