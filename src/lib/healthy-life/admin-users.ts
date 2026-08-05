import type { User } from "@supabase/supabase-js";
import { prisma } from "@/lib/healthy-life/prisma";
import { getSupabaseAdmin } from "@/lib/healthy-life/supabase-admin";

export function isHealthyLifeAdminConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_HEALTHY_LIFE_SUPABASE_URL &&
      (process.env.HEALTHY_LIFE_SUPABASE_SECRET_KEY ||
        process.env.HEALTHY_LIFE_SUPABASE_SERVICE_ROLE_KEY) &&
      process.env.HEALTHY_LIFE_DATABASE_URL
  );
}

export type HealthyLifeAuthSummary = {
  id: string;
  email: string | null;
  phone: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  confirmedAt: string | null;
  userMetadata: Record<string, unknown>;
};

export type HealthyLifeUserListItem = HealthyLifeAuthSummary & {
  profileId: string | null;
  name: string | null;
  dailyCalorieGoal: number | null;
  targetWeightKg: number | null;
  heightCm: number | null;
  profileCreatedAt: string | null;
  counts: {
    meals: number;
    weights: number;
    workouts: number;
    medicationPlans: number;
    medicationIntakes: number;
    advice: number;
    aiRecords: number;
  };
  latestWeightKg: number | null;
  latestWeightDate: string | null;
};

const profileCountSelect = {
  meals: true,
  weights: true,
  workouts: true,
  medicationPlans: true,
  medicationIntakes: true,
  advice: true,
  aiRecords: true,
} as const;

function mapAuthUser(user: User): HealthyLifeAuthSummary {
  return {
    id: user.id,
    email: user.email ?? null,
    phone: user.phone ?? null,
    createdAt: user.created_at ?? null,
    lastSignInAt: user.last_sign_in_at ?? null,
    confirmedAt: user.confirmed_at ?? null,
    userMetadata: (user.user_metadata ?? {}) as Record<string, unknown>,
  };
}

async function listAllAuthUsers(): Promise<User[]> {
  const supabase = getSupabaseAdmin();
  const users: User[] = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < perPage) break;
    page += 1;
  }

  return users;
}

export async function listHealthyLifeUsers(): Promise<HealthyLifeUserListItem[]> {
  const [authUsers, profiles] = await Promise.all([
    listAllAuthUsers(),
    prisma.profile.findMany({
      include: {
        _count: { select: profileCountSelect },
        weights: {
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: { weightKg: true, date: true },
        },
      },
    }),
  ]);

  const profileByUserId = new Map(profiles.map((p) => [p.userId, p]));

  return authUsers
    .map((authUser) => {
      const auth = mapAuthUser(authUser);
      const profile = profileByUserId.get(authUser.id);

      if (!profile) {
        return {
          ...auth,
          profileId: null,
          name: null,
          dailyCalorieGoal: null,
          targetWeightKg: null,
          heightCm: null,
          profileCreatedAt: null,
          counts: {
            meals: 0,
            weights: 0,
            workouts: 0,
            medicationPlans: 0,
            medicationIntakes: 0,
            advice: 0,
            aiRecords: 0,
          },
          latestWeightKg: null,
          latestWeightDate: null,
        };
      }

      const latestWeight = profile.weights[0];

      return {
        ...auth,
        profileId: profile.id,
        name: profile.name,
        dailyCalorieGoal: profile.dailyCalorieGoal,
        targetWeightKg: profile.targetWeightKg,
        heightCm: profile.heightCm,
        profileCreatedAt: profile.createdAt.toISOString(),
        counts: profile._count,
        latestWeightKg: latestWeight?.weightKg ?? null,
        latestWeightDate: latestWeight?.date ?? null,
      };
    })
    .sort((a, b) => {
      const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
      const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
      return bTime - aTime;
    });
}

export async function getHealthyLifeUserDetail(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error) throw error;
  if (!data.user) return null;

  const profile = await prisma.profile.findUnique({
    where: { userId },
    include: {
      _count: { select: profileCountSelect },
      meals: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
      weights: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
      workouts: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
      medicationPlans: { orderBy: { createdAt: "desc" } },
      medicationIntakes: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
      advice: { orderBy: { createdAt: "desc" } },
      aiRecords: { orderBy: { createdAt: "desc" } },
    },
  });

  return {
    auth: mapAuthUser(data.user),
    profile,
  };
}
