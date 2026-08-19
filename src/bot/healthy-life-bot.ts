import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Workaround for TLS certificate issues on Windows
if (process.platform === "win32") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

// Load .env.local if available (local dev); on server env vars come from Docker
const envPath = resolve(__dirname, "../../.env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

import { Bot, InlineKeyboard, Keyboard, Context } from "grammy";
import { PrismaClient } from "@prisma/client";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// ─── Config ───────────────────────────────────────────────────────────────────

const BOT_TOKEN = process.env.HEALTHY_LIFE_TELEGRAM_BOT_TOKEN!;
const WEB_APP_URL = process.env.HEALTHY_LIFE_WEB_APP_URL || "https://healthy-life.myworkspace.su";
const SUPABASE_URL = process.env.NEXT_PUBLIC_HEALTHY_LIFE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_HEALTHY_LIFE_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_KEY = process.env.HEALTHY_LIFE_SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_API_KEY = process.env.HEALTHY_LIFE_OPENAI_API_KEY!;
const OPENAI_MODEL = process.env.HEALTHY_LIFE_OPENAI_MODEL || "gpt-4o-mini";

const prisma = new PrismaClient();
const supabaseAdmin: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const supabaseAnon: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const bot = new Bot(BOT_TOKEN);

// ─── Phone helpers (copied from src/lib/auth/phone.ts) ───────────────────────

function normalizePhone(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  if (digits.length === 10) digits = `7${digits}`;
  if (digits.length === 11 && digits.startsWith("7")) return digits;
  throw new Error("Неверный формат телефона");
}

function phoneToEmail(phone: string): string {
  return `phone_${normalizePhone(phone)}@ticketter.local`;
}

function phoneAuthEmailCandidates(phoneInput: string): string[] {
  const digits = phoneInput.replace(/\D/g, "");
  const candidates = new Set<string>();
  try { candidates.add(phoneToEmail(phoneInput)); } catch {}
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    candidates.add(`phone_${last10}@ticketter.local`);
    candidates.add(`phone_7${last10}@ticketter.local`);
  }
  if (digits.length === 11 && digits.startsWith("8")) {
    candidates.add(`phone_7${digits.slice(1)}@ticketter.local`);
    candidates.add(`phone_${digits}@ticketter.local`);
  }
  if (digits.length === 11 && digits.startsWith("7")) {
    candidates.add(`phone_${digits}@ticketter.local`);
    candidates.add(`phone_${digits.slice(1)}@ticketter.local`);
  }
  return [...candidates];
}

// ─── i18n ─────────────────────────────────────────────────────────────────────

type Locale = string;

const LOCALES_META: Record<string, string> = {
  en: "English", ru: "Русский", ar: "العربية", zh: "中文",
  fr: "Français", es: "Español", kk: "Қазақша", ky: "Кыргызча",
  uz: "Oʻzbekcha", ko: "한국어", ja: "日本語",
};

const translations: Record<string, Record<string, string>> = {
  ru: {
    welcome: "Добро пожаловать в Healthy Life! 🌿",
    not_linked: "Ваш Telegram не привязан к аккаунту. Выберите способ входа:",
    login_email: "Войти по почте",
    login_phone: "Войти по телефону",
    enter_email: "Введите ваш email:",
    enter_password: "Введите пароль:",
    enter_phone: "Отправьте контакт кнопкой ниже или введите номер телефона:",
    share_contact: "📱 Отправить контакт",
    login_success: "✅ Вход выполнен! Добро пожаловать, {name}!",
    login_failed: "❌ Неверный email или пароль.",
    register_offer: "Аккаунт не найден. Хотите зарегистрироваться с этими данными?",
    register_yes: "Да, зарегистрироваться",
    register_no: "Нет",
    register_success: "✅ Регистрация успешна! Добро пожаловать!",
    register_failed: "❌ Ошибка регистрации: {error}",
    main_menu: "Главное меню",
    meal_type_prompt: "Выберите тип приёма пищи:",
    breakfast: "Завтрак", lunch: "Обед", dinner: "Ужин", snack: "Перекус",
    meal_input_prompt: "Отправьте фото еды или напишите название блюда:",
    meal_calories_prompt: "Введите калории:",
    meal_macros_prompt: "Введите белки/жиры/углеводы через пробел (или /skip):",
    meal_saved: "✅ Приём пищи сохранён!\n🍽 {name}\n🔥 {cal} ккал",
    meal_photo_result: "🤖 AI определил:\n🍽 {name}\n🔥 {cal} ккал\nБелки: {p}г | Жиры: {f}г | Углеводы: {c}г\n\nПодтвердить?",
    confirm: "✅ Подтвердить",
    edit: "✏️ Изменить",
    med_prompt: "Выберите лекарство или добавьте новое:",
    med_custom: "Другое (без расписания)",
    med_name_prompt: "Введите название лекарства:",
    med_dosage_prompt: "Введите дозировку:",
    med_time_prompt: "Введите время приёма (ЧЧ:ММ) или /skip для текущего:",
    med_saved: "✅ Приём лекарства записан!\n💊 {name} {dosage} в {time}",
    weight_prompt: "Введите ваш вес в кг:",
    weight_saved: "✅ Вес записан: {weight} кг",
    workout_type_prompt: "Выберите тип тренировки:",
    workout_duration_prompt: "Введите продолжительность (минуты):",
    workout_name_prompt: "Введите название (или /skip):",
    workout_saved: "✅ Тренировка записана!\n🏋️ {type} — {duration} мин",
    today_title: "📊 Сводка за сегодня",
    today_calories: "🔥 Калории: {eaten}/{goal} (осталось: {remaining})",
    today_meals: "🍽 Приёмы пищи:",
    today_no_meals: "Приёмы пищи не записаны",
    today_meds: "💊 Лекарства:",
    today_no_meds: "Лекарства не записаны",
    today_workouts: "🏋️ Тренировки:",
    today_no_workouts: "Тренировок нет",
    today_weight: "⚖️ Вес: {weight} кг",
    today_no_weight: "Вес не записан",
    settings_title: "⚙️ Настройки",
    settings_language: "🌐 Язык",
    settings_phone: "📱 Привязать телефон",
    settings_email: "📧 Моя почта",
    settings_profile: "👤 Профиль",
    language_prompt: "Выберите язык:",
    language_saved: "✅ Язык изменён на {lang}",
    profile_info: "👤 Профиль\nИмя: {name}\nЦель калорий: {goal} ккал",
    profile_name_prompt: "Введите новое имя (или /skip):",
    profile_goal_prompt: "Введите цель калорий (или /skip):",
    profile_saved: "✅ Профиль обновлён!",
    phone_saved: "✅ Телефон привязан: {phone}",
    email_info: "📧 Ваш email: {email}",
    error: "❌ Произошла ошибка. Попробуйте ещё раз.",
    help: "📖 Команды:\n/start — Главное меню\n/meal — Записать приём пищи\n/med — Записать лекарство\n/weight — Записать вес\n/workout — Записать тренировку\n/today — Сводка за сегодня\n/settings — Настройки\n/help — Помощь",
    running: "Бег", walking: "Ходьба", cycling: "Велосипед", strength: "Силовая",
    yoga: "Йога", swimming: "Плавание", hiit: "HIIT", sports: "Спорт", other: "Другое",
    cancel: "Отмена",
    cancelled: "Действие отменено.",
    phone_invalid: "❌ Неверный формат телефона.",
    open_app: "🌐 Открыть приложение",
    open_app_hint: "Открыть полную веб-версию приложения прямо в Telegram",
    kb_meal: "🍽 Еда",
    kb_med: "💊 Лекарство",
    kb_weight: "⚖️ Вес",
    kb_workout: "🏋️ Тренировка",
    kb_today: "📊 Сегодня",
    kb_settings: "⚙️ Настройки",
    choose_language: "Выберите язык / Choose language:",
  },
  en: {
    welcome: "Welcome to Healthy Life! 🌿",
    not_linked: "Your Telegram is not linked to an account. Choose login method:",
    login_email: "Login with email",
    login_phone: "Login with phone",
    enter_email: "Enter your email:",
    enter_password: "Enter your password:",
    enter_phone: "Send your contact using the button below or type your phone number:",
    share_contact: "📱 Share contact",
    login_success: "✅ Login successful! Welcome, {name}!",
    login_failed: "❌ Wrong email or password.",
    register_offer: "Account not found. Would you like to register with these credentials?",
    register_yes: "Yes, register",
    register_no: "No",
    register_success: "✅ Registration successful! Welcome!",
    register_failed: "❌ Registration failed: {error}",
    main_menu: "Main menu",
    meal_type_prompt: "Choose meal type:",
    breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack",
    meal_input_prompt: "Send a photo of your food or type the dish name:",
    meal_calories_prompt: "Enter calories:",
    meal_macros_prompt: "Enter protein/fat/carbs separated by spaces (or /skip):",
    meal_saved: "✅ Meal saved!\n🍽 {name}\n🔥 {cal} kcal",
    meal_photo_result: "🤖 AI detected:\n🍽 {name}\n🔥 {cal} kcal\nProtein: {p}g | Fat: {f}g | Carbs: {c}g\n\nConfirm?",
    confirm: "✅ Confirm",
    edit: "✏️ Edit",
    med_prompt: "Choose a medication or add new:",
    med_custom: "Other (no schedule)",
    med_name_prompt: "Enter medication name:",
    med_dosage_prompt: "Enter dosage:",
    med_time_prompt: "Enter time taken (HH:MM) or /skip for now:",
    med_saved: "✅ Medication intake logged!\n💊 {name} {dosage} at {time}",
    weight_prompt: "Enter your weight in kg:",
    weight_saved: "✅ Weight logged: {weight} kg",
    workout_type_prompt: "Choose workout type:",
    workout_duration_prompt: "Enter duration (minutes):",
    workout_name_prompt: "Enter name (or /skip):",
    workout_saved: "✅ Workout logged!\n🏋️ {type} — {duration} min",
    today_title: "📊 Today's summary",
    today_calories: "🔥 Calories: {eaten}/{goal} (remaining: {remaining})",
    today_meals: "🍽 Meals:",
    today_no_meals: "No meals logged",
    today_meds: "💊 Medications:",
    today_no_meds: "No medications logged",
    today_workouts: "🏋️ Workouts:",
    today_no_workouts: "No workouts",
    today_weight: "⚖️ Weight: {weight} kg",
    today_no_weight: "Weight not logged",
    settings_title: "⚙️ Settings",
    settings_language: "🌐 Language",
    settings_phone: "📱 Link phone",
    settings_email: "📧 My email",
    settings_profile: "👤 Profile",
    language_prompt: "Choose language:",
    language_saved: "✅ Language changed to {lang}",
    profile_info: "👤 Profile\nName: {name}\nCalorie goal: {goal} kcal",
    profile_name_prompt: "Enter new name (or /skip):",
    profile_goal_prompt: "Enter calorie goal (or /skip):",
    profile_saved: "✅ Profile updated!",
    phone_saved: "✅ Phone linked: {phone}",
    email_info: "📧 Your email: {email}",
    error: "❌ An error occurred. Please try again.",
    help: "📖 Commands:\n/start — Main menu\n/meal — Log a meal\n/med — Log medication\n/weight — Log weight\n/workout — Log workout\n/today — Today's summary\n/settings — Settings\n/help — Help",
    running: "Running", walking: "Walking", cycling: "Cycling", strength: "Strength",
    yoga: "Yoga", swimming: "Swimming", hiit: "HIIT", sports: "Sports", other: "Other",
    cancel: "Cancel",
    cancelled: "Action cancelled.",
    phone_invalid: "❌ Invalid phone number format.",
    open_app: "🌐 Open app",
    open_app_hint: "Open the full web app inside Telegram",
    kb_meal: "🍽 Meal",
    kb_med: "💊 Medication",
    kb_weight: "⚖️ Weight",
    kb_workout: "🏋️ Workout",
    kb_today: "📊 Today",
    kb_settings: "⚙️ Settings",
    choose_language: "Choose language / Выберите язык:",
  },
  kk: {
    welcome: "Healthy Life-қа қош келдіңіз! 🌿",
    not_linked: "Telegram аккаунтқа байланыспаған. Кіру әдісін таңдаңыз:",
    login_email: "Email арқылы кіру",
    login_phone: "Телефон арқылы кіру",
    enter_email: "Email-ді енгізіңіз:",
    enter_password: "Құпия сөзді енгізіңіз:",
    enter_phone: "Контактты жіберіңіз немесе телефон нөмірін жазыңыз:",
    share_contact: "📱 Контакт жіберу",
    login_success: "✅ Сәтті кірдіңіз! Қош келдіңіз, {name}!",
    login_failed: "❌ Қате email немесе құпия сөз.",
    register_offer: "Аккаунт табылмады. Тіркелгіңіз келе ме?",
    register_yes: "Иә, тіркелу",
    register_no: "Жоқ",
    register_success: "✅ Тіркелу сәтті! Қош келдіңіз!",
    register_failed: "❌ Тіркелу қатесі: {error}",
    main_menu: "Басты мәзір",
    meal_type_prompt: "Тамақ түрін таңдаңыз:",
    breakfast: "Таңғы ас", lunch: "Түскі ас", dinner: "Кешкі ас", snack: "Тіскебасар",
    meal_input_prompt: "Тамақ суретін жіберіңіз немесе атауын жазыңыз:",
    meal_calories_prompt: "Калорияны енгізіңіз:",
    meal_macros_prompt: "Ақуыз/май/көмірсулар бос орынмен (немесе /skip):",
    meal_saved: "✅ Тамақ сақталды!\n🍽 {name}\n🔥 {cal} ккал",
    meal_photo_result: "🤖 AI анықтады:\n🍽 {name}\n🔥 {cal} ккал\nАқуыз: {p}г | Май: {f}г | Көмірсулар: {c}г\n\nРастайсыз ба?",
    confirm: "✅ Растау",
    edit: "✏️ Өзгерту",
    med_prompt: "Дәріні таңдаңыз немесе жаңа қосыңыз:",
    med_custom: "Басқа (кестесіз)",
    med_name_prompt: "Дәрі атауын енгізіңіз:",
    med_dosage_prompt: "Дозасын енгізіңіз:",
    med_time_prompt: "Қабылдау уақытын енгізіңіз (СС:ММ) немесе /skip:",
    med_saved: "✅ Дәрі қабылдау жазылды!\n💊 {name} {dosage} {time}",
    weight_prompt: "Салмақты кг-мен енгізіңіз:",
    weight_saved: "✅ Салмақ жазылды: {weight} кг",
    workout_type_prompt: "Жаттығу түрін таңдаңыз:",
    workout_duration_prompt: "Ұзақтығын енгізіңіз (минут):",
    workout_name_prompt: "Атауын енгізіңіз (немесе /skip):",
    workout_saved: "✅ Жаттығу жазылды!\n🏋️ {type} — {duration} мин",
    today_title: "📊 Бүгінгі қорытынды",
    today_calories: "🔥 Калория: {eaten}/{goal} (қалды: {remaining})",
    today_meals: "🍽 Тамақтану:",
    today_no_meals: "Тамақтану жазылмаған",
    today_meds: "💊 Дәрілер:",
    today_no_meds: "Дәрілер жазылмаған",
    today_workouts: "🏋️ Жаттығулар:",
    today_no_workouts: "Жаттығулар жоқ",
    today_weight: "⚖️ Салмақ: {weight} кг",
    today_no_weight: "Салмақ жазылмаған",
    settings_title: "⚙️ Баптаулар",
    settings_language: "🌐 Тіл",
    settings_phone: "📱 Телефон байлау",
    settings_email: "📧 Менің email",
    settings_profile: "👤 Профиль",
    language_prompt: "Тілді таңдаңыз:",
    language_saved: "✅ Тіл {lang} болып өзгертілді",
    profile_info: "👤 Профиль\nАты: {name}\nКалория мақсаты: {goal} ккал",
    profile_name_prompt: "Жаңа атын енгізіңіз (немесе /skip):",
    profile_goal_prompt: "Калория мақсатын енгізіңіз (немесе /skip):",
    profile_saved: "✅ Профиль жаңартылды!",
    phone_saved: "✅ Телефон байланды: {phone}",
    email_info: "📧 Сіздің email: {email}",
    error: "❌ Қате орын алды. Қайталап көріңіз.",
    help: "📖 Командалар:\n/start — Басты мәзір\n/meal — Тамақ жазу\n/med — Дәрі жазу\n/weight — Салмақ жазу\n/workout — Жаттығу жазу\n/today — Бүгінгі қорытынды\n/settings — Баптаулар\n/help — Көмек",
    running: "Жүгіру", walking: "Жүру", cycling: "Велосипед", strength: "Күшті",
    yoga: "Йога", swimming: "Жүзу", hiit: "HIIT", sports: "Спорт", other: "Басқа",
    cancel: "Болдырмау",
    cancelled: "Әрекет тоқтатылды.",
    phone_invalid: "❌ Телефон нөмірі қате форматта.",
    open_app: "🌐 Ашу",
    open_app_hint: "Толық веб-қосымшаны Telegram ішінде ашу",
    kb_meal: "🍽 Тамақ",
    kb_med: "💊 Дәрі",
    kb_weight: "⚖️ Салмақ",
    kb_workout: "🏋️ Жаттығу",
    kb_today: "📊 Бүгін",
    kb_settings: "⚙️ Баптаулар",
    choose_language: "Тілді таңдаңыз / Choose language:",
  },
};

function botT(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const lang = translations[locale] ? locale : translations[locale?.slice(0, 2)] ? locale.slice(0, 2) : "en";
  let text = translations[lang]?.[key] ?? translations.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

// ─── State machine ────────────────────────────────────────────────────────────

interface UserState {
  step: string;
  profileId?: string;
  locale?: string;
  data?: Record<string, any>;
}

const states = new Map<number, UserState>();

function getState(chatId: number): UserState | undefined {
  return states.get(chatId);
}
function setState(chatId: number, state: UserState) {
  states.set(chatId, state);
}
function clearState(chatId: number) {
  states.delete(chatId);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr(timezone = "UTC"): string {
  try {
    const d = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
    const y = parts.find(p => p.type === "year")!.value;
    const m = parts.find(p => p.type === "month")!.value;
    const dd = parts.find(p => p.type === "day")!.value;
    return `${y}-${m}-${dd}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function nowTime(timezone = "UTC"): string {
  try {
    const d = new Date();
    return d.toLocaleTimeString("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return new Date().toISOString().slice(11, 16);
  }
}

async function getProfileByChatId(chatId: number) {
  return prisma.profile.findUnique({ where: { telegramChatId: String(chatId) } });
}

function mainKeyboard(locale = "ru"): Keyboard {
  return new Keyboard()
    .text(botT(locale, "kb_meal")).text(botT(locale, "kb_med")).row()
    .text(botT(locale, "kb_weight")).text(botT(locale, "kb_workout")).row()
    .text(botT(locale, "kb_today")).text(botT(locale, "kb_settings")).row()
    .webApp(botT(locale, "open_app"), WEB_APP_URL)
    .resized().persistent();
}

/** Reply with persistent keyboard always visible. */
async function replyWithKb(ctx: Context, text: string, locale = "ru") {
  await ctx.reply(text, { reply_markup: mainKeyboard(locale) });
}

async function requireAuth(ctx: Context): Promise<{ profileId: string; locale: string; timezone: string } | null> {
  const chatId = ctx.chat?.id;
  if (!chatId) return null;
  const profile = await getProfileByChatId(chatId);
  if (!profile) {
    const st = getState(chatId);
    const locale = st?.locale || "ru";
    await ctx.reply(botT(locale, "not_linked"), {
      reply_markup: new InlineKeyboard()
        .text(botT(locale, "login_email"), "auth:email")
        .text(botT(locale, "login_phone"), "auth:phone"),
    });
    return null;
  }
  return { profileId: profile.id, locale: profile.preferredLocale, timezone: profile.timezone };
}

// ─── Auth flows ───────────────────────────────────────────────────────────────

async function trySignIn(email: string, password: string) {
  const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
  return { user: data?.user, error };
}

async function trySignUp(email: string, password: string) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  return { user: data?.user, error };
}

async function linkProfile(userId: string, chatId: number, phone?: string) {
  let profile = await prisma.profile.findUnique({ where: { userId } });
  if (profile) {
    const updateData: any = { telegramChatId: String(chatId) };
    if (phone) updateData.phone = phone;
    profile = await prisma.profile.update({ where: { id: profile.id }, data: updateData });
  } else {
    profile = await prisma.profile.create({
      data: { userId, telegramChatId: String(chatId), ...(phone ? { phone } : {}) },
    });
  }
  return profile;
}

// ─── Command handlers ─────────────────────────────────────────────────────────

bot.command("start", async (ctx) => {
  const chatId = ctx.chat.id;
  clearState(chatId);
  const profile = await getProfileByChatId(chatId);
  if (profile) {
    const l = profile.preferredLocale;
    await ctx.reply(botT(l, "welcome") + "\n" + botT(l, "main_menu"), { reply_markup: mainKeyboard(l) });
  } else {
    // New user — show language selection first
    const kb = new InlineKeyboard();
    const entries = Object.entries(LOCALES_META);
    for (let i = 0; i < entries.length; i++) {
      const [code, name] = entries[i];
      kb.text(name, `start_lang:${code}`);
      if ((i + 1) % 3 === 0) kb.row();
    }
    await ctx.reply("🌿 Healthy Life\n\n" + botT("en", "choose_language"), { reply_markup: kb });
  }
});

bot.command("help", async (ctx) => {
  const profile = await getProfileByChatId(ctx.chat.id);
  const l = profile?.preferredLocale || "ru";
  await replyWithKb(ctx, botT(l, "help"), l);
});

bot.command("cancel", async (ctx) => {
  clearState(ctx.chat.id);
  const profile = await getProfileByChatId(ctx.chat.id);
  const l = profile?.preferredLocale || "ru";
  await replyWithKb(ctx, botT(l, "cancelled"), l);
});

async function startMealFlow(ctx: Context) {
  const auth = await requireAuth(ctx);
  if (!auth) return;
  const { profileId, locale } = auth;
  setState(ctx.chat!.id, { step: "meal:type", profileId, locale, data: {} });
  await ctx.reply(botT(locale, "meal_type_prompt"), {
    reply_markup: new InlineKeyboard()
      .text(botT(locale, "breakfast"), "meal_type:breakfast")
      .text(botT(locale, "lunch"), "meal_type:lunch").row()
      .text(botT(locale, "dinner"), "meal_type:dinner")
      .text(botT(locale, "snack"), "meal_type:snack"),
  });
}

async function startMedFlow(ctx: Context) {
  const auth = await requireAuth(ctx);
  if (!auth) return;
  const { profileId, locale } = auth;
  const plans = await prisma.medicationPlan.findMany({ where: { profileId, active: true } });
  const kb = new InlineKeyboard();
  for (const plan of plans) {
    kb.text(`${plan.name}${plan.dosage ? ` (${plan.dosage})` : ""}`, `med_plan:${plan.id}`).row();
  }
  kb.text(botT(locale, "med_custom"), "med_plan:custom");
  setState(ctx.chat!.id, { step: "med:choose", profileId, locale, data: {} });
  await ctx.reply(botT(locale, "med_prompt"), { reply_markup: kb });
}

async function startWeightFlow(ctx: Context) {
  const auth = await requireAuth(ctx);
  if (!auth) return;
  const { profileId, locale } = auth;
  setState(ctx.chat!.id, { step: "weight:input", profileId, locale, data: {} });
  await ctx.reply(botT(locale, "weight_prompt"));
}

async function startWorkoutFlow(ctx: Context) {
  const auth = await requireAuth(ctx);
  if (!auth) return;
  const { profileId, locale } = auth;
  const types = ["running", "walking", "cycling", "strength", "yoga", "swimming", "hiit", "sports", "other"];
  const kb = new InlineKeyboard();
  for (let i = 0; i < types.length; i++) {
    kb.text(botT(locale, types[i]), `workout_type:${types[i]}`);
    if ((i + 1) % 3 === 0) kb.row();
  }
  setState(ctx.chat!.id, { step: "workout:type", profileId, locale, data: {} });
  await ctx.reply(botT(locale, "workout_type_prompt"), { reply_markup: kb });
}

async function showToday(ctx: Context) {
  const auth = await requireAuth(ctx);
  if (!auth) return;
  const { profileId, locale, timezone } = auth;
  const today = todayStr(timezone);
  const profile = await prisma.profile.findUnique({ where: { id: profileId } });
  const meals = await prisma.meal.findMany({ where: { profileId, date: today }, orderBy: { createdAt: "asc" } });
  const intakes = await prisma.medicationIntake.findMany({ where: { profileId, date: today }, orderBy: { createdAt: "asc" } });
  const workouts = await prisma.workout.findMany({ where: { profileId, date: today }, orderBy: { createdAt: "asc" } });
  const weight = await prisma.weightEntry.findUnique({ where: { profileId_date: { profileId, date: today } } });

  const goal = profile?.dailyCalorieGoal || 2000;
  const eaten = meals.reduce((s, m) => s + m.calories, 0);
  const remaining = Math.max(0, goal - eaten);

  let text = botT(locale, "today_title") + "\n\n";
  text += botT(locale, "today_calories", { eaten: Math.round(eaten), goal, remaining: Math.round(remaining) }) + "\n\n";

  if (meals.length > 0) {
    text += botT(locale, "today_meals") + "\n";
    for (const m of meals) {
      text += `  • ${m.name} — ${Math.round(m.calories)} kcal\n`;
    }
  } else {
    text += botT(locale, "today_no_meals") + "\n";
  }
  text += "\n";

  if (intakes.length > 0) {
    text += botT(locale, "today_meds") + "\n";
    for (const i of intakes) {
      text += `  • ${i.name}${i.dosage ? ` (${i.dosage})` : ""} — ${i.takenTime}\n`;
    }
  } else {
    text += botT(locale, "today_no_meds") + "\n";
  }
  text += "\n";

  if (workouts.length > 0) {
    text += botT(locale, "today_workouts") + "\n";
    for (const w of workouts) {
      text += `  • ${botT(locale, w.type)} — ${w.quantity} ${w.unit}\n`;
    }
  } else {
    text += botT(locale, "today_no_workouts") + "\n";
  }
  text += "\n";

  if (weight) {
    text += botT(locale, "today_weight", { weight: weight.weightKg });
  } else {
    text += botT(locale, "today_no_weight");
  }

  await replyWithKb(ctx, text, locale);
}

async function showSettings(ctx: Context) {
  const auth = await requireAuth(ctx);
  if (!auth) return;
  const { profileId, locale } = auth;
  const profile = await prisma.profile.findUnique({ where: { id: profileId } });
  const kb = new InlineKeyboard()
    .text(botT(locale, "settings_language"), "settings:language").row()
    .text(botT(locale, "settings_profile"), "settings:profile").row()
    .text(botT(locale, "settings_email"), "settings:email").row();
  if (!profile?.phone) {
    kb.text(botT(locale, "settings_phone"), "settings:phone").row();
  }
  await ctx.reply(botT(locale, "settings_title"), { reply_markup: kb });
}

bot.command("meal", startMealFlow);
bot.command("med", startMedFlow);
bot.command("weight", startWeightFlow);
bot.command("workout", startWorkoutFlow);
bot.command("today", showToday);
bot.command("settings", showSettings);

// ─── Callback queries ─────────────────────────────────────────────────────────

bot.on("callback_query:data", async (ctx) => {
  const data = ctx.callbackQuery.data;
  const chatId = ctx.chat!.id;
  await ctx.answerCallbackQuery();

  try {
    // Language selection on first start
    if (data.startsWith("start_lang:")) {
      const locale = data.split(":")[1];
      setState(chatId, { step: "awaiting_auth", locale, data: {} });
      await ctx.reply(botT(locale, "welcome") + "\n\n" + botT(locale, "not_linked"), {
        reply_markup: new InlineKeyboard()
          .text(botT(locale, "login_email"), "auth:email")
          .text(botT(locale, "login_phone"), "auth:phone"),
      });
      return;
    }

    // Auth callbacks
    if (data === "auth:email") {
      const st = getState(chatId);
      const locale = st?.locale || "ru";
      setState(chatId, { step: "auth:email", locale, data: {} });
      await ctx.reply(botT(locale, "enter_email"));
      return;
    }
    if (data === "auth:phone") {
      const st = getState(chatId);
      const locale = st?.locale || "ru";
      setState(chatId, { step: "auth:phone", locale, data: {} });
      const kb = new Keyboard().requestContact(botT(locale, "share_contact")).resized().oneTime();
      await ctx.reply(botT(locale, "enter_phone"), { reply_markup: kb });
      return;
    }
    if (data === "auth:register_yes") {
      const st = getState(chatId);
      if (!st?.data?.email || !st?.data?.password) return;
      const locale = st.locale || "ru";
      const { user, error } = await trySignUp(st.data.email, st.data.password);
      if (error || !user) {
        await ctx.reply(botT(locale, "register_failed", { error: error?.message || "unknown" }));
        clearState(chatId);
        return;
      }
      const profile = await linkProfile(user.id, chatId, st.data.phone);
      if (locale !== profile.preferredLocale) {
        await prisma.profile.update({ where: { id: profile.id }, data: { preferredLocale: locale } });
      }
      clearState(chatId);
      await ctx.reply(botT(locale, "register_success"), { reply_markup: mainKeyboard(locale) });
      return;
    }
    if (data === "auth:register_no") {
      const st = getState(chatId);
      clearState(chatId);
      await replyWithKb(ctx, botT(st?.locale || "ru", "cancelled"), st?.locale || "ru");
      return;
    }

    // Meal type
    if (data.startsWith("meal_type:")) {
      const mealType = data.split(":")[1];
      const st = getState(chatId);
      if (!st) return;
      st.data!.mealType = mealType;
      st.step = "meal:input";
      await ctx.reply(botT(st.locale!, "meal_input_prompt"));
      return;
    }

    // Meal photo confirm/edit
    if (data === "meal:confirm") {
      const st = getState(chatId);
      if (!st?.data?.aiResult) return;
      const { aiResult, mealType } = st.data;
      const profile = await prisma.profile.findUnique({ where: { id: st.profileId } });
      const today = todayStr(profile?.timezone);
      await prisma.meal.create({
        data: {
          profileId: st.profileId!,
          date: today,
          mealType: mealType || "snack",
          name: aiResult.name,
          calories: aiResult.calories,
          protein: aiResult.protein,
          carbs: aiResult.carbs,
          fat: aiResult.fat,
          aiDetectedName: aiResult.name,
          aiCalories: aiResult.calories,
        },
      });
      clearState(chatId);
      await replyWithKb(ctx, botT(st.locale!, "meal_saved", { name: aiResult.name, cal: Math.round(aiResult.calories) }), st.locale!);
      return;
    }
    if (data === "meal:edit") {
      const st = getState(chatId);
      if (!st) return;
      st.step = "meal:text_name";
      st.data!.aiResult = undefined;
      await ctx.reply(botT(st.locale!, "meal_input_prompt"));
      return;
    }

    // Med plan selection
    if (data.startsWith("med_plan:")) {
      const st = getState(chatId);
      if (!st) return;
      const planId = data.split(":")[1];
      if (planId === "custom") {
        st.step = "med:name";
        await ctx.reply(botT(st.locale!, "med_name_prompt"));
      } else {
        const plan = await prisma.medicationPlan.findUnique({ where: { id: planId } });
        if (!plan) return;
        st.data!.planId = plan.id;
        st.data!.name = plan.name;
        st.data!.dosage = plan.dosage || "";
        st.step = "med:time";
        await ctx.reply(botT(st.locale!, "med_time_prompt"));
      }
      return;
    }

    // Workout type
    if (data.startsWith("workout_type:")) {
      const st = getState(chatId);
      if (!st) return;
      st.data!.type = data.split(":")[1];
      st.step = "workout:duration";
      await ctx.reply(botT(st.locale!, "workout_duration_prompt"));
      return;
    }

    // Settings
    if (data === "settings:language") {
      const profile = await getProfileByChatId(chatId);
      const l = profile?.preferredLocale || "en";
      const kb = new InlineKeyboard();
      const entries = Object.entries(LOCALES_META);
      for (let i = 0; i < entries.length; i++) {
        const [code, name] = entries[i];
        kb.text(name, `lang:${code}`);
        if ((i + 1) % 3 === 0) kb.row();
      }
      await ctx.reply(botT(l, "language_prompt"), { reply_markup: kb });
      return;
    }
    if (data.startsWith("lang:")) {
      const locale = data.split(":")[1];
      const profile = await getProfileByChatId(chatId);
      if (profile) {
        await prisma.profile.update({ where: { id: profile.id }, data: { preferredLocale: locale } });
      }
      await replyWithKb(ctx, botT(locale, "language_saved", { lang: LOCALES_META[locale] || locale }), locale);
      return;
    }
    if (data === "settings:profile") {
      const profile = await getProfileByChatId(chatId);
      if (!profile) return;
      const l = profile.preferredLocale;
      await ctx.reply(botT(l, "profile_info", { name: profile.name, goal: profile.dailyCalorieGoal }));
      setState(chatId, { step: "settings:name", profileId: profile.id, locale: l, data: {} });
      await ctx.reply(botT(l, "profile_name_prompt"));
      return;
    }
    if (data === "settings:email") {
      const profile = await getProfileByChatId(chatId);
      if (!profile?.userId) return;
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(profile.userId);
      const email = userData?.user?.email || "—";
      await ctx.reply(botT(profile.preferredLocale, "email_info", { email }));
      return;
    }
    if (data === "settings:phone") {
      const profile = await getProfileByChatId(chatId);
      if (!profile) return;
      setState(chatId, { step: "settings:phone", profileId: profile.id, locale: profile.preferredLocale, data: {} });
      const kb = new Keyboard().requestContact(botT(profile.preferredLocale, "share_contact")).resized().oneTime();
      await ctx.reply(botT(profile.preferredLocale, "enter_phone"), { reply_markup: kb });
      return;
    }
  } catch (e: any) {
    console.error("Callback error:", e);
    await ctx.reply(botT("ru", "error"));
  }
});

// ─── Contact handler ──────────────────────────────────────────────────────────

bot.on("message:contact", async (ctx) => {
  const chatId = ctx.chat.id;
  const st = getState(chatId);
  const phone = ctx.message.contact.phone_number;

  if (st?.step === "auth:phone") {
    try {
      const normalized = normalizePhone(phone);
      st.data!.phone = normalized;
      st.step = "auth:phone_password";
      await ctx.reply(botT("ru", "enter_password"));
    } catch {
      await ctx.reply(botT("ru", "phone_invalid"));
    }
    return;
  }

  if (st?.step === "settings:phone") {
    try {
      const normalized = normalizePhone(phone);
      await prisma.profile.update({ where: { id: st.profileId }, data: { phone: normalized } });
      clearState(chatId);
      await replyWithKb(ctx, botT(st.locale!, "phone_saved", { phone: normalized }), st.locale!);
    } catch {
      await ctx.reply(botT(st.locale || "ru", "phone_invalid"));
    }
    return;
  }
});

// ─── Text message handler ─────────────────────────────────────────────────────

// Build a set of all possible keyboard labels → action mappings
const KB_ACTIONS: Record<string, (ctx: Context) => Promise<void>> = {};
for (const locale of Object.keys(translations)) {
  const t = translations[locale];
  if (t.kb_meal) KB_ACTIONS[t.kb_meal] = startMealFlow;
  if (t.kb_med) KB_ACTIONS[t.kb_med] = startMedFlow;
  if (t.kb_weight) KB_ACTIONS[t.kb_weight] = startWeightFlow;
  if (t.kb_workout) KB_ACTIONS[t.kb_workout] = startWorkoutFlow;
  if (t.kb_today) KB_ACTIONS[t.kb_today] = showToday;
  if (t.kb_settings) KB_ACTIONS[t.kb_settings] = showSettings;
}

bot.on("message:text", async (ctx) => {
  const chatId = ctx.chat.id;
  const text = ctx.message.text.trim();

  // Handle reply keyboard buttons
  const action = KB_ACTIONS[text];
  if (action) return action(ctx);

  const st = getState(chatId);
  if (!st) return;

  try {
    // Auth: email flow
    if (st.step === "auth:email") {
      st.data!.email = text;
      st.step = "auth:email_password";
      await ctx.reply(botT("ru", "enter_password"));
      return;
    }
    if (st.step === "auth:email_password") {
      const email = st.data!.email;
      const password = text;
      const locale = st.locale || "ru";
      st.data!.password = password;
      const { user, error } = await trySignIn(email, password);
      if (user) {
        const profile = await linkProfile(user.id, chatId);
        if (locale !== profile.preferredLocale) {
          await prisma.profile.update({ where: { id: profile.id }, data: { preferredLocale: locale } });
        }
        clearState(chatId);
        await ctx.reply(botT(locale, "login_success", { name: profile.name }), { reply_markup: mainKeyboard(locale) });
      } else {
        await ctx.reply(botT(locale, "login_failed") + "\n\n" + botT(locale, "register_offer"), {
          reply_markup: new InlineKeyboard()
            .text(botT(locale, "register_yes"), "auth:register_yes")
            .text(botT(locale, "register_no"), "auth:register_no"),
        });
      }
      return;
    }

    // Auth: phone flow
    if (st.step === "auth:phone") {
      const locale = st.locale || "ru";
      try {
        const normalized = normalizePhone(text);
        st.data!.phone = normalized;
        st.step = "auth:phone_password";
        await ctx.reply(botT(locale, "enter_password"));
      } catch {
        await ctx.reply(botT(locale, "phone_invalid"));
      }
      return;
    }
    if (st.step === "auth:phone_password") {
      const phone = st.data!.phone;
      const password = text;
      const locale = st.locale || "ru";
      st.data!.password = password;
      const candidates = phoneAuthEmailCandidates(phone);
      let loggedIn = false;
      for (const email of candidates) {
        const { user } = await trySignIn(email, password);
        if (user) {
          const profile = await linkProfile(user.id, chatId, phone);
          if (locale !== profile.preferredLocale) {
            await prisma.profile.update({ where: { id: profile.id }, data: { preferredLocale: locale } });
          }
          clearState(chatId);
          await ctx.reply(botT(locale, "login_success", { name: profile.name }), { reply_markup: mainKeyboard(locale) });
          loggedIn = true;
          break;
        }
      }
      if (!loggedIn) {
        st.data!.email = phoneToEmail(phone);
        await ctx.reply(botT(locale, "login_failed") + "\n\n" + botT(locale, "register_offer"), {
          reply_markup: new InlineKeyboard()
            .text(botT(locale, "register_yes"), "auth:register_yes")
            .text(botT(locale, "register_no"), "auth:register_no"),
        });
      }
      return;
    }

    // Meal: text name
    if (st.step === "meal:input" || st.step === "meal:text_name") {
      st.data!.name = text;
      st.step = "meal:calories";
      await ctx.reply(botT(st.locale!, "meal_calories_prompt"));
      return;
    }
    if (st.step === "meal:calories") {
      const cal = parseFloat(text);
      if (isNaN(cal) || cal <= 0) {
        await ctx.reply(botT(st.locale!, "meal_calories_prompt"));
        return;
      }
      st.data!.calories = cal;
      st.step = "meal:macros";
      await ctx.reply(botT(st.locale!, "meal_macros_prompt"));
      return;
    }
    if (st.step === "meal:macros") {
      let protein: number | undefined, fat: number | undefined, carbs: number | undefined;
      if (text !== "/skip") {
        const parts = text.split(/[\s,/]+/).map(Number);
        if (parts.length >= 3 && parts.every(n => !isNaN(n))) {
          [protein, fat, carbs] = parts;
        }
      }
      const profile = await prisma.profile.findUnique({ where: { id: st.profileId } });
      const today = todayStr(profile?.timezone);
      await prisma.meal.create({
        data: {
          profileId: st.profileId!,
          date: today,
          mealType: st.data!.mealType || "snack",
          name: st.data!.name,
          calories: st.data!.calories,
          protein, fat, carbs,
        },
      });
      await replyWithKb(ctx, botT(st.locale!, "meal_saved", { name: st.data!.name, cal: Math.round(st.data!.calories) }), st.locale!);
      clearState(chatId);
      return;
    }

    // Med flow
    if (st.step === "med:name") {
      st.data!.name = text;
      st.step = "med:dosage";
      await ctx.reply(botT(st.locale!, "med_dosage_prompt"));
      return;
    }
    if (st.step === "med:dosage") {
      st.data!.dosage = text;
      st.step = "med:time";
      await ctx.reply(botT(st.locale!, "med_time_prompt"));
      return;
    }
    if (st.step === "med:time") {
      const profile = await prisma.profile.findUnique({ where: { id: st.profileId } });
      const tz = profile?.timezone || "UTC";
      const today = todayStr(tz);
      const time = text === "/skip" ? nowTime(tz) : text;
      await prisma.medicationIntake.create({
        data: {
          profileId: st.profileId!,
          planId: st.data!.planId || null,
          date: today,
          name: st.data!.name,
          dosage: st.data!.dosage || null,
          takenTime: time,
        },
      });
      await replyWithKb(ctx, botT(st.locale!, "med_saved", { name: st.data!.name, dosage: st.data!.dosage || "", time }), st.locale!);
      clearState(chatId);
      return;
    }

    // Weight flow
    if (st.step === "weight:input") {
      const w = parseFloat(text.replace(",", "."));
      if (isNaN(w) || w <= 0) {
        await ctx.reply(botT(st.locale!, "weight_prompt"));
        return;
      }
      const profile = await prisma.profile.findUnique({ where: { id: st.profileId } });
      const today = todayStr(profile?.timezone);
      await prisma.weightEntry.upsert({
        where: { profileId_date: { profileId: st.profileId!, date: today } },
        create: { profileId: st.profileId!, date: today, weightKg: w },
        update: { weightKg: w },
      });
      await replyWithKb(ctx, botT(st.locale!, "weight_saved", { weight: w }), st.locale!);
      clearState(chatId);
      return;
    }

    // Workout flow
    if (st.step === "workout:duration") {
      const dur = parseFloat(text);
      if (isNaN(dur) || dur <= 0) {
        await ctx.reply(botT(st.locale!, "workout_duration_prompt"));
        return;
      }
      st.data!.duration = dur;
      st.step = "workout:name";
      await ctx.reply(botT(st.locale!, "workout_name_prompt"));
      return;
    }
    if (st.step === "workout:name") {
      const name = text === "/skip" ? null : text;
      const profile = await prisma.profile.findUnique({ where: { id: st.profileId } });
      const today = todayStr(profile?.timezone);
      await prisma.workout.create({
        data: {
          profileId: st.profileId!,
          date: today,
          type: st.data!.type,
          quantity: st.data!.duration,
          unit: "minutes",
          name,
        },
      });
      await replyWithKb(ctx, botT(st.locale!, "workout_saved", { type: botT(st.locale!, st.data!.type), duration: st.data!.duration }), st.locale!);
      clearState(chatId);
      return;
    }

    // Settings: profile name/goal
    if (st.step === "settings:name") {
      if (text !== "/skip") {
        await prisma.profile.update({ where: { id: st.profileId }, data: { name: text } });
      }
      st.step = "settings:goal";
      await ctx.reply(botT(st.locale!, "profile_goal_prompt"));
      return;
    }
    if (st.step === "settings:goal") {
      if (text !== "/skip") {
        const goal = parseInt(text, 10);
        if (!isNaN(goal) && goal > 0) {
          await prisma.profile.update({ where: { id: st.profileId }, data: { dailyCalorieGoal: goal } });
        }
      }
      clearState(chatId);
      await replyWithKb(ctx, botT(st.locale!, "profile_saved"), st.locale!);
      return;
    }

    // Settings: phone (typed manually)
    if (st.step === "settings:phone") {
      try {
        const normalized = normalizePhone(text);
        await prisma.profile.update({ where: { id: st.profileId }, data: { phone: normalized } });
        clearState(chatId);
        await replyWithKb(ctx, botT(st.locale!, "phone_saved", { phone: normalized }), st.locale!);
      } catch {
        await ctx.reply(botT(st.locale || "ru", "phone_invalid"));
      }
      return;
    }
  } catch (e: any) {
    console.error("Text handler error:", e);
    await ctx.reply(botT(st?.locale || "ru", "error"));
  }
});

// ─── Photo handler (meal) ─────────────────────────────────────────────────────

bot.on("message:photo", async (ctx) => {
  const chatId = ctx.chat.id;
  const st = getState(chatId);
  if (!st || st.step !== "meal:input") return;

  try {
    const photo = ctx.message.photo;
    const fileId = photo[photo.length - 1].file_id;
    const file = await ctx.api.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a nutrition analyst. Analyze the food in the image. Return ONLY valid JSON: {\"name\": string, \"calories\": number, \"protein\": number, \"fat\": number, \"carbs\": number}. Estimate reasonable values. Name should be in Russian.",
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: fileUrl } },
            { type: "text", text: "What food is this? Estimate nutrition." },
          ],
        },
      ],
      max_tokens: 300,
    });

    const raw = response.choices[0]?.message?.content || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in AI response");
    const result = JSON.parse(jsonMatch[0]);

    st.data!.aiResult = result;
    st.step = "meal:photo_confirm";
    await ctx.reply(
      botT(st.locale!, "meal_photo_result", {
        name: result.name,
        cal: Math.round(result.calories),
        p: Math.round(result.protein || 0),
        f: Math.round(result.fat || 0),
        c: Math.round(result.carbs || 0),
      }),
      {
        reply_markup: new InlineKeyboard()
          .text(botT(st.locale!, "confirm"), "meal:confirm")
          .text(botT(st.locale!, "edit"), "meal:edit"),
      },
    );
  } catch (e: any) {
    console.error("Photo analysis error:", e);
    st.step = "meal:text_name";
    await ctx.reply(botT(st.locale!, "error") + "\n" + botT(st.locale!, "meal_input_prompt"));
  }
});

// ─── Register commands & start ────────────────────────────────────────────────

bot.catch((err) => {
  console.error("Bot error:", err);
});

async function main() {
  await bot.api.setMyCommands([
    { command: "start", description: "Start / Main menu" },
    { command: "meal", description: "Log a meal" },
    { command: "med", description: "Log medication" },
    { command: "weight", description: "Log weight" },
    { command: "workout", description: "Log workout" },
    { command: "today", description: "Today's summary" },
    { command: "settings", description: "Settings" },
    { command: "help", description: "Help" },
  ]);

  await bot.api.setChatMenuButton({
    menu_button: { type: "commands" },
  });

  console.log("🤖 Healthy Life bot is running...");
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await bot.start();
      break;
    } catch (e: any) {
      if (e?.error_code === 409 && attempt < 4) {
        console.warn(`409 conflict, retrying in ${10 * (attempt + 1)}s...`);
        await new Promise((r) => setTimeout(r, 10_000 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
}

main().catch(console.error);
