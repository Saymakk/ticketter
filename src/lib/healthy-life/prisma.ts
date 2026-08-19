import { PrismaClient } from "@prisma/client";
import { createClient } from "@/lib/healthy-life/supabase/server";
import { phoneFromAuthEmail, tryNormalizePhone } from "@/lib/auth/phone";

const globalForPrisma = globalThis as unknown as { healthyLifePrisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.healthyLifePrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.healthyLifePrisma = prisma;
}

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

function phoneFromAuthUser(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): string | null {
  const meta = user.user_metadata?.phone;
  if (typeof meta === "string" && meta.trim()) {
    const normalized = tryNormalizePhone(meta);
    if (normalized) return normalized;
  }
  return phoneFromAuthEmail(user.email);
}

export async function getOrCreateProfile() {
  const user = await requireUser();

  const synthetic = Boolean(user.email?.toLowerCase().endsWith("@ticketter.local"));
  const name =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    (!synthetic && user.email ? user.email.split("@")[0] : undefined) ||
    "Пользователь";

  const phone = phoneFromAuthUser(user);

  // upsert avoids P2002 races when Progress/Workouts/Weight hit the API in parallel
  // right after the first login (before a Profile row exists).
  const profile = await prisma.profile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      name,
      dailyCalorieGoal: 2000,
      ...(phone ? { phone } : {}),
    },
  });

  if (phone && !profile.phone) {
    await prisma.profile.update({ where: { id: profile.id }, data: { phone } }).catch(() => null);
    return prisma.profile.findUniqueOrThrow({ where: { id: profile.id } });
  }

  return profile;
}
