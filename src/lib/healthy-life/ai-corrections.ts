import { prisma } from "@/lib/healthy-life/prisma";

export type AiCorrectionKind = "food_analysis" | "medication_analysis";

export async function saveAiCorrection(params: {
  profileId: string;
  kind: AiCorrectionKind;
  ai: Record<string, unknown>;
  user: Record<string, unknown>;
  sourceId?: string | null;
}) {
  // Skip if nothing meaningful changed
  const aiName = String(params.ai.name ?? "").trim().toLowerCase();
  const userName = String(params.user.name ?? "").trim().toLowerCase();
  const aiCal = params.ai.calories != null ? Number(params.ai.calories) : null;
  const userCal = params.user.calories != null ? Number(params.user.calories) : null;
  const sameName = aiName === userName;
  const sameCal =
    (aiCal == null && userCal == null) ||
    (aiCal != null && userCal != null && Math.round(aiCal) === Math.round(userCal));
  if (sameName && sameCal && params.kind === "food_analysis") return null;
  if (sameName && params.kind === "medication_analysis") return null;
  if (!userName && userCal == null) return null;

  return prisma.aiCorrection.create({
    data: {
      profileId: params.profileId,
      kind: params.kind,
      aiJson: JSON.stringify(params.ai),
      userJson: JSON.stringify(params.user),
      sourceId: params.sourceId ?? null,
    },
  });
}

/** Recent corrections as short prompt lines for the model. */
export async function loadCorrectionHints(
  profileId: string,
  kind: AiCorrectionKind,
  limit = 12,
): Promise<string[]> {
  const rows = await prisma.aiCorrection.findMany({
    where: { profileId, kind },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const lines: string[] = [];
  for (const row of rows) {
    try {
      const ai = JSON.parse(row.aiJson) as Record<string, unknown>;
      const user = JSON.parse(row.userJson) as Record<string, unknown>;
      if (kind === "food_analysis") {
        const parts = [
          `AI said "${String(ai.name ?? "")}"`,
          ai.calories != null ? `~${Math.round(Number(ai.calories))} kcal` : null,
          `user corrected to "${String(user.name ?? "")}"`,
          user.calories != null ? `~${Math.round(Number(user.calories))} kcal` : null,
        ].filter(Boolean);
        lines.push(`- ${parts.join("; ")}`);
      } else {
        lines.push(
          `- AI said "${String(ai.name ?? "")}"; user corrected to "${String(user.name ?? "")}"`,
        );
      }
    } catch {
      /* skip bad rows */
    }
  }
  return lines;
}

export function formatCorrectionBlock(lines: string[]): string {
  if (lines.length === 0) return "";
  return `
USER CORRECTION MEMORY (apply when the photo looks similar — prefer user's naming/calories):
${lines.join("\n")}
`;
}
