import type { PrismaClient } from "@prisma/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { phoneFromAuthEmail, tryNormalizePhone } from "../auth/phone";

export const HL_BOT_ADMIN_EMAIL = "vladsarana@gmail.com";
export const HL_BOT_ADMIN_PHONE = "77051617778";

const profileCountSelect = {
  meals: true,
  weights: true,
  workouts: true,
  medicationPlans: true,
  medicationIntakes: true,
  advice: true,
  aiRecords: true,
} as const;

export type BotAdminUserRow = {
  profileId: string;
  userId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  telegramChatId: string | null;
  botLoggedOut: boolean;
  accessEnabled: boolean;
  adminNote: string | null;
  preferredLocale: string;
  createdAt: Date;
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

export type BotAdminActivityItem =
  | { kind: "meal"; id: string; profileId: string; userName: string; date: string; label: string; photoPath: string | null; at: Date }
  | { kind: "med-intake"; id: string; profileId: string; userName: string; date: string; label: string; photoPath: string | null; at: Date };

function adminEmails(): string[] {
  const raw = process.env.HEALTHY_LIFE_BOT_ADMIN_EMAILS;
  const list = raw ? raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) : [];
  if (!list.includes(HL_BOT_ADMIN_EMAIL)) list.push(HL_BOT_ADMIN_EMAIL);
  return list;
}

function adminPhones(): string[] {
  const raw = process.env.HEALTHY_LIFE_BOT_ADMIN_PHONES;
  const list = raw ? raw.split(",").map((s) => s.replace(/\D/g, "")).filter(Boolean) : [];
  if (!list.includes(HL_BOT_ADMIN_PHONE)) list.push(HL_BOT_ADMIN_PHONE);
  return list;
}

export async function isBotAdmin(
  profileId: string,
  prisma: PrismaClient,
  supabase: SupabaseClient,
): Promise<boolean> {
  const profile = await prisma.profile.findUnique({ where: { id: profileId } });
  if (!profile) return false;

  const phones = adminPhones();
  if (profile.phone && phones.includes(profile.phone)) return true;

  if (!profile.userId) return false;
  const { data } = await supabase.auth.admin.getUserById(profile.userId);
  const email = data?.user?.email?.toLowerCase() ?? null;
  if (email && adminEmails().includes(email)) return true;

  const fromEmail = phoneFromAuthEmail(email);
  if (fromEmail && phones.includes(fromEmail)) return true;

  return false;
}

async function authEmailForProfile(
  profile: { userId: string | null; phone: string | null },
  supabase: SupabaseClient,
): Promise<string | null> {
  if (!profile.userId) return null;
  const { data } = await supabase.auth.admin.getUserById(profile.userId);
  const email = data?.user?.email ?? null;
  if (!email || email.endsWith("@ticketter.local")) {
    return profile.phone ? `+${profile.phone}` : phoneFromAuthEmail(email) ? `+${phoneFromAuthEmail(email)}` : null;
  }
  return email;
}

export async function mapProfileToAdminRow(
  profile: {
    id: string;
    userId: string | null;
    name: string;
    phone: string | null;
    telegramChatId: string | null;
    botLoggedOut: boolean;
    accessEnabled: boolean;
    adminNote: string | null;
    preferredLocale: string;
    createdAt: Date;
    _count: Record<string, number>;
  },
  supabase: SupabaseClient,
): Promise<BotAdminUserRow> {
  return {
    profileId: profile.id,
    userId: profile.userId,
    name: profile.name,
    email: await authEmailForProfile(profile, supabase),
    phone: profile.phone,
    telegramChatId: profile.telegramChatId,
    botLoggedOut: profile.botLoggedOut,
    accessEnabled: profile.accessEnabled,
    adminNote: profile.adminNote,
    preferredLocale: profile.preferredLocale,
    createdAt: profile.createdAt,
    counts: {
      meals: profile._count.meals ?? 0,
      weights: profile._count.weights ?? 0,
      workouts: profile._count.workouts ?? 0,
      medicationPlans: profile._count.medicationPlans ?? 0,
      medicationIntakes: profile._count.medicationIntakes ?? 0,
      advice: profile._count.advice ?? 0,
      aiRecords: profile._count.aiRecords ?? 0,
    },
  };
}

export async function listBotAdminUsers(
  prisma: PrismaClient,
  supabase: SupabaseClient,
  page: number,
  pageSize: number,
): Promise<{ rows: BotAdminUserRow[]; total: number }> {
  const total = await prisma.profile.count();
  const profiles = await prisma.profile.findMany({
    orderBy: { createdAt: "desc" },
    skip: page * pageSize,
    take: pageSize,
    include: { _count: { select: profileCountSelect } },
  });
  const rows = await Promise.all(profiles.map((p) => mapProfileToAdminRow(p, supabase)));
  return { rows, total };
}

export async function searchBotAdminUsers(
  prisma: PrismaClient,
  supabase: SupabaseClient,
  query: string,
  limit = 12,
): Promise<BotAdminUserRow[]> {
  const q = query.trim();
  if (!q) return [];

  const phone = tryNormalizePhone(q);
  const profiles = await prisma.profile.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        ...(phone ? [{ phone: { contains: phone } }] : []),
        ...(phone ? [{ phone: { contains: phone.slice(-10) } }] : []),
      ],
    },
    take: limit,
    include: { _count: { select: profileCountSelect } },
  });

  const rows = await Promise.all(profiles.map((p) => mapProfileToAdminRow(p, supabase)));

  if (q.includes("@")) {
    const authUsers = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const users = authUsers.data?.users ?? [];
    const matchIds = users
      .filter((u) => u.email?.toLowerCase().includes(q.toLowerCase()))
      .map((u) => u.id);
    if (matchIds.length > 0) {
      const extra = await prisma.profile.findMany({
        where: { userId: { in: matchIds } },
        include: { _count: { select: profileCountSelect } },
      });
      for (const p of extra) {
        if (!rows.some((r) => r.profileId === p.id)) {
          rows.push(await mapProfileToAdminRow(p, supabase));
        }
      }
    }
  }

  return rows.slice(0, limit);
}

export async function getBotAdminUser(
  prisma: PrismaClient,
  supabase: SupabaseClient,
  profileId: string,
) {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    include: {
      _count: { select: profileCountSelect },
      meals: { orderBy: { createdAt: "desc" }, take: 5, select: { id: true, date: true, name: true, calories: true, photoPath: true, createdAt: true } },
      medicationIntakes: { orderBy: { createdAt: "desc" }, take: 5, select: { id: true, date: true, name: true, dosage: true, photoPath: true, createdAt: true } },
    },
  });
  if (!profile) return null;
  const row = await mapProfileToAdminRow(profile, supabase);
  return { row, profile };
}

export async function listRecentActivity(
  prisma: PrismaClient,
  page: number,
  pageSize: number,
): Promise<{ items: BotAdminActivityItem[]; hasMore: boolean }> {
  const take = pageSize + 1;
  const skip = page * pageSize;

  const [meals, intakes] = await Promise.all([
    prisma.meal.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: { profile: { select: { id: true, name: true } } },
    }),
    prisma.medicationIntake.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: { profile: { select: { id: true, name: true } } },
    }),
  ]);

  const merged: BotAdminActivityItem[] = [
    ...meals.map((m) => ({
      kind: "meal" as const,
      id: m.id,
      profileId: m.profileId,
      userName: m.profile.name,
      date: m.date,
      label: `${m.name} · ${Math.round(m.calories)} kcal`,
      photoPath: m.photoPath,
      at: m.createdAt,
    })),
    ...intakes.map((i) => ({
      kind: "med-intake" as const,
      id: i.id,
      profileId: i.profileId,
      userName: i.profile.name,
      date: i.date,
      label: `${i.name}${i.dosage ? ` (${i.dosage})` : ""}`,
      photoPath: i.photoPath,
      at: i.createdAt,
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const slice = merged.slice(0, pageSize);
  return { items: slice, hasMore: merged.length > pageSize };
}

export async function listUserMeals(prisma: PrismaClient, profileId: string, page: number, pageSize: number) {
  const total = await prisma.meal.count({ where: { profileId } });
  const meals = await prisma.meal.findMany({
    where: { profileId },
    orderBy: { createdAt: "desc" },
    skip: page * pageSize,
    take: pageSize,
  });
  return { meals, total };
}

export async function listUserMedIntakes(prisma: PrismaClient, profileId: string, page: number, pageSize: number) {
  const total = await prisma.medicationIntake.count({ where: { profileId } });
  const intakes = await prisma.medicationIntake.findMany({
    where: { profileId },
    orderBy: { createdAt: "desc" },
    skip: page * pageSize,
    take: pageSize,
  });
  return { intakes, total };
}

export async function toggleUserAccess(prisma: PrismaClient, profileId: string) {
  const p = await prisma.profile.findUnique({ where: { id: profileId } });
  if (!p) throw new Error("not found");
  return prisma.profile.update({
    where: { id: profileId },
    data: { accessEnabled: !p.accessEnabled },
  });
}

export async function setUserBotLoggedOut(prisma: PrismaClient, profileId: string, loggedOut: boolean) {
  return prisma.profile.update({
    where: { id: profileId },
    data: { botLoggedOut: loggedOut },
  });
}

export async function unlinkUserTelegram(prisma: PrismaClient, profileId: string) {
  return prisma.profile.update({
    where: { id: profileId },
    data: { telegramChatId: null, botLoggedOut: true },
  });
}

export async function setUserAdminNote(prisma: PrismaClient, profileId: string, note: string | null) {
  return prisma.profile.update({
    where: { id: profileId },
    data: { adminNote: note?.trim() || null },
  });
}
