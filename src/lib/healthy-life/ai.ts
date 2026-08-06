import OpenAI from "openai";
import { z } from "zod";
import { getHealthyLifeOpenAiKey, getHealthyLifeOpenAiModel } from "@/lib/healthy-life/config";

const FoodAnalysisSchema = z.object({
  name: z.string(),
  description: z.string().optional().nullable(),
  calories: z.number(),
  protein: z.number().optional().nullable(),
  carbs: z.number().optional().nullable(),
  fat: z.number().optional().nullable(),
  portionGrams: z.number().optional().nullable(),
  confidence: z.number().min(0).max(1).optional().nullable(),
  items: z
    .array(
      z.object({
        name: z.string(),
        calories: z.number(),
        grams: z.number().optional().nullable(),
      }),
    )
    .optional()
    .nullable(),
});

export type FoodAnalysis = z.infer<typeof FoodAnalysisSchema>;

function getClient() {
  const key = getHealthyLifeOpenAiKey();
  if (!key) {
    throw new Error("HEALTHY_LIFE_OPENAI_API_KEY не задан. Добавьте ключ в .env");
  }
  return new OpenAI({ apiKey: key });
}

function getModel() {
  return getHealthyLifeOpenAiModel();
}

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("ИИ не вернул JSON");
  }
  return JSON.parse(raw.slice(start, end + 1));
}

export async function analyzeFoodImage(
  base64: string,
  mimeType: string,
  correctionHints: string[] = [],
): Promise<FoodAnalysis> {
  const client = getClient();
  const memory =
    correctionHints.length > 0
      ? `\nUSER CORRECTION MEMORY (prefer these when the photo looks similar):\n${correctionHints.join("\n")}\n`
      : "";
  const response = await client.chat.completions.create({
    model: getModel(),
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: `Ты нутрициолог. По фото еды оцени состав и калорийность.
Не задавай вопросов пользователю и не проси уточнений — только оценка по фото.
${memory}
Ответь ТОЛЬКО валидным JSON без markdown:
{
  "name": "краткое название блюда на русском",
  "description": "что видно на фото (без вопросов)",
  "calories": число ккал всей порции,
  "protein": граммы белка или null,
  "carbs": граммы углеводов или null,
  "fat": граммы жиров или null,
  "portionGrams": примерный вес порции в граммах или null,
  "confidence": уверенность от 0 до 1,
  "items": [{"name": "...", "calories": 0, "grams": 0}]
}
Если еды нет — всё равно верни JSON с name="Не удалось определить" и calories=0.`,
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Проанализируй еду на фото и оцени калории." },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64}`,
              detail: "low",
            },
          },
        ],
      },
    ],
  });

  const text = response.choices[0]?.message?.content ?? "";
  const parsed = FoodAnalysisSchema.parse(extractJson(text));
  return parsed;
}

export async function generateAdvice(params: {
  period: "day" | "week" | "month";
  periodLabel: string;
  calorieGoal: number;
  totalCalories: number;
  mealCount: number;
  avgCaloriesPerDay: number;
  weightStart?: number | null;
  weightEnd?: number | null;
  targetWeight?: number | null;
  recentMeals: string[];
  workoutSummary?: string;
  /** Language the model must write in (e.g. "Russian", "English"). */
  language?: string;
}): Promise<{ title: string; content: string; summary: string }> {
  const client = getClient();
  const language = params.language || "English";
  const weightInfo =
    params.weightStart != null && params.weightEnd != null
      ? `Weight: from ${params.weightStart} kg to ${params.weightEnd} kg.`
      : params.weightEnd != null
        ? `Current weight: ${params.weightEnd} kg.`
        : "Little weight data.";

  const response = await client.chat.completions.create({
    model: getModel(),
    temperature: 0.5,
    messages: [
      {
        role: "system",
        content: `You are a friendly coach for healthy eating and workouts.
Give practical, non-judgmental advice.

LANGUAGE (critical):
- Write title, summary, and content ENTIRELY in ${language}.
- Do not mix languages.

CRITICAL — one-way advice, not a dialogue:
- NEVER ask the user questions (direct or rhetorical).
- NEVER ask them to reply, clarify, write back, or “let you know”.
- Write only statements and ready-to-use recommendations.
- If data is sparse, calmly say what is missing for accuracy — without asking for a chat reply.

CRITICAL — medications are out of scope:
- NEVER mention medications, drugs, vitamins, supplements, dosages, or dosing schedules.
- NEVER give medical or pharmaceutical recommendations.
- Advice only about food, calories, eating habits, and physical activity.

Reply ONLY with JSON:
{"title":"short title","summary":"1-2 sentences without questions","content":"expanded advice, 3-6 short paragraphs or bullets, no questions"}`,
      },
      {
        role: "user",
        content: `Period: ${params.period} (${params.periodLabel})
Daily calorie goal: ${params.calorieGoal}
Total calories in period: ${params.totalCalories}
Average per day: ${Math.round(params.avgCaloriesPerDay)}
Meals logged: ${params.mealCount}
Weight goal: ${params.targetWeight ?? "not set"} kg
${weightInfo}
Workouts: ${params.workoutSummary || "no data"}
Recent meals: ${params.recentMeals.slice(0, 12).join("; ") || "none yet"}

Write ready-to-use advice in ${language}. Do not ask questions. Do not mention medications.`,
      },
    ],
  });

  const text = response.choices[0]?.message?.content ?? "";
  const data = extractJson(text) as { title?: string; content?: string; summary?: string };
  return {
    title: sanitizeAdviceCopy(data.title || "Nutrition tip"),
    content: sanitizeAdviceCopy(
      data.content || "Keep logging meals — advice will get more precise.",
    ),
    summary: sanitizeAdviceCopy(
      data.summary || "Watch calorie balance and regular meals.",
    ),
  };
}

/** Soft cleanup: drop phrases that invite a user reply (there is no chat input). */
function sanitizeAdviceCopy(text: string): string {
  return text
    .replace(
      /(^|\n)\s*[-•*]?\s*(напишите|расскажите|ответьте|дайте знать|что думаете|как у вас|а что насчёт)[^.!?\n]*[?]?\s*/gi,
      "$1",
    )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function describeAiFailure(err: unknown): string {
  if (!getHealthyLifeOpenAiKey()) {
    return "HEALTHY_LIFE_OPENAI_API_KEY не задан в .env";
  }
  const message = err instanceof Error ? err.message : String(err);
  const status =
    err && typeof err === "object" && "status" in err
      ? Number((err as { status?: number }).status)
      : undefined;
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code?: string }).code)
      : undefined;

  if (status === 429 || code === "insufficient_quota" || /quota|billing/i.test(message)) {
    return "Квота OpenAI исчерпана — пополните баланс на platform.openai.com";
  }
  if (status === 401 || /invalid.?api.?key|incorrect api key/i.test(message)) {
    return "Неверный HEALTHY_LIFE_OPENAI_API_KEY";
  }
  if (status === 404 || /model/i.test(message)) {
    return "Модель OpenAI недоступна — проверьте HEALTHY_LIFE_OPENAI_MODEL в .env";
  }
  return message.slice(0, 160) || "Ошибка OpenAI";
}

/** Fallback analysis when OpenAI is unavailable — keeps the app usable. */
export function mockFoodAnalysis(reason?: string): FoodAnalysis {
  return {
    name: "Домашнее блюдо",
    description: reason
      ? `Примерная оценка без AI (${reason}). Отредактируйте поля вручную.`
      : "Примерная оценка без AI. Отредактируйте поля вручную.",
    calories: 450,
    protein: 20,
    carbs: 45,
    fat: 18,
    portionGrams: 300,
    confidence: 0.2,
    items: [{ name: "Блюдо", calories: 450, grams: 300 }],
  };
}

const NutritionLabelSchema = z.object({
  caloriesPer100: z.number().optional().nullable(),
  proteinPer100: z.number().optional().nullable(),
  carbsPer100: z.number().optional().nullable(),
  fatPer100: z.number().optional().nullable(),
  /** How the label states nutrients before normalization */
  labelBasis: z
    .enum(["per_100g", "per_100ml", "per_serving", "other"])
    .optional()
    .nullable(),
  /** Serving size in g/ml when label is per serving (used to convert if needed) */
  servingGrams: z.number().optional().nullable(),
  /**
   * Actual weight/volume to use for the logged portion when visible in the photo:
   * net weight, pack size, serving size, or handwritten/scale weight.
   */
  weightGrams: z.number().optional().nullable(),
  productName: z.string().optional().nullable(),
  confidence: z.number().min(0).max(1).optional().nullable(),
});

export type NutritionLabelAnalysis = z.infer<typeof NutritionLabelSchema>;

/**
 * Read nutrition facts from a label / packaging / screen photo.
 * Always returns values normalized per 100 g or 100 ml when possible.
 */
export async function analyzeNutritionLabelImage(
  base64: string,
  mimeType: string,
): Promise<NutritionLabelAnalysis> {
  const client = getClient();
  const response = await client.chat.completions.create({
    model: getModel(),
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content: `You read nutrition labels and weight info from photos (packaging, nutrition facts table, scales, handwritten notes, app screenshots, restaurant cards).
Do not ask questions. Do not give medical advice.

Normalize ALL nutrient numbers to PER 100 grams or PER 100 ml:
- If the label already shows "per 100 g" / "per 100 ml" / "на 100 г" / "на 100 мл", copy those numbers.
- If the label shows per serving / per portion, convert to per 100 using serving size in grams or ml.
- If you cannot convert (no serving size), still fill caloriesPer100/proteinPer100/carbsPer100/fatPer100 only when the label clearly shows per-100 values; otherwise use null.

WEIGHT (important):
- If any usable weight/volume is visible in the photo, fill "weightGrams" (grams or ml as a number).
- Prefer in this order: portion/serving size for the nutrients, net weight (нетто / net wt), pack size, kitchen scale reading, handwritten weight.
- Also set "servingGrams" when a serving size is explicitly shown.
- If weight is not visible, use null.

Reply ONLY with valid JSON (no markdown):
{
  "caloriesPer100": number or null,
  "proteinPer100": number or null,
  "carbsPer100": number or null,
  "fatPer100": number or null,
  "labelBasis": "per_100g" | "per_100ml" | "per_serving" | "other",
  "servingGrams": serving size in g/ml if visible, else null,
  "weightGrams": portion/net/pack/scale weight in g/ml if visible, else null,
  "productName": product name if visible, else null,
  "confidence": 0..1
}

Numbers must be plain numbers (not strings). Use null when unknown.
If the image has no nutrition data and no weight, return nutrient fields and weightGrams as null and confidence 0.`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Read nutrition facts per 100 g/ml and any visible weight/volume from this photo.",
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64}`,
              detail: "high",
            },
          },
        ],
      },
    ],
  });

  const text = response.choices[0]?.message?.content ?? "";
  return NutritionLabelSchema.parse(extractJson(text));
}

export function mockNutritionLabelAnalysis(_reason?: string): NutritionLabelAnalysis {
  return {
    caloriesPer100: null,
    proteinPer100: null,
    carbsPer100: null,
    fatPer100: null,
    labelBasis: "other",
    servingGrams: null,
    weightGrams: null,
    productName: null,
    confidence: 0,
  };
}

/** Prefer explicit weightGrams, else serving size when positive. */
export function nutritionLabelDetectedWeight(analysis: NutritionLabelAnalysis): number | null {
  const candidates = [analysis.weightGrams, analysis.servingGrams];
  for (const raw of candidates) {
    if (raw == null) continue;
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/** Normalize label analysis into per-100 nutrient numbers (client/server shared). */
export function nutritionLabelToPer100(analysis: NutritionLabelAnalysis): {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
} {
  const hasPer100 =
    analysis.caloriesPer100 != null ||
    analysis.proteinPer100 != null ||
    analysis.carbsPer100 != null ||
    analysis.fatPer100 != null;

  if (hasPer100) {
    return {
      calories: analysis.caloriesPer100 ?? null,
      protein: analysis.proteinPer100 ?? null,
      carbs: analysis.carbsPer100 ?? null,
      fat: analysis.fatPer100 ?? null,
    };
  }

  return { calories: null, protein: null, carbs: null, fat: null };
}

const MedicationAnalysisSchema = z.object({
  name: z.string(),
  confidence: z.number().min(0).max(1).optional().nullable(),
});

export type MedicationAnalysis = z.infer<typeof MedicationAnalysisSchema>;

/** Read medication name from a photo of a pack / blister / bottle. */
export async function analyzeMedicationImage(
  base64: string,
  mimeType: string,
  language = "Russian",
  correctionHints: string[] = [],
): Promise<MedicationAnalysis> {
  const client = getClient();
  const memory =
    correctionHints.length > 0
      ? `\nUSER CORRECTION MEMORY (prefer these names when the pack looks similar):\n${correctionHints.join("\n")}\n`
      : "";
  const response = await client.chat.completions.create({
    model: getModel(),
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content: `You identify medications from photos (packaging, blister, bottle, label).
Do not give medical advice. Do not ask questions.
${memory}
LANGUAGE: write "name" in ${language}.

Reply ONLY with valid JSON (no markdown):
{
  "name": "medication trade or generic name; if strength/volume/count is visible, append it in parentheses, e.g. \\"Nurofen (200 mg)\\" or \\"Amoxicillin (20 tablets)\\"",
  "confidence": number from 0 to 1
}

Do NOT return a separate dosage field — put amount/volume only inside the name in parentheses when visible.
If you cannot identify it, return {"name":"","confidence":0}.`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Read the medication name from this photo. Prefer the brand/trade name. Put strength or pack size in parentheses next to the name if visible.",
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64}`,
              detail: "low",
            },
          },
        ],
      },
    ],
  });

  const text = response.choices[0]?.message?.content ?? "";
  return MedicationAnalysisSchema.parse(extractJson(text));
}

export function mockMedicationAnalysis(_reason?: string): MedicationAnalysis {
  return {
    name: "",
    confidence: 0,
  };
}
