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
Ответь ТОЛЬКО валидным JSON без markdown:
{
  "name": "краткое название блюда на русском",
  "description": "что видно на фото",
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
}): Promise<{ title: string; content: string; summary: string }> {
  const client = getClient();
  const weightInfo =
    params.weightStart != null && params.weightEnd != null
      ? `Вес: с ${params.weightStart} кг до ${params.weightEnd} кг.`
      : params.weightEnd != null
        ? `Текущий вес: ${params.weightEnd} кг.`
        : "Данных о весе мало.";

  const response = await client.chat.completions.create({
    model: getModel(),
    temperature: 0.5,
    messages: [
      {
        role: "system",
        content: `Ты дружелюбный русскоязычный коуч по здоровому питанию и тренировкам.
Дай практичные советы без осуждения. Ответь ТОЛЬКО JSON:
{"title":"короткий заголовок","summary":"1-2 предложения","content":"развёрнутый совет 3-6 коротких абзацев или пунктов"}`,
      },
      {
        role: "user",
        content: `Период: ${params.period} (${params.periodLabel})
Цель калорий/день: ${params.calorieGoal}
Суммарно калорий за период: ${params.totalCalories}
Среднее в день: ${Math.round(params.avgCaloriesPerDay)}
Приёмов пищи: ${params.mealCount}
Цель по весу: ${params.targetWeight ?? "не задана"} кг
${weightInfo}
Тренировки: ${params.workoutSummary || "нет данных"}
Недавние блюда: ${params.recentMeals.slice(0, 12).join("; ") || "пока нет"}`,
      },
    ],
  });

  const text = response.choices[0]?.message?.content ?? "";
  const data = extractJson(text) as { title?: string; content?: string; summary?: string };
  return {
    title: data.title || "Совет по питанию",
    content: data.content || "Продолжайте вести дневник — так советы станут точнее.",
    summary: data.summary || "Следите за балансом калорий и регулярностью приёмов пищи.",
  };
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
