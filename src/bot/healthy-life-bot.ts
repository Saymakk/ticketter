import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { randomUUID } from "crypto";

if (process.platform === "win32") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

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
const PHOTOS_BUCKET = process.env.HEALTHY_LIFE_SUPABASE_MEAL_PHOTOS_BUCKET || "meal-photos";

const prisma = new PrismaClient();
const supabaseAdmin: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const supabaseAnon: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const bot = new Bot(BOT_TOKEN);

// ─── Phone helpers ────────────────────────────────────────────────────────────

function normalizePhone(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  if (digits.length === 10) digits = `7${digits}`;
  if (digits.length === 11 && digits.startsWith("7")) return digits;
  throw new Error("Invalid phone format");
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

const AI_LANGUAGE: Record<string, string> = {
  ru: "Russian", en: "English", kk: "Kazakh", ar: "Arabic", zh: "Chinese",
  fr: "French", es: "Spanish", ky: "Kyrgyz", uz: "Uzbek", ko: "Korean", ja: "Japanese",
};

const translations: Record<string, Record<string, string>> = {
  ru: {
    welcome: "Добро пожаловать в Healthy Life! 🌿",
    not_linked: "Ваш Telegram не привязан к аккаунту. Выберите способ входа:",
    login_email: "📧 Войти по почте", login_phone: "📱 Войти по телефону",
    enter_email: "Введите ваш email:", enter_password: "Введите пароль:",
    enter_phone: "Отправьте контакт кнопкой ниже или введите номер телефона:",
    share_contact: "📱 Отправить контакт",
    login_success: "✅ Вход выполнен! Добро пожаловать, {name}!",
    login_failed: "❌ Неверный email или пароль.",
    register_offer: "Аккаунт не найден. Хотите зарегистрироваться?",
    register_yes: "Да, зарегистрироваться", register_no: "Нет",
    register_success: "✅ Регистрация успешна!", register_failed: "❌ Ошибка: {error}",
    main_menu: "Выберите действие:",
    meal_type_prompt: "Выберите тип приёма пищи:",
    breakfast: "🌅 Завтрак", lunch: "☀️ Обед", dinner: "🌙 Ужин", snack: "🍎 Перекус",
    meal_input_prompt: "📷 Отправьте фото еды или напишите название блюда:",
    meal_calories_prompt: "Введите калории:", meal_macros_prompt: "Белки/жиры/углеводы через пробел (или /skip):",
    meal_saved: "✅ Приём пищи сохранён!\n🍽 {name}\n🔥 {cal} ккал",
    meal_photo_analyzing: "🔍 Анализирую фото...",
    meal_photo_result: "🤖 AI определил:\n🍽 {name}\n🔥 {cal} ккал\nБелки: {p}г | Жиры: {f}г | Углеводы: {c}г",
    confirm: "✅ Подтвердить", edit: "✏️ Ввести вручную",
    med_prompt: "Выберите лекарство или добавьте новое:", med_custom: "➕ Другое",
    med_name_prompt: "Название лекарства:", med_dosage_prompt: "Дозировка:",
    med_time_prompt: "Время приёма (ЧЧ:ММ) или /skip:", med_saved: "✅ 💊 {name} {dosage} в {time}",
    weight_prompt: "Введите вес (кг):", weight_saved: "✅ Вес: {weight} кг",
    workout_type_prompt: "Тип тренировки:", workout_duration_prompt: "Продолжительность (мин):",
    workout_name_prompt: "Название (или /skip):", workout_saved: "✅ 🏋️ {type} — {duration} мин",
    today_title: "📊 Сводка за сегодня",
    today_calories: "🔥 {eaten}/{goal} ккал (осталось: {remaining})",
    today_meals: "\n🍽 Приёмы пищи:", today_no_meals: "\n🍽 Приёмы пищи не записаны",
    today_meds: "\n💊 Лекарства:", today_no_meds: "\n💊 Лекарства не записаны",
    today_workouts: "\n🏋️ Тренировки:", today_no_workouts: "\n🏋️ Тренировок нет",
    today_weight: "\n⚖️ Вес: {weight} кг", today_no_weight: "\n⚖️ Вес не записан",
    settings_title: "⚙️ Настройки",
    settings_language: "🌐 Язык", settings_phone: "📱 Привязать телефон",
    settings_email: "📧 Моя почта", settings_profile: "👤 Профиль", settings_timezone: "🕐 Часовой пояс",
    language_prompt: "Выберите язык:", language_saved: "✅ Язык: {lang}",
    profile_info: "👤 {name}\n🔥 Цель: {goal} ккал\n⚖️ Целевой вес: {target}\n📏 Рост: {height}",
    profile_name_prompt: "Новое имя (или /skip):", profile_goal_prompt: "Цель ккал (или /skip):",
    profile_target_prompt: "Целевой вес кг (или /skip):", profile_height_prompt: "Рост см (или /skip):",
    profile_saved: "✅ Профиль обновлён!",
    phone_saved: "✅ Телефон: {phone}", email_info: "📧 {email}",
    timezone_prompt: "Введите часовой пояс (например Asia/Almaty):", timezone_saved: "✅ Часовой пояс: {tz}",
    error: "❌ Ошибка. Попробуйте ещё раз.",
    help: "📖 Команды:\n/meal — Еда\n/med — Лекарство\n/weight — Вес\n/workout — Тренировка\n/today — Сводка\n/history — История\n/advice — Советы\n/schedules — Расписания\n/settings — Настройки\n/cancel — Отмена",
    running: "Бег", walking: "Ходьба", cycling: "Велосипед", strength: "Силовая",
    yoga: "Йога", swimming: "Плавание", hiit: "HIIT", sports: "Спорт", other: "Другое",
    cancel: "❌ Отмена", cancelled: "Действие отменено.",
    phone_invalid: "❌ Неверный формат телефона.",
    open_app: "🌐 Открыть", choose_language: "Выберите язык / Choose language:",
    kb_meal: "🍽 Еда", kb_med: "💊 Лекарство", kb_weight: "⚖️ Вес",
    kb_workout: "🏋️ Тренировка", kb_today: "📊 Сегодня", kb_settings: "⚙️ Настройки",
    // History
    history_title: "📅 История за {date}",
    history_range_title: "📅 История {from} — {to}",
    history_no_data: "Нет записей за этот период.",
    history_pick_start: "📅 Выберите начало периода:",
    history_pick_end: "📅 Теперь выберите конец периода (или тот же день):",
    cal_prev: "◀️", cal_next: "▶️",
    // Advice
    advice_prompt: "Выберите тип совета:",
    advice_day: "📊 День", advice_week: "📊 Неделя", advice_month: "📊 Месяц",
    advice_none: "Советов за этот период пока нет.",
    advice_title: "💡 Совет ({period})",
    advice_newer: "▶️ Новее", advice_older: "◀️ Старше",
    // Profile
    profile_edit: "✏️ Редактировать",
    // Schedules
    schedules_title: "📋 Расписания",
    meal_schedules: "🍽 Расписания еды:", med_schedules: "💊 Расписания лекарств:",
    no_meal_schedules: "Расписаний еды нет.", no_med_schedules: "Расписаний лекарств нет.",
    schedule_daily: "ежедневно", schedule_weekly: "по дням", schedule_interval: "каждые {n} дн.",
    med_stop: "🛑 Приём окончен", med_stopped: "✅ «{name}» убран из расписания.",
    med_stop_confirm: "Убрать «{name}» из расписания? Напоминания больше не будут приходить.",
    yes: "Да", no: "Нет",
    settings_logout: "🚪 Выйти из аккаунта",
    logout_confirm: "Вы уверены, что хотите выйти? Привязка Telegram будет удалена.",
    logout_done: "✅ Вы вышли из аккаунта. Напишите /start чтобы войти снова.",
    kb_cancel: "❌ Отмена", kb_back: "◀️ Назад", kb_history: "📅 История", kb_advice: "💡 Советы",
  },
  en: {
    welcome: "Welcome to Healthy Life! 🌿",
    not_linked: "Your Telegram is not linked. Choose login method:",
    login_email: "📧 Email login", login_phone: "📱 Phone login",
    enter_email: "Enter your email:", enter_password: "Enter password:",
    enter_phone: "Send contact or type your phone:", share_contact: "📱 Share contact",
    login_success: "✅ Welcome, {name}!", login_failed: "❌ Wrong email/password.",
    register_offer: "Account not found. Register?",
    register_yes: "Yes, register", register_no: "No",
    register_success: "✅ Registered!", register_failed: "❌ Error: {error}",
    main_menu: "Choose an action:",
    meal_type_prompt: "Meal type:",
    breakfast: "🌅 Breakfast", lunch: "☀️ Lunch", dinner: "🌙 Dinner", snack: "🍎 Snack",
    meal_input_prompt: "📷 Send a food photo or type dish name:",
    meal_calories_prompt: "Enter calories:", meal_macros_prompt: "Protein/fat/carbs (or /skip):",
    meal_saved: "✅ Saved!\n🍽 {name}\n🔥 {cal} kcal",
    meal_photo_analyzing: "🔍 Analyzing photo...",
    meal_photo_result: "🤖 AI detected:\n🍽 {name}\n🔥 {cal} kcal\nP: {p}g | F: {f}g | C: {c}g",
    confirm: "✅ Confirm", edit: "✏️ Edit manually",
    med_prompt: "Choose medication or add new:", med_custom: "➕ Other",
    med_name_prompt: "Medication name:", med_dosage_prompt: "Dosage:",
    med_time_prompt: "Time (HH:MM) or /skip:", med_saved: "✅ 💊 {name} {dosage} at {time}",
    weight_prompt: "Weight (kg):", weight_saved: "✅ Weight: {weight} kg",
    workout_type_prompt: "Workout type:", workout_duration_prompt: "Duration (min):",
    workout_name_prompt: "Name (or /skip):", workout_saved: "✅ 🏋️ {type} — {duration} min",
    today_title: "📊 Today's summary",
    today_calories: "🔥 {eaten}/{goal} kcal (remaining: {remaining})",
    today_meals: "\n🍽 Meals:", today_no_meals: "\n🍽 No meals",
    today_meds: "\n💊 Medications:", today_no_meds: "\n💊 No medications",
    today_workouts: "\n🏋️ Workouts:", today_no_workouts: "\n🏋️ No workouts",
    today_weight: "\n⚖️ Weight: {weight} kg", today_no_weight: "\n⚖️ Weight not logged",
    settings_title: "⚙️ Settings",
    settings_language: "🌐 Language", settings_phone: "📱 Link phone",
    settings_email: "📧 My email", settings_profile: "👤 Profile", settings_timezone: "🕐 Timezone",
    language_prompt: "Choose language:", language_saved: "✅ Language: {lang}",
    profile_info: "👤 {name}\n🔥 Goal: {goal} kcal\n⚖️ Target: {target}\n📏 Height: {height}",
    profile_name_prompt: "New name (or /skip):", profile_goal_prompt: "Calorie goal (or /skip):",
    profile_target_prompt: "Target weight kg (or /skip):", profile_height_prompt: "Height cm (or /skip):",
    profile_saved: "✅ Profile updated!",
    phone_saved: "✅ Phone: {phone}", email_info: "📧 {email}",
    timezone_prompt: "Enter timezone (e.g. Asia/Almaty):", timezone_saved: "✅ Timezone: {tz}",
    error: "❌ Error. Try again.",
    help: "📖 Commands:\n/meal — Meal\n/med — Medication\n/weight — Weight\n/workout — Workout\n/today — Summary\n/history — History\n/advice — Advice\n/schedules — Schedules\n/settings — Settings\n/cancel — Cancel",
    running: "Running", walking: "Walking", cycling: "Cycling", strength: "Strength",
    yoga: "Yoga", swimming: "Swimming", hiit: "HIIT", sports: "Sports", other: "Other",
    cancel: "❌ Cancel", cancelled: "Action cancelled.",
    phone_invalid: "❌ Invalid phone.",
    open_app: "🌐 Open", choose_language: "Choose language / Выберите язык:",
    kb_meal: "🍽 Meal", kb_med: "💊 Medication", kb_weight: "⚖️ Weight",
    kb_workout: "🏋️ Workout", kb_today: "📊 Today", kb_settings: "⚙️ Settings",
    history_title: "📅 History for {date}",
    history_range_title: "📅 History {from} — {to}",
    history_no_data: "No records for this period.",
    history_pick_start: "📅 Pick start date:",
    history_pick_end: "📅 Now pick end date (or same day):",
    cal_prev: "◀️", cal_next: "▶️",
    advice_prompt: "Choose advice type:",
    advice_day: "📊 Day", advice_week: "📊 Week", advice_month: "📊 Month",
    advice_none: "No advice for this period yet.",
    advice_title: "💡 Advice ({period})",
    advice_newer: "▶️ Newer", advice_older: "◀️ Older",
    profile_edit: "✏️ Edit",
    schedules_title: "📋 Schedules",
    meal_schedules: "🍽 Meal schedules:", med_schedules: "💊 Medication schedules:",
    no_meal_schedules: "No meal schedules.", no_med_schedules: "No medication schedules.",
    schedule_daily: "daily", schedule_weekly: "weekly", schedule_interval: "every {n} days",
    med_stop: "🛑 Course finished", med_stopped: "✅ «{name}» removed from schedule.",
    med_stop_confirm: "Remove «{name}» from schedule? No more reminders will be sent.",
    yes: "Yes", no: "No",
    settings_logout: "🚪 Logout",
    logout_confirm: "Are you sure? Telegram link will be removed.",
    logout_done: "✅ Logged out. Type /start to login again.",
    kb_cancel: "❌ Cancel", kb_back: "◀️ Back", kb_history: "📅 History", kb_advice: "💡 Advice",
  },
  kk: {
    welcome: "Healthy Life-қа қош келдіңіз! 🌿",
    not_linked: "Telegram байланыспаған. Кіру әдісін таңдаңыз:",
    login_email: "📧 Email", login_phone: "📱 Телефон",
    enter_email: "Email:", enter_password: "Құпия сөз:",
    enter_phone: "Контакт жіберіңіз немесе нөмір жазыңыз:", share_contact: "📱 Контакт жіберу",
    login_success: "✅ Қош келдіңіз, {name}!", login_failed: "❌ Қате email/құпия сөз.",
    register_offer: "Аккаунт жоқ. Тіркелу?",
    register_yes: "Иә", register_no: "Жоқ",
    register_success: "✅ Тіркелу сәтті!", register_failed: "❌ Қате: {error}",
    main_menu: "Әрекетті таңдаңыз:",
    meal_type_prompt: "Тамақ түрі:",
    breakfast: "🌅 Таңғы ас", lunch: "☀️ Түскі ас", dinner: "🌙 Кешкі ас", snack: "🍎 Тіскебасар",
    meal_input_prompt: "📷 Тамақ суретін жіберіңіз немесе атауын жазыңыз:",
    meal_calories_prompt: "Калория:", meal_macros_prompt: "Ақуыз/май/көмірсу (немесе /skip):",
    meal_saved: "✅ 🍽 {name}\n🔥 {cal} ккал",
    meal_photo_analyzing: "🔍 Сурет талдануда...",
    meal_photo_result: "🤖 AI:\n🍽 {name}\n🔥 {cal} ккал\nА: {p}г | М: {f}г | К: {c}г",
    confirm: "✅ Растау", edit: "✏️ Қолмен",
    med_prompt: "Дәріні таңдаңыз:", med_custom: "➕ Басқа",
    med_name_prompt: "Дәрі атауы:", med_dosage_prompt: "Дозасы:",
    med_time_prompt: "Уақыт (СС:ММ) немесе /skip:", med_saved: "✅ 💊 {name} {dosage} {time}",
    weight_prompt: "Салмақ (кг):", weight_saved: "✅ Салмақ: {weight} кг",
    workout_type_prompt: "Жаттығу түрі:", workout_duration_prompt: "Ұзақтығы (мин):",
    workout_name_prompt: "Атауы (немесе /skip):", workout_saved: "✅ 🏋️ {type} — {duration} мин",
    today_title: "📊 Бүгін",
    today_calories: "🔥 {eaten}/{goal} ккал (қалды: {remaining})",
    today_meals: "\n🍽 Тамақтану:", today_no_meals: "\n🍽 Тамақ жоқ",
    today_meds: "\n💊 Дәрілер:", today_no_meds: "\n💊 Дәрі жоқ",
    today_workouts: "\n🏋️ Жаттығулар:", today_no_workouts: "\n🏋️ Жаттығу жоқ",
    today_weight: "\n⚖️ Салмақ: {weight} кг", today_no_weight: "\n⚖️ Салмақ жазылмаған",
    settings_title: "⚙️ Баптаулар",
    settings_language: "🌐 Тіл", settings_phone: "📱 Телефон", settings_email: "📧 Email",
    settings_profile: "👤 Профиль", settings_timezone: "🕐 Уақыт белдеуі",
    language_prompt: "Тілді таңдаңыз:", language_saved: "✅ Тіл: {lang}",
    profile_info: "👤 {name}\n🔥 Мақсат: {goal} ккал\n⚖️ Мақсат салмақ: {target}\n📏 Бой: {height}",
    profile_name_prompt: "Жаңа ат (немесе /skip):", profile_goal_prompt: "Ккал мақсаты (немесе /skip):",
    profile_target_prompt: "Мақсат салмақ кг (немесе /skip):", profile_height_prompt: "Бой см (немесе /skip):",
    profile_saved: "✅ Профиль жаңартылды!",
    phone_saved: "✅ Телефон: {phone}", email_info: "📧 {email}",
    timezone_prompt: "Уақыт белдеуі (мыс. Asia/Almaty):", timezone_saved: "✅ Уақыт белдеуі: {tz}",
    error: "❌ Қате. Қайталаңыз.",
    help: "📖 /meal — Тамақ\n/med — Дәрі\n/weight — Салмақ\n/workout — Жаттығу\n/today — Бүгін\n/history — Тарих\n/advice — Кеңес\n/schedules — Кесте\n/settings — Баптаулар\n/cancel — Болдырмау",
    running: "Жүгіру", walking: "Жүру", cycling: "Велосипед", strength: "Күшті",
    yoga: "Йога", swimming: "Жүзу", hiit: "HIIT", sports: "Спорт", other: "Басқа",
    cancel: "❌ Болдырмау", cancelled: "Тоқтатылды.",
    phone_invalid: "❌ Телефон қате.",
    open_app: "🌐 Ашу", choose_language: "Тілді таңдаңыз / Choose language:",
    kb_meal: "🍽 Тамақ", kb_med: "💊 Дәрі", kb_weight: "⚖️ Салмақ",
    kb_workout: "🏋️ Жаттығу", kb_today: "📊 Бүгін", kb_settings: "⚙️ Баптаулар",
    history_title: "📅 {date} тарихы",
    history_range_title: "📅 Тарих {from} — {to}",
    history_no_data: "Бұл кезеңге жазба жоқ.",
    history_pick_start: "📅 Басталу күнін таңдаңыз:",
    history_pick_end: "📅 Аяқталу күнін таңдаңыз (немесе сол күн):",
    cal_prev: "◀️", cal_next: "▶️",
    advice_prompt: "Кеңес түрін таңдаңыз:",
    advice_day: "📊 Күн", advice_week: "📊 Апта", advice_month: "📊 Ай",
    advice_none: "Бұл кезеңге кеңес жоқ.",
    advice_title: "💡 Кеңес ({period})",
    advice_newer: "▶️ Жаңа", advice_older: "◀️ Ескі",
    profile_edit: "✏️ Өзгерту",
    schedules_title: "📋 Кестелер",
    meal_schedules: "🍽 Тамақ кестесі:", med_schedules: "💊 Дәрі кестесі:",
    no_meal_schedules: "Тамақ кестесі жоқ.", no_med_schedules: "Дәрі кестесі жоқ.",
    schedule_daily: "күнделікті", schedule_weekly: "апталық", schedule_interval: "әр {n} күн",
    med_stop: "🛑 Қабылдау аяқталды", med_stopped: "✅ «{name}» кестеден алынды.",
    med_stop_confirm: "«{name}» кестеден алу? Еске салулар жіберілмейді.",
    yes: "Иә", no: "Жоқ",
    settings_logout: "🚪 Шығу",
    logout_confirm: "Шығуға сенімдісіз бе? Telegram байланысы жойылады.",
    logout_done: "✅ Шықтыңыз. Қайта кіру үшін /start жазыңыз.",
    kb_cancel: "❌ Болдырмау", kb_back: "◀️ Артқа", kb_history: "📅 Тарих", kb_advice: "💡 Кеңес",
  },
};

function botT(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const lang = translations[locale] ? locale : translations[locale?.slice(0, 2)] ? locale.slice(0, 2) : "en";
  let text = translations[lang]?.[key] ?? translations.en?.[key] ?? key;
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
function getState(chatId: number) { return states.get(chatId); }
function setState(chatId: number, state: UserState) { states.set(chatId, state); }
function clearState(chatId: number) { states.delete(chatId); }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr(timezone = "UTC"): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    return `${parts.find(p => p.type === "year")!.value}-${parts.find(p => p.type === "month")!.value}-${parts.find(p => p.type === "day")!.value}`;
  } catch { return new Date().toISOString().slice(0, 10); }
}

function nowTime(timezone = "UTC"): string {
  try { return new Date().toLocaleTimeString("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }); }
  catch { return new Date().toISOString().slice(11, 16); }
}

function parseDateInput(input: string): string | null {
  const m = input.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

async function getProfileByChatId(chatId: number) {
  return prisma.profile.findUnique({ where: { telegramChatId: String(chatId) } });
}

// ─── Dynamic keyboards ───────────────────────────────────────────────────────

function mainKeyboard(locale = "ru"): Keyboard {
  return new Keyboard()
    .text(botT(locale, "kb_meal")).text(botT(locale, "kb_med")).row()
    .text(botT(locale, "kb_weight")).text(botT(locale, "kb_workout")).row()
    .text(botT(locale, "kb_today")).text(botT(locale, "kb_history")).row()
    .text(botT(locale, "kb_advice")).text(botT(locale, "kb_settings")).row()
    .webApp(botT(locale, "open_app"), WEB_APP_URL)
    .resized().persistent();
}

function cancelKeyboard(locale = "ru"): Keyboard {
  return new Keyboard()
    .text(botT(locale, "kb_cancel"))
    .resized().persistent();
}

async function replyMain(ctx: Context, text: string, locale = "ru") {
  await ctx.reply(text, { reply_markup: mainKeyboard(locale) });
}

async function replyCancel(ctx: Context, text: string, locale = "ru") {
  await ctx.reply(text, { reply_markup: cancelKeyboard(locale) });
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

// ─── Photo upload to Supabase ─────────────────────────────────────────────────

async function uploadPhotoToStorage(buffer: Buffer, folder: "meals" | "medications"): Promise<string> {
  const objectPath = `${folder}/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${randomUUID()}.jpg`;
  const { error } = await supabaseAdmin.storage.from(PHOTOS_BUCKET).upload(objectPath, buffer, {
    contentType: "image/jpeg",
    upsert: false,
    cacheControl: "31536000",
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data } = supabaseAdmin.storage.from(PHOTOS_BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

async function downloadTelegramPhoto(ctx: Context): Promise<{ buffer: Buffer; base64: string }> {
  const photo = ctx.message!.photo!;
  const fileId = photo[photo.length - 1].file_id;
  const file = await ctx.api.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
  const resp = await fetch(url);
  const buffer = Buffer.from(await resp.arrayBuffer());
  return { buffer, base64: buffer.toString("base64") };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function trySignIn(email: string, password: string) {
  const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
  return { user: data?.user, error };
}

async function trySignUp(email: string, password: string) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  return { user: data?.user, error };
}

async function linkProfile(userId: string, chatId: number, phone?: string) {
  let profile = await prisma.profile.findUnique({ where: { userId } });
  const updateData: any = { telegramChatId: String(chatId) };
  if (phone) updateData.phone = phone;
  if (profile) {
    profile = await prisma.profile.update({ where: { id: profile.id }, data: updateData });
  } else {
    profile = await prisma.profile.create({ data: { userId, ...updateData } });
  }
  return profile;
}

// ─── Feature flows ────────────────────────────────────────────────────────────

async function startMealFlow(ctx: Context) {
  const auth = await requireAuth(ctx);
  if (!auth) return;
  setState(ctx.chat!.id, { step: "meal:type", profileId: auth.profileId, locale: auth.locale, data: {} });
  await ctx.reply(botT(auth.locale, "meal_type_prompt"), {
    reply_markup: new InlineKeyboard()
      .text(botT(auth.locale, "breakfast"), "meal_type:breakfast")
      .text(botT(auth.locale, "lunch"), "meal_type:lunch").row()
      .text(botT(auth.locale, "dinner"), "meal_type:dinner")
      .text(botT(auth.locale, "snack"), "meal_type:snack"),
  });
}

async function startMedFlow(ctx: Context) {
  const auth = await requireAuth(ctx);
  if (!auth) return;
  const plans = await prisma.medicationPlan.findMany({ where: { profileId: auth.profileId, active: true } });
  const kb = new InlineKeyboard();
  for (const plan of plans) {
    kb.text(`💊 ${plan.name}${plan.dosage ? ` (${plan.dosage})` : ""}`, `med_plan:${plan.id}`).row();
  }
  kb.text(botT(auth.locale, "med_custom"), "med_plan:custom");
  setState(ctx.chat!.id, { step: "med:choose", profileId: auth.profileId, locale: auth.locale, data: {} });
  await ctx.reply(botT(auth.locale, "med_prompt"), { reply_markup: kb });
}

async function startWeightFlow(ctx: Context) {
  const auth = await requireAuth(ctx);
  if (!auth) return;
  setState(ctx.chat!.id, { step: "weight:input", profileId: auth.profileId, locale: auth.locale, data: {} });
  await replyCancel(ctx, botT(auth.locale, "weight_prompt"), auth.locale);
}

async function startWorkoutFlow(ctx: Context) {
  const auth = await requireAuth(ctx);
  if (!auth) return;
  const types = ["running", "walking", "cycling", "strength", "yoga", "swimming", "hiit", "sports", "other"];
  const kb = new InlineKeyboard();
  for (let i = 0; i < types.length; i++) {
    kb.text(botT(auth.locale, types[i]), `workout_type:${types[i]}`);
    if ((i + 1) % 3 === 0) kb.row();
  }
  setState(ctx.chat!.id, { step: "workout:type", profileId: auth.profileId, locale: auth.locale, data: {} });
  await ctx.reply(botT(auth.locale, "workout_type_prompt"), { reply_markup: kb });
}

async function showToday(ctx: Context) {
  const auth = await requireAuth(ctx);
  if (!auth) return;
  const today = todayStr(auth.timezone);
  await sendDaySummary(ctx, auth.profileId, auth.locale, auth.timezone, today);
}

// ─── Inline calendar ──────────────────────────────────────────────────────────

const WEEKDAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const WEEKDAYS_EN = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const WEEKDAYS_KK = ["Дс", "Сс", "Ср", "Бс", "Жм", "Сн", "Жс"];
const MONTHS_RU = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_KK = ["Қаңтар", "Ақпан", "Наурыз", "Сәуір", "Мамыр", "Маусым", "Шілде", "Тамыз", "Қыркүйек", "Қазан", "Қараша", "Желтоқсан"];

function getMonths(locale: string) { return locale === "ru" ? MONTHS_RU : locale === "kk" ? MONTHS_KK : MONTHS_EN; }
function getWeekdays(locale: string) { return locale === "ru" ? WEEKDAYS_RU : locale === "kk" ? WEEKDAYS_KK : WEEKDAYS_EN; }

function buildCalendarKeyboard(year: number, month: number, locale: string, prefix: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  const months = getMonths(locale);
  const wd = getWeekdays(locale);

  // Header: < Month Year >
  kb.text(botT(locale, "cal_prev"), `${prefix}nav:${year}-${String(month).padStart(2, "0")}:-1`)
    .text(`${months[month]} ${year}`, "noop")
    .text(botT(locale, "cal_next"), `${prefix}nav:${year}-${String(month).padStart(2, "0")}:1`);
  kb.row();

  // Weekday headers
  for (const d of wd) kb.text(d, "noop");
  kb.row();

  // Days
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const offset = firstDay === 0 ? 6 : firstDay - 1; // Mon-based offset
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let col = 0;
  for (let i = 0; i < offset; i++) { kb.text(" ", "noop"); col++; }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    kb.text(String(d), `${prefix}pick:${dateStr}`);
    col++;
    if (col === 7) { kb.row(); col = 0; }
  }
  if (col > 0) kb.row();

  return kb;
}

async function sendRangeSummary(ctx: Context, profileId: string, locale: string, timezone: string, from: string, to: string) {
  const dates: string[] = [];
  const cur = new Date(from);
  const end = new Date(to);
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  if (dates.length === 0) return;

  if (dates.length === 1) {
    return sendDaySummary(ctx, profileId, locale, timezone, dates[0]);
  }

  // Multi-day summary
  const profile = await prisma.profile.findUnique({ where: { id: profileId } });
  const goal = profile?.dailyCalorieGoal || 2000;
  let text = botT(locale, "history_range_title", { from, to }) + "\n";

  const allMeals = await prisma.meal.findMany({ where: { profileId, date: { in: dates } }, orderBy: { date: "asc" } });
  const allIntakes = await prisma.medicationIntake.findMany({ where: { profileId, date: { in: dates } }, orderBy: { date: "asc" } });
  const allWorkouts = await prisma.workout.findMany({ where: { profileId, date: { in: dates } }, orderBy: { date: "asc" } });
  const allWeights = await prisma.weightEntry.findMany({ where: { profileId, date: { in: dates } }, orderBy: { date: "asc" } });

  if (allMeals.length === 0 && allIntakes.length === 0 && allWorkouts.length === 0 && allWeights.length === 0) {
    await replyMain(ctx, text + "\n" + botT(locale, "history_no_data"), locale);
    return;
  }

  const totalCal = allMeals.reduce((s, m) => s + m.calories, 0);
  const avgCal = Math.round(totalCal / dates.length);
  text += `\n🔥 ${Math.round(totalCal)} ккал за ${dates.length} дн. (ср. ${avgCal}/${goal})`;

  // Group by day
  for (const date of dates) {
    const dayMeals = allMeals.filter(m => m.date === date);
    const dayIntakes = allIntakes.filter(i => i.date === date);
    const dayWorkouts = allWorkouts.filter(w => w.date === date);
    const dayWeight = allWeights.find(w => w.date === date);
    if (dayMeals.length === 0 && dayIntakes.length === 0 && dayWorkouts.length === 0 && !dayWeight) continue;

    text += `\n\n📅 ${date}`;
    const dayCal = dayMeals.reduce((s, m) => s + m.calories, 0);
    if (dayMeals.length > 0) {
      text += `\n  🍽 ${Math.round(dayCal)} ккал (${dayMeals.length} приёмов)`;
    }
    if (dayIntakes.length > 0) {
      text += `\n  💊 ${dayIntakes.map(i => i.name).join(", ")}`;
    }
    if (dayWorkouts.length > 0) {
      text += `\n  🏋️ ${dayWorkouts.map(w => `${botT(locale, w.type)} ${w.quantity}${w.unit}`).join(", ")}`;
    }
    if (dayWeight) text += `\n  ⚖️ ${dayWeight.weightKg} кг`;
  }

  await replyMain(ctx, text, locale);
}

async function sendDaySummary(ctx: Context, profileId: string, locale: string, timezone: string, date: string) {
  const profile = await prisma.profile.findUnique({ where: { id: profileId } });
  const meals = await prisma.meal.findMany({ where: { profileId, date }, orderBy: { createdAt: "asc" } });
  const intakes = await prisma.medicationIntake.findMany({ where: { profileId, date }, orderBy: { createdAt: "asc" } });
  const workouts = await prisma.workout.findMany({ where: { profileId, date }, orderBy: { createdAt: "asc" } });
  const weight = await prisma.weightEntry.findUnique({ where: { profileId_date: { profileId, date } } });

  const goal = profile?.dailyCalorieGoal || 2000;
  const eaten = meals.reduce((s, m) => s + m.calories, 0);

  let text = botT(locale, "today_title") + " (" + date + ")\n";
  text += botT(locale, "today_calories", { eaten: Math.round(eaten), goal, remaining: Math.max(0, Math.round(goal - eaten)) });

  if (meals.length > 0) {
    text += botT(locale, "today_meals");
    for (const m of meals) {
      const type = botT(locale, m.mealType);
      text += `\n  • ${type}: ${m.name} — ${Math.round(m.calories)} ккал`;
      if (m.photoPath) text += " 📷";
    }
  } else {
    text += botT(locale, "today_no_meals");
  }

  if (intakes.length > 0) {
    text += botT(locale, "today_meds");
    for (const i of intakes) text += `\n  • ${i.name}${i.dosage ? ` (${i.dosage})` : ""} — ${i.takenTime}`;
  } else {
    text += botT(locale, "today_no_meds");
  }

  if (workouts.length > 0) {
    text += botT(locale, "today_workouts");
    for (const w of workouts) text += `\n  • ${botT(locale, w.type)} — ${w.quantity} ${w.unit}`;
  } else {
    text += botT(locale, "today_no_workouts");
  }

  text += weight ? botT(locale, "today_weight", { weight: weight.weightKg }) : botT(locale, "today_no_weight");

  await replyMain(ctx, text, locale);

  // Send photos for meals that have them
  for (const m of meals) {
    if (m.photoPath) {
      try {
        await ctx.replyWithPhoto(m.photoPath, { caption: `🍽 ${m.name} — ${Math.round(m.calories)} ккал` });
      } catch { /* photo may be unavailable */ }
    }
  }
}

async function showHistory(ctx: Context) {
  const auth = await requireAuth(ctx);
  if (!auth) return;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  setState(ctx.chat!.id, { step: "history:cal", profileId: auth.profileId, locale: auth.locale, data: { timezone: auth.timezone } });
  const kb = buildCalendarKeyboard(year, month, auth.locale, "hcal_");
  await ctx.reply(botT(auth.locale, "history_pick_start"), { reply_markup: kb });
}

async function showAdvice(ctx: Context) {
  const auth = await requireAuth(ctx);
  if (!auth) return;
  await ctx.reply(botT(auth.locale, "advice_prompt"), {
    reply_markup: new InlineKeyboard()
      .text(botT(auth.locale, "advice_day"), "advice:day:0")
      .text(botT(auth.locale, "advice_week"), "advice:week:0")
      .text(botT(auth.locale, "advice_month"), "advice:month:0"),
  });
}

async function sendAdvicePage(ctx: Context, chatId: number, period: string, offset: number) {
  const profile = await getProfileByChatId(chatId);
  if (!profile) return;
  const l = profile.preferredLocale;
  const adv = await prisma.advice.findMany({
    where: { profileId: profile.id, period },
    orderBy: { createdAt: "desc" },
    skip: offset,
    take: 1,
  });
  if (adv.length === 0) {
    await replyMain(ctx, botT(l, "advice_none"), l);
    return;
  }
  const a = adv[0];
  const periodLabel = a.periodKey.split("__")[0];
  let text = botT(l, "advice_title", { period: periodLabel }) + "\n\n";
  text += `📌 ${a.title}\n\n`;
  if (a.summary) text += `${a.summary}\n\n`;
  text += a.content;

  // Check if there are older/newer
  const total = await prisma.advice.count({ where: { profileId: profile.id, period } });
  const kb = new InlineKeyboard();
  if (offset > 0) kb.text(botT(l, "advice_newer"), `advice:${period}:${offset - 1}`);
  if (offset + 1 < total) kb.text(botT(l, "advice_older"), `advice:${period}:${offset + 1}`);
  if (kb.inline_keyboard.length > 0 && kb.inline_keyboard[0].length > 0) {
    await ctx.reply(text, { reply_markup: kb });
  } else {
    await ctx.reply(text);
  }
  await replyMain(ctx, "👆", l);
}

async function showSchedules(ctx: Context) {
  const auth = await requireAuth(ctx);
  if (!auth) return;
  const mealPlans = await prisma.mealPlan.findMany({ where: { profileId: auth.profileId, active: true }, orderBy: { createdAt: "asc" } });
  const medPlans = await prisma.medicationPlan.findMany({ where: { profileId: auth.profileId, active: true }, orderBy: { createdAt: "asc" } });
  const l = auth.locale;

  let text = botT(l, "schedules_title") + "\n";

  if (mealPlans.length > 0) {
    text += "\n" + botT(l, "meal_schedules");
    for (const p of mealPlans) {
      const times = JSON.parse(p.timesJson || "[]");
      const rec = p.recurrence === "interval" ? botT(l, "schedule_interval", { n: p.intervalDays }) : botT(l, p.recurrence === "weekly" ? "schedule_weekly" : "schedule_daily");
      text += `\n  • ${p.name} (${botT(l, p.mealType)}) — ${times.join(", ")} [${rec}]`;
    }
  } else {
    text += "\n" + botT(l, "no_meal_schedules");
  }

  if (medPlans.length > 0) {
    text += "\n\n" + botT(l, "med_schedules");
    for (const p of medPlans) {
      const times = JSON.parse(p.timesJson || "[]");
      const rec = p.recurrence === "interval" ? botT(l, "schedule_interval", { n: p.intervalDays }) : botT(l, p.recurrence === "weekly" ? "schedule_weekly" : "schedule_daily");
      text += `\n  • 💊 ${p.name}${p.dosage ? ` (${p.dosage})` : ""} — ${times.join(", ")} [${rec}]`;
    }
  } else {
    text += "\n\n" + botT(l, "no_med_schedules");
  }

  await replyMain(ctx, text, l);

  // Inline buttons to stop each medication plan
  if (medPlans.length > 0) {
    const kb = new InlineKeyboard();
    for (const p of medPlans) {
      kb.text(`${botT(l, "med_stop")} — ${p.name}`, `med_stop:${p.id}`).row();
    }
    await ctx.reply("👆", { reply_markup: kb });
  }
}

async function showSettings(ctx: Context) {
  const auth = await requireAuth(ctx);
  if (!auth) return;
  const profile = await prisma.profile.findUnique({ where: { id: auth.profileId } });
  const kb = new InlineKeyboard()
    .text(botT(auth.locale, "settings_language"), "settings:language").row()
    .text(botT(auth.locale, "settings_profile"), "settings:profile").row()
    .text(botT(auth.locale, "settings_timezone"), "settings:timezone").row()
    .text(botT(auth.locale, "settings_email"), "settings:email").row();
  if (!profile?.phone) kb.text(botT(auth.locale, "settings_phone"), "settings:phone").row();
  kb.text(botT(auth.locale, "settings_logout"), "settings:logout").row();
  await ctx.reply(botT(auth.locale, "settings_title"), { reply_markup: kb });
}

// ─── Commands ─────────────────────────────────────────────────────────────────

bot.command("start", async (ctx) => {
  const chatId = ctx.chat.id;
  clearState(chatId);
  const profile = await getProfileByChatId(chatId);
  if (profile) {
    const l = profile.preferredLocale;
    await replyMain(ctx, botT(l, "welcome") + "\n" + botT(l, "main_menu"), l);
  } else {
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
  await replyMain(ctx, botT(l, "help"), l);
});

bot.command("cancel", async (ctx) => {
  clearState(ctx.chat.id);
  const profile = await getProfileByChatId(ctx.chat.id);
  const l = profile?.preferredLocale || "ru";
  await replyMain(ctx, botT(l, "cancelled"), l);
});

bot.command("meal", startMealFlow);
bot.command("med", startMedFlow);
bot.command("weight", startWeightFlow);
bot.command("workout", startWorkoutFlow);
bot.command("today", showToday);
bot.command("history", showHistory);
bot.command("advice", showAdvice);
bot.command("schedules", showSchedules);
bot.command("settings", showSettings);

// ─── Callback queries ─────────────────────────────────────────────────────────

bot.on("callback_query:data", async (ctx) => {
  const data = ctx.callbackQuery.data;
  const chatId = ctx.chat!.id;
  await ctx.answerCallbackQuery();

  try {
    // Language on first start
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

    if (data === "auth:email") {
      const st = getState(chatId);
      const locale = st?.locale || "ru";
      setState(chatId, { step: "auth:email", locale, data: {} });
      await replyCancel(ctx, botT(locale, "enter_email"), locale);
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
      await replyMain(ctx, botT(locale, "register_success"), locale);
      return;
    }
    if (data === "auth:register_no") {
      const st = getState(chatId);
      const locale = st?.locale || "ru";
      clearState(chatId);
      await replyMain(ctx, botT(locale, "cancelled"), locale);
      return;
    }

    // Meal type
    if (data.startsWith("meal_type:")) {
      const st = getState(chatId);
      if (!st) return;
      st.data!.mealType = data.split(":")[1];
      st.step = "meal:input";
      await replyCancel(ctx, botT(st.locale!, "meal_input_prompt"), st.locale!);
      return;
    }

    // Meal photo confirm/edit
    if (data === "meal:confirm") {
      const st = getState(chatId);
      if (!st?.data?.aiResult) return;
      const { aiResult, mealType, photoPath } = st.data;
      const profile = await prisma.profile.findUnique({ where: { id: st.profileId } });
      const today = todayStr(profile?.timezone);
      await prisma.meal.create({
        data: {
          profileId: st.profileId!, date: today, mealType: mealType || "snack",
          name: aiResult.name, calories: aiResult.calories,
          protein: aiResult.protein, carbs: aiResult.carbs, fat: aiResult.fat,
          aiDetectedName: aiResult.name, aiCalories: aiResult.calories,
          photoPath: photoPath || null,
        },
      });
      clearState(chatId);
      await replyMain(ctx, botT(st.locale!, "meal_saved", { name: aiResult.name, cal: Math.round(aiResult.calories) }), st.locale!);
      return;
    }
    if (data === "meal:edit") {
      const st = getState(chatId);
      if (!st) return;
      st.step = "meal:text_name";
      st.data!.aiResult = undefined;
      await replyCancel(ctx, botT(st.locale!, "meal_input_prompt"), st.locale!);
      return;
    }

    // Med plan
    if (data.startsWith("med_plan:")) {
      const st = getState(chatId);
      if (!st) return;
      const planId = data.split(":")[1];
      if (planId === "custom") {
        st.step = "med:name";
        await replyCancel(ctx, botT(st.locale!, "med_name_prompt"), st.locale!);
      } else {
        const plan = await prisma.medicationPlan.findUnique({ where: { id: planId } });
        if (!plan) return;
        st.data!.planId = plan.id;
        st.data!.name = plan.name;
        st.data!.dosage = plan.dosage || "";
        st.step = "med:time";
        await replyCancel(ctx, botT(st.locale!, "med_time_prompt"), st.locale!);
      }
      return;
    }

    // Workout type
    if (data.startsWith("workout_type:")) {
      const st = getState(chatId);
      if (!st) return;
      st.data!.type = data.split(":")[1];
      st.step = "workout:duration";
      await replyCancel(ctx, botT(st.locale!, "workout_duration_prompt"), st.locale!);
      return;
    }

    // Advice with pagination: advice:day:0, advice:week:1, etc.
    if (data.startsWith("advice:")) {
      const parts = data.split(":");
      const period = parts[1];
      const offset = parseInt(parts[2] || "0", 10);
      await sendAdvicePage(ctx, chatId, period, offset);
      return;
    }

    // Calendar navigation: hcal_nav:2026-08:-1 or hcal_nav:2026-08:1
    if (data.startsWith("hcal_nav:")) {
      const st = getState(chatId);
      if (!st) return;
      const parts = data.replace("hcal_nav:", "").split(":");
      const [ym, dir] = [parts[0], parseInt(parts[1], 10)];
      const [y, m] = ym.split("-").map(Number);
      let newMonth = m - 1 + dir; // m is 1-based from callback
      let newYear = y;
      if (newMonth < 0) { newMonth = 11; newYear--; }
      if (newMonth > 11) { newMonth = 0; newYear++; }
      const phase = st.data?.startDate ? "history_pick_end" : "history_pick_start";
      const kb = buildCalendarKeyboard(newYear, newMonth, st.locale!, "hcal_");
      try {
        await ctx.editMessageText(botT(st.locale!, phase), { reply_markup: kb });
      } catch {
        await ctx.reply(botT(st.locale!, phase), { reply_markup: kb });
      }
      return;
    }

    // Calendar date pick: hcal_pick:2026-08-19
    if (data.startsWith("hcal_pick:")) {
      const st = getState(chatId);
      if (!st) return;
      const pickedDate = data.replace("hcal_pick:", "");
      if (!st.data?.startDate) {
        // First pick — start date
        st.data!.startDate = pickedDate;
        const [y, m] = pickedDate.split("-").map(Number);
        const kb = buildCalendarKeyboard(y, m - 1, st.locale!, "hcal_");
        try {
          await ctx.editMessageText(botT(st.locale!, "history_pick_end"), { reply_markup: kb });
        } catch {
          await ctx.reply(botT(st.locale!, "history_pick_end"), { reply_markup: kb });
        }
      } else {
        // Second pick — end date
        let from = st.data!.startDate;
        let to = pickedDate;
        if (from > to) [from, to] = [to, from];
        clearState(chatId);
        await sendRangeSummary(ctx, st.profileId!, st.locale!, st.data!.timezone, from, to);
      }
      return;
    }

    // noop (calendar headers etc.)
    if (data === "noop") return;

    // Stop medication plan (confirm)
    if (data.startsWith("med_stop:")) {
      const planId = data.split(":")[1];
      const plan = await prisma.medicationPlan.findUnique({ where: { id: planId } });
      if (!plan) return;
      const profile = await getProfileByChatId(chatId);
      const l = profile?.preferredLocale || "ru";
      await ctx.reply(botT(l, "med_stop_confirm", { name: plan.name }), {
        reply_markup: new InlineKeyboard()
          .text(botT(l, "yes"), `med_stop_yes:${planId}`)
          .text(botT(l, "no"), `med_stop_no`),
      });
      return;
    }
    if (data.startsWith("med_stop_yes:")) {
      const planId = data.split(":")[1];
      const plan = await prisma.medicationPlan.findUnique({ where: { id: planId } });
      if (!plan) return;
      await prisma.medicationPlan.update({ where: { id: planId }, data: { active: false } });
      const profile = await getProfileByChatId(chatId);
      const l = profile?.preferredLocale || "ru";
      await replyMain(ctx, botT(l, "med_stopped", { name: plan.name }), l);
      return;
    }
    if (data === "med_stop_no") {
      const profile = await getProfileByChatId(chatId);
      const l = profile?.preferredLocale || "ru";
      await replyMain(ctx, botT(l, "cancelled"), l);
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
      if (profile) await prisma.profile.update({ where: { id: profile.id }, data: { preferredLocale: locale } });
      await replyMain(ctx, botT(locale, "language_saved", { lang: LOCALES_META[locale] || locale }), locale);
      return;
    }
    if (data === "settings:profile") {
      const profile = await getProfileByChatId(chatId);
      if (!profile) return;
      const l = profile.preferredLocale;
      const info = botT(l, "profile_info", {
        name: profile.name,
        goal: profile.dailyCalorieGoal,
        target: profile.targetWeightKg ? `${profile.targetWeightKg}` : "—",
        height: profile.heightCm ? `${profile.heightCm}` : "—",
      });
      await ctx.reply(info, {
        reply_markup: new InlineKeyboard().text(botT(l, "profile_edit"), "settings:profile_edit"),
      });
      return;
    }
    if (data === "settings:profile_edit") {
      const profile = await getProfileByChatId(chatId);
      if (!profile) return;
      const l = profile.preferredLocale;
      setState(chatId, { step: "settings:name", profileId: profile.id, locale: l, data: {} });
      await replyCancel(ctx, botT(l, "profile_name_prompt"), l);
      return;
    }
    if (data === "settings:email") {
      const profile = await getProfileByChatId(chatId);
      if (!profile?.userId) return;
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(profile.userId);
      const email = userData?.user?.email || "—";
      await replyMain(ctx, botT(profile.preferredLocale, "email_info", { email }), profile.preferredLocale);
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
    if (data === "settings:logout") {
      const profile = await getProfileByChatId(chatId);
      const l = profile?.preferredLocale || "ru";
      await ctx.reply(botT(l, "logout_confirm"), {
        reply_markup: new InlineKeyboard()
          .text(botT(l, "yes"), "logout:yes")
          .text(botT(l, "no"), "logout:no"),
      });
      return;
    }
    if (data === "logout:yes") {
      const profile = await getProfileByChatId(chatId);
      const l = profile?.preferredLocale || "ru";
      if (profile) {
        await prisma.profile.update({ where: { id: profile.id }, data: { telegramChatId: null } });
      }
      clearState(chatId);
      await ctx.reply(botT(l, "logout_done"), { reply_markup: { remove_keyboard: true } });
      return;
    }
    if (data === "logout:no") {
      const profile = await getProfileByChatId(chatId);
      const l = profile?.preferredLocale || "ru";
      await replyMain(ctx, botT(l, "cancelled"), l);
      return;
    }
    if (data === "settings:timezone") {
      const profile = await getProfileByChatId(chatId);
      if (!profile) return;
      setState(chatId, { step: "settings:timezone", profileId: profile.id, locale: profile.preferredLocale, data: {} });
      await replyCancel(ctx, botT(profile.preferredLocale, "timezone_prompt"), profile.preferredLocale);
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
      await replyCancel(ctx, botT(st.locale || "ru", "enter_password"), st.locale || "ru");
    } catch { await ctx.reply(botT(st.locale || "ru", "phone_invalid")); }
    return;
  }

  if (st?.step === "settings:phone") {
    try {
      const normalized = normalizePhone(phone);
      await prisma.profile.update({ where: { id: st.profileId }, data: { phone: normalized } });
      clearState(chatId);
      await replyMain(ctx, botT(st.locale!, "phone_saved", { phone: normalized }), st.locale!);
    } catch { await ctx.reply(botT(st.locale || "ru", "phone_invalid")); }
    return;
  }
});

// ─── Keyboard action mapping ──────────────────────────────────────────────────

const KB_ACTIONS: Record<string, (ctx: Context) => Promise<void>> = {};
for (const locale of Object.keys(translations)) {
  const t = translations[locale];
  if (t.kb_meal) KB_ACTIONS[t.kb_meal] = startMealFlow;
  if (t.kb_med) KB_ACTIONS[t.kb_med] = startMedFlow;
  if (t.kb_weight) KB_ACTIONS[t.kb_weight] = startWeightFlow;
  if (t.kb_workout) KB_ACTIONS[t.kb_workout] = startWorkoutFlow;
  if (t.kb_today) KB_ACTIONS[t.kb_today] = showToday;
  if (t.kb_settings) KB_ACTIONS[t.kb_settings] = showSettings;
  if (t.kb_history) KB_ACTIONS[t.kb_history] = showHistory;
  if (t.kb_advice) KB_ACTIONS[t.kb_advice] = showAdvice;
  if (t.kb_cancel) KB_ACTIONS[t.kb_cancel] = async (ctx) => {
    clearState(ctx.chat!.id);
    const profile = await getProfileByChatId(ctx.chat!.id);
    const l = profile?.preferredLocale || "ru";
    await replyMain(ctx, botT(l, "cancelled"), l);
  };
}

// ─── Text handler ─────────────────────────────────────────────────────────────

bot.on("message:text", async (ctx) => {
  const chatId = ctx.chat.id;
  const text = ctx.message.text.trim();

  const action = KB_ACTIONS[text];
  if (action) return action(ctx);

  const st = getState(chatId);
  if (!st) return;

  try {
    // ── Auth flows ──
    if (st.step === "auth:email") {
      st.data!.email = text;
      st.step = "auth:email_password";
      await replyCancel(ctx, botT(st.locale || "ru", "enter_password"), st.locale || "ru");
      return;
    }
    if (st.step === "auth:email_password") {
      const email = st.data!.email;
      const locale = st.locale || "ru";
      st.data!.password = text;
      const { user } = await trySignIn(email, text);
      if (user) {
        const profile = await linkProfile(user.id, chatId);
        if (locale !== profile.preferredLocale) await prisma.profile.update({ where: { id: profile.id }, data: { preferredLocale: locale } });
        clearState(chatId);
        await replyMain(ctx, botT(locale, "login_success", { name: profile.name }), locale);
      } else {
        await ctx.reply(botT(locale, "login_failed") + "\n\n" + botT(locale, "register_offer"), {
          reply_markup: new InlineKeyboard()
            .text(botT(locale, "register_yes"), "auth:register_yes")
            .text(botT(locale, "register_no"), "auth:register_no"),
        });
      }
      return;
    }
    if (st.step === "auth:phone") {
      try {
        const normalized = normalizePhone(text);
        st.data!.phone = normalized;
        st.step = "auth:phone_password";
        await replyCancel(ctx, botT(st.locale || "ru", "enter_password"), st.locale || "ru");
      } catch { await ctx.reply(botT(st.locale || "ru", "phone_invalid")); }
      return;
    }
    if (st.step === "auth:phone_password") {
      const phone = st.data!.phone;
      const locale = st.locale || "ru";
      st.data!.password = text;
      const candidates = phoneAuthEmailCandidates(phone);
      let loggedIn = false;
      for (const email of candidates) {
        const { user } = await trySignIn(email, text);
        if (user) {
          const profile = await linkProfile(user.id, chatId, phone);
          if (locale !== profile.preferredLocale) await prisma.profile.update({ where: { id: profile.id }, data: { preferredLocale: locale } });
          clearState(chatId);
          await replyMain(ctx, botT(locale, "login_success", { name: profile.name }), locale);
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

    // ── Meal text flow ──
    if (st.step === "meal:input" || st.step === "meal:text_name") {
      st.data!.name = text;
      st.step = "meal:calories";
      await replyCancel(ctx, botT(st.locale!, "meal_calories_prompt"), st.locale!);
      return;
    }
    if (st.step === "meal:calories") {
      const cal = parseFloat(text);
      if (isNaN(cal) || cal <= 0) { await ctx.reply(botT(st.locale!, "meal_calories_prompt")); return; }
      st.data!.calories = cal;
      st.step = "meal:macros";
      await replyCancel(ctx, botT(st.locale!, "meal_macros_prompt"), st.locale!);
      return;
    }
    if (st.step === "meal:macros") {
      let protein: number | undefined, fat: number | undefined, carbs: number | undefined;
      if (text !== "/skip") {
        const parts = text.split(/[\s,/]+/).map(Number);
        if (parts.length >= 3 && parts.every(n => !isNaN(n))) [protein, fat, carbs] = parts;
      }
      const profile = await prisma.profile.findUnique({ where: { id: st.profileId } });
      await prisma.meal.create({
        data: {
          profileId: st.profileId!, date: todayStr(profile?.timezone),
          mealType: st.data!.mealType || "snack", name: st.data!.name,
          calories: st.data!.calories, protein, fat, carbs,
          photoPath: st.data!.photoPath || null,
        },
      });
      clearState(chatId);
      await replyMain(ctx, botT(st.locale!, "meal_saved", { name: st.data!.name, cal: Math.round(st.data!.calories) }), st.locale!);
      return;
    }

    // ── Med flow ──
    if (st.step === "med:name") {
      st.data!.name = text; st.step = "med:dosage";
      await replyCancel(ctx, botT(st.locale!, "med_dosage_prompt"), st.locale!);
      return;
    }
    if (st.step === "med:dosage") {
      st.data!.dosage = text; st.step = "med:time";
      await replyCancel(ctx, botT(st.locale!, "med_time_prompt"), st.locale!);
      return;
    }
    if (st.step === "med:time") {
      const profile = await prisma.profile.findUnique({ where: { id: st.profileId } });
      const tz = profile?.timezone || "UTC";
      const time = text === "/skip" ? nowTime(tz) : text.replace(".", ":");
      await prisma.medicationIntake.create({
        data: {
          profileId: st.profileId!, planId: st.data!.planId || null,
          date: todayStr(tz), name: st.data!.name, dosage: st.data!.dosage || null, takenTime: time,
        },
      });
      clearState(chatId);
      await replyMain(ctx, botT(st.locale!, "med_saved", { name: st.data!.name, dosage: st.data!.dosage || "", time }), st.locale!);
      return;
    }

    // ── Weight ──
    if (st.step === "weight:input") {
      const w = parseFloat(text.replace(",", "."));
      if (isNaN(w) || w <= 0) { await ctx.reply(botT(st.locale!, "weight_prompt")); return; }
      const profile = await prisma.profile.findUnique({ where: { id: st.profileId } });
      const today = todayStr(profile?.timezone);
      await prisma.weightEntry.upsert({
        where: { profileId_date: { profileId: st.profileId!, date: today } },
        create: { profileId: st.profileId!, date: today, weightKg: w },
        update: { weightKg: w },
      });
      clearState(chatId);
      await replyMain(ctx, botT(st.locale!, "weight_saved", { weight: w }), st.locale!);
      return;
    }

    // ── Workout ──
    if (st.step === "workout:duration") {
      const dur = parseFloat(text);
      if (isNaN(dur) || dur <= 0) { await ctx.reply(botT(st.locale!, "workout_duration_prompt")); return; }
      st.data!.duration = dur; st.step = "workout:name";
      await replyCancel(ctx, botT(st.locale!, "workout_name_prompt"), st.locale!);
      return;
    }
    if (st.step === "workout:name") {
      const name = text === "/skip" ? null : text;
      const profile = await prisma.profile.findUnique({ where: { id: st.profileId } });
      await prisma.workout.create({
        data: {
          profileId: st.profileId!, date: todayStr(profile?.timezone),
          type: st.data!.type, quantity: st.data!.duration, unit: "minutes", name,
        },
      });
      clearState(chatId);
      await replyMain(ctx, botT(st.locale!, "workout_saved", { type: botT(st.locale!, st.data!.type), duration: st.data!.duration }), st.locale!);
      return;
    }

    // ── Settings: profile ──
    if (st.step === "settings:name") {
      if (text !== "/skip") await prisma.profile.update({ where: { id: st.profileId }, data: { name: text } });
      st.step = "settings:goal";
      await replyCancel(ctx, botT(st.locale!, "profile_goal_prompt"), st.locale!);
      return;
    }
    if (st.step === "settings:goal") {
      if (text !== "/skip") {
        const goal = parseInt(text, 10);
        if (!isNaN(goal) && goal > 0) await prisma.profile.update({ where: { id: st.profileId }, data: { dailyCalorieGoal: goal } });
      }
      st.step = "settings:target_weight";
      await replyCancel(ctx, botT(st.locale!, "profile_target_prompt"), st.locale!);
      return;
    }
    if (st.step === "settings:target_weight") {
      if (text !== "/skip") {
        const tw = parseFloat(text.replace(",", "."));
        if (!isNaN(tw) && tw > 0) await prisma.profile.update({ where: { id: st.profileId }, data: { targetWeightKg: tw } });
      }
      st.step = "settings:height";
      await replyCancel(ctx, botT(st.locale!, "profile_height_prompt"), st.locale!);
      return;
    }
    if (st.step === "settings:height") {
      if (text !== "/skip") {
        const h = parseFloat(text.replace(",", "."));
        if (!isNaN(h) && h > 0) await prisma.profile.update({ where: { id: st.profileId }, data: { heightCm: h } });
      }
      clearState(chatId);
      await replyMain(ctx, botT(st.locale!, "profile_saved"), st.locale!);
      return;
    }

    // ── Settings: phone ──
    if (st.step === "settings:phone") {
      try {
        const normalized = normalizePhone(text);
        await prisma.profile.update({ where: { id: st.profileId }, data: { phone: normalized } });
        clearState(chatId);
        await replyMain(ctx, botT(st.locale!, "phone_saved", { phone: normalized }), st.locale!);
      } catch { await ctx.reply(botT(st.locale || "ru", "phone_invalid")); }
      return;
    }

    // ── Settings: timezone ──
    if (st.step === "settings:timezone") {
      try {
        new Intl.DateTimeFormat("en", { timeZone: text });
        await prisma.profile.update({ where: { id: st.profileId }, data: { timezone: text } });
        clearState(chatId);
        await replyMain(ctx, botT(st.locale!, "timezone_saved", { tz: text }), st.locale!);
      } catch {
        await ctx.reply(botT(st.locale!, "timezone_prompt"));
      }
      return;
    }
  } catch (e: any) {
    console.error("Text handler error:", e);
    await ctx.reply(botT(st?.locale || "ru", "error"));
  }
});

// ─── Photo handler ────────────────────────────────────────────────────────────

bot.on("message:photo", async (ctx) => {
  const chatId = ctx.chat.id;
  let st = getState(chatId);

  // If no active meal flow, auto-start one (convenient: just send a photo anytime)
  if (!st || (st.step !== "meal:input" && st.step !== "meal:text_name")) {
    const auth = await requireAuth(ctx);
    if (!auth) return;
    setState(chatId, { step: "meal:input", profileId: auth.profileId, locale: auth.locale, data: { mealType: "snack" } });
    st = getState(chatId)!;
  }

  try {
    await ctx.reply(botT(st.locale!, "meal_photo_analyzing"));

    const { buffer, base64 } = await downloadTelegramPhoto(ctx);

    // Upload to Supabase Storage
    let photoPath: string | null = null;
    try { photoPath = await uploadPhotoToStorage(buffer, "meals"); } catch (e) { console.error("Photo upload error:", e); }
    st.data!.photoPath = photoPath;

    // Analyze with AI
    const aiLang = AI_LANGUAGE[st.locale!] || AI_LANGUAGE.en;
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `You are a nutrition analyst. Analyze the food in the image. Return ONLY valid JSON: {"name": string, "calories": number, "protein": number, "fat": number, "carbs": number}. Name should be in ${aiLang}. Estimate reasonable values.`,
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } },
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
        name: result.name, cal: Math.round(result.calories),
        p: Math.round(result.protein || 0), f: Math.round(result.fat || 0), c: Math.round(result.carbs || 0),
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
    await replyCancel(ctx, botT(st.locale!, "error") + "\n" + botT(st.locale!, "meal_input_prompt"), st.locale!);
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

bot.catch((err) => { console.error("Bot error:", err); });

async function main() {
  await bot.api.setMyCommands([
    { command: "start", description: "Главное меню" },
    { command: "meal", description: "Записать еду" },
    { command: "med", description: "Записать лекарство" },
    { command: "weight", description: "Записать вес" },
    { command: "workout", description: "Записать тренировку" },
    { command: "today", description: "Сводка за сегодня" },
    { command: "history", description: "История за дату" },
    { command: "advice", description: "Советы" },
    { command: "schedules", description: "Расписания" },
    { command: "settings", description: "Настройки" },
    { command: "cancel", description: "Отмена" },
    { command: "help", description: "Помощь" },
  ]);

  await bot.api.setChatMenuButton({ menu_button: { type: "commands" } });

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
