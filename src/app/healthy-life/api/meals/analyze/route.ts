import { NextResponse } from "next/server";
import { analyzeFoodImage, describeAiFailure, mockFoodAnalysis } from "@/lib/healthy-life/ai";
import { saveMealPhoto } from "@/lib/healthy-life/uploads";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("photo");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Загрузите фото еды" }, { status: 400 });
    }

    if (file.size > 12 * 1024 * 1024) {
      return NextResponse.json({ error: "Файл слишком большой (макс. 12 МБ)" }, { status: 400 });
    }

    const saved = await saveMealPhoto(file);
    const base64 = saved.buffer.toString("base64");

    let analysis;
    let usedFallback = false;
    let fallbackReason: string | null = null;

    try {
      analysis = await analyzeFoodImage(base64, saved.mimeType);
    } catch (err) {
      console.error("AI analyze failed:", err);
      fallbackReason = describeAiFailure(err);
      analysis = mockFoodAnalysis(fallbackReason);
      usedFallback = true;
    }

    return NextResponse.json({
      photoPath: saved.photoPath,
      analysis,
      usedFallback,
      fallbackReason,
      aiRawResponse: JSON.stringify(analysis),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка анализа" },
      { status: 500 },
    );
  }
}
