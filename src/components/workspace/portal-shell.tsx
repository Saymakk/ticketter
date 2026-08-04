import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

/** Portal shell with system light/dark tokens (independent from Ticketter admin chrome). */
export default function WorkspacePortalShell({ children }: Props) {
  return (
    <div className="workspace-portal min-h-full">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-[var(--ws-glow-a)] blur-3xl" />
        <div className="absolute -right-16 bottom-10 h-80 w-80 rounded-full bg-[var(--ws-glow-b)] blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, var(--ws-dot) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
      </div>
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        {children}
      </div>
    </div>
  );
}
