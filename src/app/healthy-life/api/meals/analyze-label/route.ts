import { NextResponse } from "next/server";
import {
  analyzeNutritionLabelImage,
  describeAiFailure,
  mockNutritionLabelAnalysis,
  nutritionLabelDetectedWeight,
  nutritionLabelToPer100,
} from "@/lib/healthy-life/ai";
import { saveAiRecord } from "@/lib/healthy-life/ai-records";
import { getOrCreateProfile } from "@/lib/healthy-life/prisma";
import { saveMealPhoto } from "@/lib/healthy-life/uploads";
import { jsonError } from "@/lib/healthy-life/api-error";
import { isHlLocale } from "@/lib/healthy-life/i18n/locales";
import { roundNutrient } from "@/lib/healthy-life/nutrition-scale";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const profile = await getOrCreateProfile();
    const form = await request.formData();
    const file = form.get("photo");
    const localeRaw = String(form.get("locale") || "en");
    const locale = isHlLocale(localeRaw) ? localeRaw : "en";

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Upload a nutrition label photo" }, { status: 400 });
    }
    if (file.size > 12 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 12 MB)" }, { status: 400 });
    }

    const saved = await saveMealPhoto(file);
    const base64 = saved.buffer.toString("base64");

    let analysis;
    let usedFallback = false;
    let fallbackReason: string | null = null;

    try {
      analysis = await analyzeNutritionLabelImage(base64, saved.mimeType);
    } catch (err) {
      console.error("Nutrition label AI analyze failed:", err);
      fallbackReason = describeAiFailure(err);
      analysis = mockNutritionLabelAnalysis(fallbackReason);
      usedFallback = true;
    }

    const per100 = nutritionLabelToPer100(analysis);
    const weightGramsRaw = nutritionLabelDetectedWeight(analysis);
    const weightGrams = weightGramsRaw != null ? roundNutrient(weightGramsRaw) : null;

    const normalized = {
      ...analysis,
      caloriesPer100: per100.calories != null ? roundNutrient(per100.calories) : null,
      proteinPer100: per100.protein != null ? roundNutrient(per100.protein) : null,
      carbsPer100: per100.carbs != null ? roundNutrient(per100.carbs) : null,
      fatPer100: per100.fat != null ? roundNutrient(per100.fat) : null,
      weightGrams,
      servingGrams:
        analysis.servingGrams != null && Number(analysis.servingGrams) > 0
          ? roundNutrient(Number(analysis.servingGrams))
          : null,
    };

    await saveAiRecord({
      profileId: profile.id,
      kind: "nutrition_label",
      locale,
      inputSummary: JSON.stringify({
        photoPath: saved.photoPath,
        mimeType: saved.mimeType,
        fileName: file.name,
        fileSize: file.size,
      }),
      output: normalized,
      usedFallback,
      fallbackReason,
    });

    const hasNutrition =
      normalized.caloriesPer100 != null ||
      normalized.proteinPer100 != null ||
      normalized.carbsPer100 != null ||
      normalized.fatPer100 != null;

    return NextResponse.json({
      photoPath: saved.photoPath,
      analysis: normalized,
      per100: {
        calories: normalized.caloriesPer100,
        protein: normalized.proteinPer100,
        carbs: normalized.carbsPer100,
        fat: normalized.fatPer100,
      },
      weightGrams,
      hasNutrition,
      hasWeight: weightGrams != null,
      usedFallback,
      fallbackReason,
    });
  } catch (err) {
    console.error(err);
    return jsonError(err, "Label analysis failed");
  }
}
