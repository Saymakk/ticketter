import { Suspense } from "react";
import { AuthForm } from "@/components/healthy-life/AuthForm";

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="p-6 text-[var(--muted)]">Загрузка…</p>}>
      <AuthForm mode="login" />
    </Suspense>
  );
}
