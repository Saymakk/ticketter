import { PrismaClient } from "@prisma/client";
import { createClient } from "@/lib/healthy-life/supabase/server";

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

export async function getOrCreateProfile() {
  const user = await requireUser();

  const name =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    user.email?.split("@")[0] ||
    "Пользователь";

  // upsert avoids P2002 races when Progress/Workouts/Weight hit the API in parallel
  // right after the first login (before a Profile row exists).
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
