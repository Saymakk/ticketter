import { PrismaClient } from "@prisma/client";
import { createClient } from "@/lib/healthy-life/supabase/server";
import { normalizePhone } from "@/lib/auth/phone";

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
  const fromMeta = typeof meta === "string" ? meta : "";
  const fromEmail = user.email?.match(/^phone_(\d{10,15})@ticketter\.local$/i)?.[1] ?? "";
  const raw = fromMeta || fromEmail;
  if (!raw) return null;
  try {
    return normalizePhone(raw);
  } catch {
    return null;
  }
}

export async function getOrCreateProfile() {
  const user = await requireUser();

  const name =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    user.email?.split("@")[0] ||
    "Пользователь";
  const phone = phoneFromAuthUser(user);

  const existing = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (existing) {
    if (phone && !existing.phone) {
      try {
        return await prisma.profile.update({
          where: { id: existing.id },
          data: { phone },
        });
      } catch {
        return existing;
      }
    }
    return existing;
  }

  // upsert avoids P2002 races when Progress/Workouts/Weight hit the API in parallel
  // right after the first login (before a Profile row exists).
  try {
    return await prisma.profile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        name,
        phone,
        dailyCalorieGoal: 2000,
      },
    });
  } catch {
    return prisma.profile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        name,
        dailyCalorieGoal: 2000,
      },
    });
  }
}
