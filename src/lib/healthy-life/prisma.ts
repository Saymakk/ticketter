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

  const byUser = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (byUser) return byUser;

  const name =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    user.email?.split("@")[0] ||
    "Пользователь";

  return prisma.profile.create({
    data: {
      userId: user.id,
      name,
      dailyCalorieGoal: 2000,
    },
  });
}
