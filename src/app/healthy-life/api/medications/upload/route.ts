import { NextResponse } from "next/server";
import {
  analyzeMedicationImage,
  describeAiFailure,
  mockMedicationAnalysis,
} from "@/lib/healthy-life/ai";
import { loadCorrectionHints } from "@/lib/healthy-life/ai-corrections";
import { saveAiRecord } from "@/lib/healthy-life/ai-records";
import { getOrCreateProfile } from "@/lib/healthy-life/prisma";
import { savePhoto } from "@/lib/healthy-life/uploads";
import { jsonError } from "@/lib/healthy-life/api-error";
import { HL_LOCALE_META, isHlLocale } from "@/lib/healthy-life/i18n/locales";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const profile = await getOrCreateProfile();
    const form = await request.formData();
    const file = form.get("photo");
    const localeRaw = String(form.get("locale") || "en");
    const locale = isHlLocale(localeRaw) ? localeRaw : "en";
    const aiLanguage = HL_LOCALE_META[locale].aiLanguage;

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Загрузите фото" }, { status: 400 });
    }
    if (file.size > 12 * 1024 * 1024) {
      return NextResponse.json({ error: "Файл слишком большой (макс. 12 МБ)" }, { status: 400 });
    }

    const saved = await savePhoto(file, "medications");
    const base64 = saved.buffer.toString("base64");
    const correctionHints = await loadCorrectionHints(profile.id, "medication_analysis");

    let analysis;
    let usedFallback = false;
    let fallbackReason: string | null = null;

    try {
      analysis = await analyzeMedicationImage(
        base64,
        saved.mimeType,
        aiLanguage,
        correctionHints,
      );
    } catch (err) {
      console.error("Medication AI analyze failed:", err);
      fallbackReason = describeAiFailure(err);
      analysis = mockMedicationAnalysis(fallbackReason);
      usedFallback = true;
    }

    await saveAiRecord({
      profileId: profile.id,
      kind: "medication_analysis",
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
    });
  } catch (error) {
    return jsonError(error);
  }
}
