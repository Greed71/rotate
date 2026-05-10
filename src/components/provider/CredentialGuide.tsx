import type { ReactNode } from "react";

type GuideLink = {
  href: string;
  label: string;
};

type Props = {
  title?: string;
  steps: ReactNode[];
  links: GuideLink[];
};

export function CredentialGuide({ title = "Dove prendo queste credenziali?", steps, links }: Props) {
  return (
    <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 text-xs leading-relaxed text-ink-muted">
      <p className="font-semibold text-ink">{title}</p>
      <ol className="mt-2 list-decimal space-y-1.5 pl-4">
        {steps.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap gap-3">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-accent hover:underline"
          >
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}
