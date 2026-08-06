import { NextResponse } from "next/server";
import { analyzeFoodImage, describeAiFailure, mockFoodAnalysis } from "@/lib/healthy-life/ai";
import { loadCorrectionHints } from "@/lib/healthy-life/ai-corrections";
import { saveAiRecord } from "@/lib/healthy-life/ai-records";
import { getOrCreateProfile } from "@/lib/healthy-life/prisma";
import { saveMealPhoto } from "@/lib/healthy-life/uploads";
import { jsonError } from "@/lib/healthy-life/api-error";
import { isHlLocale } from "@/lib/healthy-life/i18n/locales";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const profile = await getOrCreateProfile();

    const form = await request.formData();
    const file = form.get("photo");
    const localeRaw = String(form.get("locale") || "en");
    const locale = isHlLocale(localeRaw) ? localeRaw : "en";

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Upload a food photo" }, { status: 400 });
    }

    if (file.size > 12 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 12 MB)" }, { status: 400 });
    }

    const saved = await saveMealPhoto(file);
    const base64 = saved.buffer.toString("base64");
    const correctionHints = await loadCorrectionHints(profile.id, "food_analysis");

    let analysis;
    let usedFallback = false;
    let fallbackReason: string | null = null;

    try {
      analysis = await analyzeFoodImage(base64, saved.mimeType, correctionHints);
    } catch (err) {
      console.error("AI analyze failed:", err);
      fallbackReason = describeAiFailure(err);
      analysis = mockFoodAnalysis(fallbackReason);
      usedFallback = true;
    }

    const aiRecord = await saveAiRecord({
      profileId: profile.id,
      kind: "food_analysis",
      locale,
      inputSummary: JSON.stringify({
        photoPath: saved.photoPath,
        mimeType: saved.mimeType,
        fileName: file.name,
        fileSize: file.size,
      }),
      output: analysis,
      usedFallback,
      fallbackReason,
    });

    return NextResponse.json({
      photoPath: saved.photoPath,
      analysis,
      usedFallback,
      fallbackReason,
      aiRawResponse: JSON.stringify(analysis),
      aiRecordId: aiRecord.id,
    });
  } catch (err) {
    console.error(err);
    return jsonError(err, "Analysis failed");
  }
}
