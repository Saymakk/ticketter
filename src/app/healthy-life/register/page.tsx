import { Suspense } from "react";
import { AuthForm } from "@/components/healthy-life/AuthForm";

export default function RegisterPage() {
  return (
    <Suspense fallback={<p className="p-6 text-[var(--muted)]">Загрузка…</p>}>
      <AuthForm mode="register" />
    </Suspense>
  );
}
