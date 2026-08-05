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

export async function analyzeFoodImage(base64: string, mimeType: string): Promise<FoodAnalysis> {
  const client = getClient();
  const response = await client.chat.completions.create({
    model: getModel(),
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: `Ты нутрициолог. По фото еды оцени состав и калорийность.
Не задавай вопросов пользователю и не проси уточнений — только оценка по фото.
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

const MedicationAnalysisSchema = z.object({
  name: z.string(),
  dosage: z.string().optional().nullable(),
  confidence: z.number().min(0).max(1).optional().nullable(),
});

export type MedicationAnalysis = z.infer<typeof MedicationAnalysisSchema>;

/** Read medication name (and dosage if visible) from a photo of a pack / blister / bottle. */
export async function analyzeMedicationImage(
  base64: string,
  mimeType: string,
  language = "Russian",
): Promise<MedicationAnalysis> {
  const client = getClient();
  const response = await client.chat.completions.create({
    model: getModel(),
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content: `You identify medications from photos (packaging, blister, bottle, label).
Do not give medical advice. Do not ask questions.

LANGUAGE: write "name" and "dosage" in ${language}.

Reply ONLY with valid JSON (no markdown):
{
  "name": "medication trade or generic name as on the package",
  "dosage": "strength/dose if visible (e.g. 500 mg, 1 tablet) or null",
  "confidence": number from 0 to 1
}

If you cannot identify it, return {"name":"","dosage":null,"confidence":0}.`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Read the medication name from this photo. Prefer the brand/trade name on the packaging.",
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

export function mockMedicationAnalysis(reason?: string): MedicationAnalysis {
  return {
    name: "",
    dosage: null,
    confidence: 0,
  };
}
