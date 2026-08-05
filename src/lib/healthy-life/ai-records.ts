import { prisma } from "@/lib/healthy-life/prisma";

export type AiRecordKind = "food_analysis" | "medication_analysis" | "advice";

export async function saveAiRecord(params: {
  profileId: string;
  kind: AiRecordKind;
  output: unknown;
  locale?: string | null;
  inputSummary?: string | null;
  usedFallback?: boolean;
  fallbackReason?: string | null;
  mealId?: string | null;
  adviceId?: string | null;
}) {
  return prisma.aiRecord.create({
    data: {
      profileId: params.profileId,
      kind: params.kind,
      locale: params.locale ?? null,
      inputSummary: params.inputSummary ?? null,
      outputJson: JSON.stringify(params.output),
      usedFallback: Boolean(params.usedFallback),
      fallbackReason: params.fallbackReason ?? null,
      mealId: params.mealId ?? null,
      adviceId: params.adviceId ?? null,
    },
  });
}

export async function linkAiRecordToMeal(aiRecordId: string, mealId: string) {
  return prisma.aiRecord.update({
    where: { id: aiRecordId },
    data: { mealId },
  });
}

export async function linkAiRecordToAdvice(aiRecordId: string, adviceId: string) {
  return prisma.aiRecord.update({
    where: { id: aiRecordId },
    data: { adviceId },
  });
}
