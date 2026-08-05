"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocaleContext } from "@/components/locale-provider";
import { trackedFetch } from "@/lib/http/tracked-fetch";
import {
  AppCard,
  AppShell,
  PageHeaderWithBack,
  btnSecondary,
  ListLoading,
} from "@/components/ui/app-shell";

type UserRow = {
  id: string;
  email: string | null;
  phone: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  name: string | null;
  dailyCalorieGoal: number | null;
  targetWeightKg: number | null;
  heightCm: number | null;
  latestWeightKg: number | null;
  latestWeightDate: string | null;
  counts: {
    meals: number;
    weights: number;
    workouts: number;
    medicationPlans: number;
    medicationIntakes: number;
    advice: number;
    aiRecords: number;
  };
};

function formatDate(value: string | null, locale: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(locale === "en" ? "en-US" : locale === "kk" ? "kk-KZ" : "ru-RU");
}

function loginLabel(user: UserRow) {
  return user.email ?? user.phone ?? "—";
}

export default function HealthyLifeUsersPage() {
  const { t, locale } = useLocaleContext();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      const res = await trackedFetch("/api/super-admin/healthy-life/users", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? t("super.healthyLife.loadError"));
        setUsers([]);
        return;
      }
      setUsers(json.users ?? []);
    } catch {
      setError(t("super.healthyLife.networkError"));
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load
  }, []);

  return (
    <AppShell maxWidth="max-w-6xl">
      <PageHeaderWithBack
        backHref="/super-admin/external-projects"
        backLabel={t("super.healthyLife.backToProjects")}
        title={t("super.healthyLife.title")}
      />
      <AppCard>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">{t("super.healthyLife.subtitle")}</p>
          <button type="button" onClick={() => void loadUsers()} className={btnSecondary}>
            {t("super.healthyLife.refresh")}
          </button>
        </div>

        {error ? (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        {loading ? (
          <ListLoading label={t("common.loading")} className="py-8" />
        ) : users.length === 0 ? (
          <p className="text-sm text-slate-600">{t("super.healthyLife.listEmpty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2 font-semibold">{t("super.healthyLife.colName")}</th>
                  <th className="px-2 py-2 font-semibold">{t("super.healthyLife.colLogin")}</th>
                  <th className="px-2 py-2 font-semibold">{t("super.healthyLife.colRegistered")}</th>
                  <th className="px-2 py-2 font-semibold">{t("super.healthyLife.colLastSignIn")}</th>
                  <th className="px-2 py-2 font-semibold">{t("super.healthyLife.colStats")}</th>
                  <th className="px-2 py-2 font-semibold">{t("super.healthyLife.colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-slate-100 align-top">
                    <td className="px-2 py-3">
                      <p className="font-medium text-slate-900">{user.name ?? t("super.healthyLife.noProfile")}</p>
                      {user.heightCm != null || user.targetWeightKg != null ? (
                        <p className="mt-1 text-xs text-slate-500">
                          {user.heightCm != null
                            ? t("super.healthyLife.heightShort", { value: user.heightCm })
                            : null}
                          {user.heightCm != null && user.targetWeightKg != null ? " · " : null}
                          {user.targetWeightKg != null
                            ? t("super.healthyLife.targetWeightShort", { value: user.targetWeightKg })
                            : null}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-2 py-3 text-slate-700">{loginLabel(user)}</td>
                    <td className="px-2 py-3 text-slate-600">{formatDate(user.createdAt, locale)}</td>
                    <td className="px-2 py-3 text-slate-600">{formatDate(user.lastSignInAt, locale)}</td>
                    <td className="px-2 py-3 text-xs text-slate-600">
                      <p>{t("super.healthyLife.statMeals", { count: user.counts.meals })}</p>
                      <p>{t("super.healthyLife.statWeights", { count: user.counts.weights })}</p>
                      <p>{t("super.healthyLife.statWorkouts", { count: user.counts.workouts })}</p>
                      {user.latestWeightKg != null ? (
                        <p className="mt-1 text-slate-500">
                          {t("super.healthyLife.latestWeight", {
                            value: user.latestWeightKg,
                            date: user.latestWeightDate ?? "—",
                          })}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-2 py-3">
                      <Link
                        href={`/super-admin/healthy-life/users/${user.id}`}
                        className="text-sm font-medium text-teal-700 hover:text-teal-900"
                      >
                        {t("super.healthyLife.viewDetails")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AppCard>
    </AppShell>
  );
}
