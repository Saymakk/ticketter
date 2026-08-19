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
import { normalizePhone, phoneToEmail, phoneAuthEmailCandidates } from "../lib/auth/phone";

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
    not_linked: "Ваш Telegram не привязан к аккаунту. Войдите или зарегистрируйтесь:",
    login_email: "📧 Войти по почте", login_phone: "📱 Войти по телефону",
    register: "✨ Зарегистрироваться",
    register_how: "Как создать аккаунт?",
    register_email: "📧 Почтой", register_phone: "📱 По телефону",
    enter_email: "Введите email или номер телефона.\n\nТелефон любой страны, с кодом:\n• +1 202 555 0123\n• +44 20 7946 0958\n• +7 700 123 45 67\nПробелы, скобки и дефисы можно не убирать.",
    enter_password: "Введите пароль:",
    enter_password_new: "Придумайте пароль (минимум 6 символов):",
    enter_password_confirm: "Повторите пароль:",
    password_too_short: "Пароль слишком короткий. Минимум 6 символов.",
    passwords_mismatch: "Пароли не совпадают. Введите пароль заново.",
    email_invalid: "Не похоже на email. Пример: name@mail.com",
    already_registered: "Этот аккаунт уже есть. Войдите.",
    enter_phone: "Отправьте контакт или введите номер.\n\nЛюбая страна, с кодом:\n• +1 202 555 0123\n• +44 20 7946 0958\n• +7 700 123 45 67\nПробелы, скобки и дефисы можно не убирать.",
    share_contact: "📱 Отправить контакт",
    login_success: "✅ Вход выполнен! Добро пожаловать, {name}!",
    login_failed: "❌ Неверный логин или пароль.",
    register_offer: "Аккаунт не найден. Хотите зарегистрироваться?",
    register_yes: "Да, зарегистрироваться", register_no: "Нет",
    register_success: "✅ Регистрация успешна! Аккаунт привязан к Telegram.", register_failed: "❌ Ошибка: {error}",
    main_menu: "Выберите действие:",
    meal_type_prompt: "Выберите тип приёма пищи:",
    breakfast: "🌅 Завтрак", lunch: "☀️ Обед", dinner: "🌙 Ужин", snack: "🍎 Перекус",
    meal_input_prompt: "📷 Отправьте фото еды или напишите название блюда:",
    meal_label_prompt: "📷 Отправьте фото этикетки с КБЖУ:",
    meal_label_result: "🏷 Этикетка:\n🔥 {cal} ккал/100г\nБелки: {p}г | Жиры: {f}г | Углеводы: {c}г\n\nВведите вес порции (г):",
    meal_calories_prompt: "Введите калории:", meal_macros_prompt: "Белки/жиры/углеводы через пробел (или /skip):",
    label: "📋 Этикетка",
    meal_saved: "✅ Приём пищи сохранён!\n🍽 {name}\n🔥 {cal} ккал",
    meal_photo_analyzing: "🔍 Анализирую фото...",
    meal_photo_result: "🤖 AI определил:\n🍽 {name}\n🔥 {cal} ккал\nБелки: {p}г | Жиры: {f}г | Углеводы: {c}г",
    confirm: "✅ Подтвердить", edit: "✏️ Ввести вручную",
    med_prompt: "Выберите лекарство или добавьте новое:", med_custom: "➕ Другое",
    med_name_prompt: "Название лекарства (или отправьте фото упаковки):", med_dosage_prompt: "Дозировка:",
    med_photo_analyzing: "🔍 Анализирую фото упаковки...",
    med_photo_result: "🤖 AI определил: {name}\n💊 {dosage}\n\nПодтвердить?",
    med_dosage_keep: "Дозировка (или /skip чтобы оставить «{dosage}»):",
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
    help: "📖 Команды:\n/meal — Еда и расписание питания\n/med — Лекарства и расписание\n/weight — Вес\n/workout — Тренировка\n/today — Сводка\n/history — История\n/advice — Советы\n/schedules — Расписания\n/settings — Настройки\n/cancel — Отмена",
    running: "Бег", walking: "Ходьба", cycling: "Велосипед", strength: "Силовая",
    yoga: "Йога", swimming: "Плавание", hiit: "HIIT", sports: "Спорт", other: "Другое",
    cancel: "❌ Отмена", cancelled: "Действие отменено.",
    phone_invalid: "❌ Неверный формат телефона.\nНужен международный номер с кодом страны, 8–15 цифр.\nПримеры: +1 202 555 0123 · +90 532 123 45 67 · +7 700 123 45 67",
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
    taken: "Принял(а)",
    taken_meal_done: "✅ {name} записан!",
    taken_med_done: "✅ 💊 {name} принят в {time}!",
    med_stop: "🛑 Окончен", med_stopped: "✅ «{name}» убран из расписания.",
    med_stop_confirm: "Убрать «{name}» из расписания? Напоминания больше не будут приходить.",
    yes: "Да", no: "Нет",
    settings_logout: "🚪 Выйти из аккаунта",
    logout_confirm: "Вы уверены, что хотите выйти?",
    logout_done: "✅ Вы вышли из аккаунта. Напишите /start чтобы войти снова.",
    kb_cancel: "❌ Отмена", kb_back: "◀️ Назад", kb_history: "📅 История", kb_advice: "💡 Советы",
    kb_sec_meals: "🍽 Приёмы пищи", kb_sec_meds: "💊 Приёмы лекарств", kb_sec_workouts: "🏋️ Тренировки дня",
    today_pick: "Что показать за сегодня?",
    recent_editable: "✏️ Недавние записи (можно изменить в течение часа):",
    edit_meal: "✏️ {name}", delete_entry: "🗑 Удалить",
    edit_meal_name: "Новое название (или /skip):", edit_meal_cal: "Новые калории (или /skip):",
    edit_meal_macros: "Б/Ж/У через пробел (или /skip):",
    edit_med_name: "Новое название (или /skip):", edit_med_dosage: "Новая дозировка (или /skip):",
    edit_med_time: "Новое время (или /skip):",
    entry_deleted: "✅ Запись удалена.", entry_updated: "✅ Запись обновлена!",
    edit_choose: "Что редактировать?",
    hub_meal_hint: "Записать приём пищи или настроить расписание с напоминаниями:",
    hub_med_hint: "Записать приём лекарства или настроить расписание с напоминаниями:",
    hub_meal_log: "🍽 Записать приём пищи",
    hub_meal_label: "📋 Сфотографировать этикетку",
    hub_meal_sched: "📅 Расписание питания",
    hub_med_log: "💊 Записать приём лекарства",
    hub_med_sched: "📅 Расписание лекарств",
    sch_pick_kind: "Какое расписание открыть?",
    sch_meal_title: "📅 Расписание питания",
    sch_med_title: "📅 Расписание лекарств",
    sch_empty: "Пока пусто. Добавьте приём — бот будет напоминать в указанное время.",
    sch_pick: "Нажмите на пункт, чтобы посмотреть или изменить:",
    sch_add: "➕ Добавить в расписание",
    sch_paused: "на паузе",
    sch_active: "активно",
    sch_back: "◀️ К списку",
    sch_pause: "⏸ Пауза",
    sch_resume: "▶️ Включить",
    sch_delete: "🗑 Удалить",
    sch_edit_name: "✏️ Название",
    sch_edit_times: "🕐 Время",
    sch_edit_rec: "🔁 Повтор",
    sch_edit_type: "🍽 Тип",
    sch_edit_dosage: "💊 Доза",
    sch_name_prompt: "Название расписания (например Завтрак):",
    sch_med_name_prompt: "Название лекарства (или фото упаковки):",
    sch_times_prompt: "Время напоминаний через пробел или запятую.\nПример: 08:00 13:00 20:00\nМожно с точкой: 08.00, 13.00",
    sch_times_invalid: "Не распознал время. Пример: 08:00 20:00",
    sch_rec_prompt: "Как часто напоминать?",
    sch_rec_daily: "Каждый день",
    sch_rec_weekly: "По дням недели",
    sch_rec_interval: "Через несколько дней",
    sch_weekdays_prompt: "Выберите дни и нажмите «Готово»:",
    sch_weekdays_done: "Готово",
    sch_weekdays_need: "Выберите хотя бы один день.",
    sch_interval_prompt: "Каждые сколько дней? (число, например 2):",
    sch_interval_invalid: "Введите целое число от 1.",
    sch_saved: "✅ Расписание сохранено. Напоминания придут в этот чат и в пуш сайта.",
    sch_saved_when: "Часовой пояс: {tz}. Сейчас {now}. Напоминания: {times}.",
    tz_utc_warn: "⚠️ Сейчас стоит UTC. Если вы не в UTC — поставьте свой пояс в Настройках, иначе уведомления придут не в то время.",
    sch_updated: "✅ Расписание обновлено.",
    sch_deleted: "✅ Расписание удалено.",
    sch_paused_ok: "⏸ «{name}» на паузе — напоминания не приходят.",
    sch_resumed_ok: "▶️ «{name}» снова активно.",
    sch_delete_confirm: "Удалить расписание «{name}»?",
    sch_type_prompt: "Тип приёма пищи:",
    sch_card_times: "Время: {times}",
    sch_card_rec: "Повтор: {rec}",
    sch_card_status: "Статус: {status}",
    sch_card_type: "Тип: {type}",
    sch_card_dosage: "Дозировка: {dosage}",
    sch_notify_hint: "Уведомления приходят в этот чат в указанное время.",
  },
  en: {
    welcome: "Welcome to Healthy Life! 🌿",
    not_linked: "Your Telegram is not linked. Sign in or create an account:",
    login_email: "📧 Email login", login_phone: "📱 Phone login",
    register: "✨ Sign up",
    register_how: "How do you want to create an account?",
    register_email: "📧 With email", register_phone: "📱 With phone",
    enter_email: "Enter your email or phone number.\n\nAny country, with country code:\n• +1 202 555 0123\n• +44 20 7946 0958\n• +7 700 123 45 67\nSpaces, brackets and dashes are fine.",
    enter_password: "Enter password:",
    enter_password_new: "Create a password (at least 6 characters):",
    enter_password_confirm: "Repeat the password:",
    password_too_short: "Password is too short. Minimum 6 characters.",
    passwords_mismatch: "Passwords do not match. Enter a new password.",
    email_invalid: "That does not look like an email. Example: name@mail.com",
    already_registered: "This account already exists. Please sign in.",
    enter_phone: "Send a contact or type your phone number.\n\nAny country, with country code:\n• +1 202 555 0123\n• +44 20 7946 0958\n• +7 700 123 45 67\nSpaces, brackets and dashes are fine.",
    share_contact: "📱 Share contact",
    login_success: "✅ Welcome, {name}!", login_failed: "❌ Wrong login or password.",
    register_offer: "Account not found. Register?",
    register_yes: "Yes, register", register_no: "No",
    register_success: "✅ Registered! Your Telegram is linked.", register_failed: "❌ Error: {error}",
    main_menu: "Choose an action:",
    meal_type_prompt: "Meal type:",
    breakfast: "🌅 Breakfast", lunch: "☀️ Lunch", dinner: "🌙 Dinner", snack: "🍎 Snack",
    meal_input_prompt: "📷 Send a food photo or type dish name:",
    meal_label_prompt: "📷 Send a photo of the nutrition label:",
    meal_label_result: "🏷 Label:\n🔥 {cal} kcal/100g\nP: {p}g | F: {f}g | C: {c}g\n\nEnter portion weight (g):",
    meal_calories_prompt: "Enter calories:", meal_macros_prompt: "Protein/fat/carbs (or /skip):",
    label: "📋 Label",
    meal_saved: "✅ Saved!\n🍽 {name}\n🔥 {cal} kcal",
    meal_photo_analyzing: "🔍 Analyzing photo...",
    meal_photo_result: "🤖 AI detected:\n🍽 {name}\n🔥 {cal} kcal\nP: {p}g | F: {f}g | C: {c}g",
    confirm: "✅ Confirm", edit: "✏️ Edit manually",
    med_prompt: "Choose medication or add new:", med_custom: "➕ Other",
    med_name_prompt: "Medication name (or send pack photo):", med_dosage_prompt: "Dosage:",
    med_photo_analyzing: "🔍 Analyzing pack photo...",
    med_photo_result: "🤖 AI detected: {name}\n💊 {dosage}\n\nConfirm?",
    med_dosage_keep: "Dosage (or /skip to keep «{dosage}»):",
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
    phone_invalid: "❌ Invalid phone.\nUse an international number with country code, 8–15 digits.\nExamples: +1 202 555 0123 · +90 532 123 45 67 · +7 700 123 45 67",
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
    taken: "Taken",
    taken_meal_done: "✅ {name} logged!",
    taken_med_done: "✅ 💊 {name} taken at {time}!",
    med_stop: "🛑 Done", med_stopped: "✅ «{name}» removed from schedule.",
    med_stop_confirm: "Remove «{name}» from schedule? No more reminders will be sent.",
    yes: "Yes", no: "No",
    settings_logout: "🚪 Logout",
    logout_confirm: "Are you sure you want to logout?",
    logout_done: "✅ Logged out. Type /start to login again.",
    kb_cancel: "❌ Cancel", kb_back: "◀️ Back", kb_history: "📅 History", kb_advice: "💡 Advice",
    kb_sec_meals: "🍽 Meals", kb_sec_meds: "💊 Doses", kb_sec_workouts: "🏋️ Workouts",
    today_pick: "What should I show for today?",
    recent_editable: "✏️ Recent entries (editable within an hour):",
    edit_meal: "✏️ {name}", delete_entry: "🗑 Delete",
    edit_meal_name: "New name (or /skip):", edit_meal_cal: "New calories (or /skip):",
    edit_meal_macros: "P/F/C space-separated (or /skip):",
    edit_med_name: "New name (or /skip):", edit_med_dosage: "New dosage (or /skip):",
    edit_med_time: "New time (or /skip):",
    entry_deleted: "✅ Entry deleted.", entry_updated: "✅ Entry updated!",
    edit_choose: "What to edit?",
    hub_meal_hint: "Log a meal or set up a meal schedule with reminders:",
    hub_med_hint: "Log a dose or set up a medication schedule with reminders:",
    hub_meal_log: "🍽 Log a meal",
    hub_meal_label: "📋 Scan nutrition label",
    hub_meal_sched: "📅 Meal schedule",
    hub_med_log: "💊 Log a dose",
    hub_med_sched: "📅 Medication schedule",
    sch_pick_kind: "Which schedule to open?",
    sch_meal_title: "📅 Meal schedule",
    sch_med_title: "📅 Medication schedule",
    sch_empty: "Nothing yet. Add a slot — the bot will remind you at those times.",
    sch_pick: "Tap an item to view or edit:",
    sch_add: "➕ Add to schedule",
    sch_paused: "paused",
    sch_active: "active",
    sch_back: "◀️ Back to list",
    sch_pause: "⏸ Pause",
    sch_resume: "▶️ Resume",
    sch_delete: "🗑 Delete",
    sch_edit_name: "✏️ Name",
    sch_edit_times: "🕐 Times",
    sch_edit_rec: "🔁 Repeat",
    sch_edit_type: "🍽 Type",
    sch_edit_dosage: "💊 Dosage",
    sch_name_prompt: "Schedule name (e.g. Breakfast):",
    sch_med_name_prompt: "Medication name (or pack photo):",
    sch_times_prompt: "Reminder times, space or comma separated.\nExample: 08:00 13:00 20:00\nDots work too: 08.00, 13.00",
    sch_times_invalid: "Could not parse times. Example: 08:00 20:00",
    sch_rec_prompt: "How often should I remind you?",
    sch_rec_daily: "Every day",
    sch_rec_weekly: "On weekdays",
    sch_rec_interval: "Every N days",
    sch_weekdays_prompt: "Pick days, then tap Done:",
    sch_weekdays_done: "Done",
    sch_weekdays_need: "Pick at least one day.",
    sch_interval_prompt: "Every how many days? (e.g. 2):",
    sch_interval_invalid: "Enter a whole number from 1.",
    sch_saved: "✅ Schedule saved. Reminders will come in this chat and as site push.",
    sch_saved_when: "Timezone: {tz}. Now {now}. Reminders: {times}.",
    tz_utc_warn: "⚠️ Timezone is UTC. Set yours in Settings or reminders will fire at the wrong hour.",
    sch_updated: "✅ Schedule updated.",
    sch_deleted: "✅ Schedule deleted.",
    sch_paused_ok: "⏸ «{name}» paused — no more reminders.",
    sch_resumed_ok: "▶️ «{name}» is active again.",
    sch_delete_confirm: "Delete schedule «{name}»?",
    sch_type_prompt: "Meal type:",
    sch_card_times: "Times: {times}",
    sch_card_rec: "Repeat: {rec}",
    sch_card_status: "Status: {status}",
    sch_card_type: "Type: {type}",
    sch_card_dosage: "Dosage: {dosage}",
    sch_notify_hint: "Reminders arrive in this chat at the times you set.",
  },
  kk: {
    welcome: "Healthy Life-қа қош келдіңіз! 🌿",
    not_linked: "Telegram байланыспаған. Кіріңіз немесе тіркеліңіз:",
    login_email: "📧 Email", login_phone: "📱 Телефон",
    register: "✨ Тіркелу",
    register_how: "Қалай тіркелесіз?",
    register_email: "📧 Поштамен", register_phone: "📱 Телефонмен",
    enter_email: "Email немесе телефон енгізіңіз.\n\nКез келген ел, кодпен:\n• +1 202 555 0123\n• +44 20 7946 0958\n• +7 700 123 45 67\nБос орын, жақша, дефис болса да болады.",
    enter_password: "Құпия сөз:",
    enter_password_new: "Құпия сөз ойлап табыңыз (кемінде 6 таңба):",
    enter_password_confirm: "Құпия сөзді қайталаңыз:",
    password_too_short: "Құпия сөз тым қысқа. Кемінде 6 таңба.",
    passwords_mismatch: "Құпия сөздер сәйкес емес. Қайта енгізіңіз.",
    email_invalid: "Бұл email емес. Мысалы: name@mail.com",
    already_registered: "Бұл аккаунт бар. Кіріңіз.",
    enter_phone: "Контакт жіберіңіз немесе нөмір жазыңыз.\n\nКез келген ел, кодпен:\n• +1 202 555 0123\n• +44 20 7946 0958\n• +7 700 123 45 67\nБос орын, жақша, дефис болса да болады.",
    share_contact: "📱 Контакт жіберу",
    login_success: "✅ Қош келдіңіз, {name}!", login_failed: "❌ Қате логин/құпия сөз.",
    register_offer: "Аккаунт жоқ. Тіркелу?",
    register_yes: "Иә", register_no: "Жоқ",
    register_success: "✅ Тіркелу сәтті! Telegram байланыстырылды.", register_failed: "❌ Қате: {error}",
    main_menu: "Әрекетті таңдаңыз:",
    meal_type_prompt: "Тамақ түрі:",
    breakfast: "🌅 Таңғы ас", lunch: "☀️ Түскі ас", dinner: "🌙 Кешкі ас", snack: "🍎 Тіскебасар",
    meal_input_prompt: "📷 Тамақ суретін жіберіңіз немесе атауын жазыңыз:",
    meal_label_prompt: "📷 КБЖУ этикеткасының суретін жіберіңіз:",
    meal_label_result: "🏷 Этикетка:\n🔥 {cal} ккал/100г\nА: {p}г | М: {f}г | К: {c}г\n\nПорция салмағын енгізіңіз (г):",
    meal_calories_prompt: "Калория:", meal_macros_prompt: "Ақуыз/май/көмірсу (немесе /skip):",
    label: "📋 Этикетка",
    meal_saved: "✅ 🍽 {name}\n🔥 {cal} ккал",
    meal_photo_analyzing: "🔍 Сурет талдануда...",
    meal_photo_result: "🤖 AI:\n🍽 {name}\n🔥 {cal} ккал\nА: {p}г | М: {f}г | К: {c}г",
    confirm: "✅ Растау", edit: "✏️ Қолмен",
    med_prompt: "Дәріні таңдаңыз:", med_custom: "➕ Басқа",
    med_name_prompt: "Дәрі атауы (немесе қаптама суреті):", med_dosage_prompt: "Дозасы:",
    med_photo_analyzing: "🔍 Қаптама суреті талдануда...",
    med_photo_result: "🤖 AI: {name}\n💊 {dosage}\n\nРастайсыз ба?",
    med_dosage_keep: "Доза (немесе /skip — «{dosage}» қалдыру):",
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
    phone_invalid: "❌ Телефон қате.\nЕл коды бар халықаралық нөмір керек, 8–15 цифр.\nМысалы: +1 202 555 0123 · +90 532 123 45 67 · +7 700 123 45 67",
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
    taken: "Қабылдадым",
    taken_meal_done: "✅ {name} жазылды!",
    taken_med_done: "✅ 💊 {name} {time} қабылданды!",
    med_stop: "🛑 Аяқталды", med_stopped: "✅ «{name}» кестеден алынды.",
    med_stop_confirm: "«{name}» кестеден алу? Еске салулар жіберілмейді.",
    yes: "Иә", no: "Жоқ",
    settings_logout: "🚪 Шығу",
    logout_confirm: "Шығуға сенімдісіз бе?",
    logout_done: "✅ Шықтыңыз. Қайта кіру үшін /start жазыңыз.",
    kb_cancel: "❌ Болдырмау", kb_back: "◀️ Артқа", kb_history: "📅 Тарих", kb_advice: "💡 Кеңес",
    kb_sec_meals: "🍽 Тамақтану", kb_sec_meds: "💊 Дәрі қабылдау", kb_sec_workouts: "🏋️ Жаттығулар",
    today_pick: "Бүгін не көрсетілсін?",
    recent_editable: "✏️ Соңғы жазбалар (бір сағат ішінде өзгертуге болады):",
    edit_meal: "✏️ {name}", delete_entry: "🗑 Жою",
    edit_meal_name: "Жаңа атау (немесе /skip):", edit_meal_cal: "Жаңа калория (немесе /skip):",
    edit_meal_macros: "А/М/К бос орын арқылы (немесе /skip):",
    edit_med_name: "Жаңа атау (немесе /skip):", edit_med_dosage: "Жаңа доза (немесе /skip):",
    edit_med_time: "Жаңа уақыт (немесе /skip):",
    entry_deleted: "✅ Жазба жойылды.", entry_updated: "✅ Жазба жаңартылды!",
    edit_choose: "Нені өзгертесіз?",
    hub_meal_hint: "Тамақтануды жазыңыз немесе еске салу кестесін баптаңыз:",
    hub_med_hint: "Дәрі қабылдауды жазыңыз немесе еске салу кестесін баптаңыз:",
    hub_meal_log: "🍽 Тамақтануды жазу",
    hub_meal_label: "📋 Этикетканы суретке түсіру",
    hub_meal_sched: "📅 Тамақ кестесі",
    hub_med_log: "💊 Дәрі қабылдауды жазу",
    hub_med_sched: "📅 Дәрі кестесі",
    sch_pick_kind: "Қай кестені ашамыз?",
    sch_meal_title: "📅 Тамақ кестесі",
    sch_med_title: "📅 Дәрі кестесі",
    sch_empty: "Әзірге бос. Қабылдау қосыңыз — бот сол уақытта еске салады.",
    sch_pick: "Қарау немесе өзгерту үшін түртіңіз:",
    sch_add: "➕ Кестеге қосу",
    sch_paused: "кідіртілген",
    sch_active: "белсенді",
    sch_back: "◀️ Тізімге",
    sch_pause: "⏸ Кідірту",
    sch_resume: "▶️ Қосу",
    sch_delete: "🗑 Жою",
    sch_edit_name: "✏️ Атауы",
    sch_edit_times: "🕐 Уақыт",
    sch_edit_rec: "🔁 Қайталау",
    sch_edit_type: "🍽 Түрі",
    sch_edit_dosage: "💊 Доза",
    sch_name_prompt: "Кесте атауы (мысалы Таңғы ас):",
    sch_med_name_prompt: "Дәрі атауы (немесе қаптама суреті):",
    sch_times_prompt: "Еске салу уақыттары, бос орын немесе үтір арқылы.\nМысал: 08:00 13:00 20:00\nНүкте де болады: 08.00, 13.00",
    sch_times_invalid: "Уақытты тани алмадым. Мысал: 08:00 20:00",
    sch_rec_prompt: "Қаншалықты жиі еске салайын?",
    sch_rec_daily: "Күн сайын",
    sch_rec_weekly: "Апта күндері",
    sch_rec_interval: "Бірнеше күннен кейін",
    sch_weekdays_prompt: "Күндерді таңдап, «Дайын» басыңыз:",
    sch_weekdays_done: "Дайын",
    sch_weekdays_need: "Кемінде бір күн таңдаңыз.",
    sch_interval_prompt: "Неше күн сайын? (мысалы 2):",
    sch_interval_invalid: "1-ден бастап бүтін сан енгізіңіз.",
    sch_saved: "✅ Кесте сақталды. Еске салулар осы чатқа және сайт пушына келеді.",
    sch_saved_when: "Уақыт белдеуі: {tz}. Қазір {now}. Еске салулар: {times}.",
    tz_utc_warn: "⚠️ Қазір UTC тұр. Өз белдеуіңізді Баптаулардан қойыңыз, әйтпесе еске салулар басқа уақытта келеді.",
    sch_updated: "✅ Кесте жаңартылды.",
    sch_deleted: "✅ Кесте жойылды.",
    sch_paused_ok: "⏸ «{name}» кідіртілді — еске салулар жіберілмейді.",
    sch_resumed_ok: "▶️ «{name}» қайта белсенді.",
    sch_delete_confirm: "«{name}» кестесін жою?",
    sch_type_prompt: "Тамақ түрі:",
    sch_card_times: "Уақыт: {times}",
    sch_card_rec: "Қайталау: {rec}",
    sch_card_status: "Күйі: {status}",
    sch_card_type: "Түрі: {type}",
    sch_card_dosage: "Дозасы: {dosage}",
    sch_notify_hint: "Еске салулар осы чатқа көрсетілген уақытта келеді.",
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

/** Bot prompts and user taps to delete so the chat stays readable. */
const ephemeralMsgs = new Map<number, number[]>();

function rememberMsg(chatId: number | undefined, id?: number) {
  if (!chatId || !id) return;
  const list = ephemeralMsgs.get(chatId) || [];
  list.push(id);
  ephemeralMsgs.set(chatId, list);
}

async function sweepChat(ctx: Context) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  const ids = ephemeralMsgs.get(chatId) || [];
  ephemeralMsgs.delete(chatId);
  const userMsg = ctx.message;
  const isPhoto = !!userMsg?.photo;
  const isCmd = !!userMsg?.text?.startsWith("/");
  if (userMsg?.message_id && !isPhoto && !isCmd) ids.push(userMsg.message_id);
  const cbMsg = ctx.callbackQuery?.message;
  if (cbMsg && "message_id" in cbMsg) ids.push(cbMsg.message_id);
  await Promise.all([...new Set(ids)].map((id) => ctx.api.deleteMessage(chatId, id).catch(() => {})));
}

function kb(rows: string[][]): Keyboard {
  const k = new Keyboard();
  for (const row of rows) {
    for (const label of row) if (label) k.text(label);
    k.row();
  }
  return k.resized().persistent();
}

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
  return kb([[botT(locale, "kb_cancel")]]);
}

function mealHubKeyboard(locale: string): Keyboard {
  return kb([
    [botT(locale, "hub_meal_log")],
    [botT(locale, "hub_meal_label")],
    [botT(locale, "hub_meal_sched")],
    [botT(locale, "kb_back")],
  ]);
}

function medHubKeyboard(locale: string): Keyboard {
  return kb([
    [botT(locale, "hub_med_log")],
    [botT(locale, "hub_med_sched")],
    [botT(locale, "kb_back")],
  ]);
}

function todayPickKeyboard(locale: string): Keyboard {
  return kb([
    [botT(locale, "kb_sec_meals"), botT(locale, "kb_sec_meds")],
    [botT(locale, "kb_sec_workouts"), botT(locale, "kb_back")],
  ]);
}

function mealTypeReplyKb(locale: string): Keyboard {
  return kb([
    [botT(locale, "breakfast"), botT(locale, "lunch")],
    [botT(locale, "dinner"), botT(locale, "snack")],
    [botT(locale, "label")],
    [botT(locale, "kb_cancel")],
  ]);
}

function workoutTypeReplyKb(locale: string): Keyboard {
  const types = ["running", "walking", "cycling", "strength", "yoga", "swimming", "hiit", "sports", "other"];
  const rows: string[][] = [];
  for (let i = 0; i < types.length; i += 3) {
    rows.push(types.slice(i, i + 3).map((t) => botT(locale, t)));
  }
  rows.push([botT(locale, "kb_cancel")]);
  return kb(rows);
}

function recReplyKb(locale: string): Keyboard {
  return kb([
    [botT(locale, "sch_rec_daily")],
    [botT(locale, "sch_rec_weekly")],
    [botT(locale, "sch_rec_interval")],
    [botT(locale, "kb_cancel")],
  ]);
}

function weekdayReplyKb(selected: number[], locale: string): Keyboard {
  const labels = getWeekdays(locale);
  const row1: string[] = [];
  const row2: string[] = [];
  for (let i = 1; i <= 7; i++) {
    const mark = selected.includes(i) ? "✓ " : "";
    (i <= 4 ? row1 : row2).push(`${mark}${labels[i - 1]}`);
  }
  return kb([row1, row2, [botT(locale, "sch_weekdays_done")], [botT(locale, "kb_cancel")]]);
}

function yesNoKeyboard(locale: string): Keyboard {
  return kb([[botT(locale, "yes"), botT(locale, "no")]]);
}

function confirmEditKeyboard(locale: string): Keyboard {
  return kb([[botT(locale, "confirm"), botT(locale, "edit")], [botT(locale, "kb_cancel")]]);
}

async function replyMain(ctx: Context, text: string, locale = "ru") {
  await sweepChat(ctx);
  await ctx.reply(text, { reply_markup: mainKeyboard(locale) });
}

async function replyCancel(ctx: Context, text: string, locale = "ru") {
  await sweepChat(ctx);
  const msg = await ctx.reply(text, { reply_markup: cancelKeyboard(locale) });
  rememberMsg(ctx.chat?.id, msg.message_id);
}

async function replyKb(ctx: Context, text: string, keyboard: Keyboard, track = true) {
  await sweepChat(ctx);
  const msg = await ctx.reply(text, { reply_markup: keyboard });
  if (track) rememberMsg(ctx.chat?.id, msg.message_id);
  return msg;
}

async function goBack(ctx: Context) {
  const chatId = ctx.chat!.id;
  const st = getState(chatId);
  const to = st?.data?.backTo || "main";
  if (to === "auth") {
    await showAuthGate(ctx, st?.locale || "ru");
    return;
  }
  if (to === "meal_hub") return showMealHub(ctx);
  if (to === "med_hub") return showMedHub(ctx);
  if (to === "today") return showToday(ctx);
  if (to === "mslist") return showMealSchedules(ctx);
  if (to === "dslist") return showMedSchedules(ctx);
  if (to === "settings") return showSettings(ctx);
  if (to === "sch_meal_card" && st?.data?.planId) return showMealPlanCard(ctx, st.data.planId);
  if (to === "sch_med_card" && st?.data?.planId) return showMedPlanCard(ctx, st.data.planId);
  clearState(chatId);
  const profile = await getProfileByChatId(chatId);
  const l = profile?.preferredLocale || st?.locale || "ru";
  await replyMain(ctx, botT(l, "main_menu"), l);
}

function todayStr(timezone = "UTC"): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    return `${parts.find(p => p.type === "year")!.value}-${parts.find(p => p.type === "month")!.value}-${parts.find(p => p.type === "day")!.value}`;
  } catch { return new Date().toISOString().slice(0, 10); }
}

function nowTime(timezone = "UTC"): string {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
    const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
    return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
  } catch {
    return new Date().toISOString().slice(11, 16);
  }
}

function parseDateInput(input: string): string | null {
  const m = input.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

async function getProfileByChatId(chatId: number) {
  return prisma.profile.findUnique({ where: { telegramChatId: String(chatId) } });
}

function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
}

function parseLoginId(raw: string): { email: string; phone?: string } | null {
  const text = raw.trim();
  if (isValidEmail(text)) return { email: text.toLowerCase() };
  try {
    const phone = normalizePhone(text);
    return { email: phoneToEmail(phone), phone };
  } catch {
    return null;
  }
}

function authMenuKb(locale: string, canRegister: boolean): Keyboard {
  const rows = [
    [botT(locale, "login_email")],
    [botT(locale, "login_phone")],
  ];
  if (canRegister) rows.push([botT(locale, "register")]);
  return kb(rows);
}

async function showAuthGate(ctx: Context, locale: string, extra = "") {
  const chatId = ctx.chat!.id;
  const existing = await getProfileByChatId(chatId);
  setState(chatId, { step: "awaiting_auth", locale, data: {} });
  const text = extra
    ? `${extra}\n\n${botT(locale, "not_linked")}`
    : `${botT(locale, "welcome")}\n\n${botT(locale, "not_linked")}`;
  await replyKb(ctx, text, authMenuKb(locale, !existing));
}

async function startRegisterFlow(ctx: Context, locale: string) {
  const existing = await getProfileByChatId(ctx.chat!.id);
  if (existing) {
    await showAuthGate(ctx, existing.preferredLocale || locale, botT(locale, "already_registered"));
    return;
  }
  setState(ctx.chat!.id, { step: "auth:reg_method", locale, data: { backTo: "auth" } });
  await replyKb(ctx, botT(locale, "register_how"), kb([
    [botT(locale, "register_email")],
    [botT(locale, "register_phone")],
    [botT(locale, "kb_back")],
  ]));
}

async function promptContactOrNumber(ctx: Context, locale: string, messageKey = "enter_phone") {
  const phoneKb = new Keyboard()
    .requestContact(botT(locale, "share_contact"))
    .text(botT(locale, "kb_cancel"))
    .resized()
    .persistent();
  await sweepChat(ctx);
  const msg = await ctx.reply(botT(locale, messageKey), { reply_markup: phoneKb });
  rememberMsg(ctx.chat!.id, msg.message_id);
}

async function requireAuth(ctx: Context): Promise<{ profileId: string; locale: string; timezone: string } | null> {
  const chatId = ctx.chat?.id;
  if (!chatId) return null;
  const profile = await getProfileByChatId(chatId);
  if (!profile || profile.botLoggedOut) {
    const st = getState(chatId);
    const locale = st?.locale || profile?.preferredLocale || "ru";
    await showAuthGate(ctx, locale);
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

/** Short, user-facing reason for a failed AI call — full stack goes to the log. */
function aiErrorDetail(e: any): string {
  const msg = e?.error?.message || e?.message || String(e);
  return `⚠️ ${String(msg).slice(0, 300)}`;
}

/** Vision call shared by all photo flows. No max_tokens: reasoning models reject it. */
async function visionJson(base64: string, systemPrompt: string, userText: string): Promise<any> {
  const response = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}`, detail: "low" } },
        ],
      },
    ],
  });
  const raw = response.choices[0]?.message?.content || "";
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error(`AI returned no JSON: ${raw.slice(0, 200)}`);
  return JSON.parse(body.slice(start, end + 1));
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

async function linkProfile(userId: string, chatId: number, phone?: string, name?: string) {
  let profile = await prisma.profile.findUnique({ where: { userId } });
  const updateData: Record<string, unknown> = { telegramChatId: String(chatId), botLoggedOut: false };
  if (phone) updateData.phone = phone;
  if (profile) {
    profile = await prisma.profile.update({ where: { id: profile.id }, data: updateData });
  } else {
    profile = await prisma.profile.create({
      data: {
        userId,
        timezone: "Asia/Almaty",
        ...(name ? { name } : {}),
        ...updateData,
      },
    });
  }
  return profile;
}

async function completeRegistration(ctx: Context, st: UserState) {
  const locale = st.locale || "ru";
  const email = String(st.data?.email || "").trim().toLowerCase();
  const password = String(st.data?.password || "");
  const phone = st.data?.phone ? String(st.data.phone) : undefined;
  if (!email || !password) {
    await showAuthGate(ctx, locale, botT(locale, "register_failed", { error: "missing data" }));
    return;
  }
  const { user, error } = await trySignUp(email, password);
  if (error || !user) {
    const msg = error?.message || "unknown";
    if (/already|registered|exists/i.test(msg)) {
      await showAuthGate(ctx, locale, botT(locale, "already_registered"));
      return;
    }
    await showAuthGate(ctx, locale, botT(locale, "register_failed", { error: msg }));
    return;
  }
  const displayName = ctx.from?.first_name?.trim() || undefined;
  try {
    const profile = await linkProfile(user.id, ctx.chat!.id, phone, displayName);
    if (locale !== profile.preferredLocale) {
      await prisma.profile.update({ where: { id: profile.id }, data: { preferredLocale: locale } });
    }
  } catch (e: any) {
    if (e?.code === "P2002") {
      await showAuthGate(ctx, locale, botT(locale, "already_registered"));
      return;
    }
    await showAuthGate(ctx, locale, botT(locale, "register_failed", { error: e?.message || "db" }));
    return;
  }
  clearState(ctx.chat!.id);
  await replyMain(ctx, botT(locale, "register_success"), locale);
}

// ─── Feature flows ────────────────────────────────────────────────────────────

async function showMealHub(ctx: Context) {
  const auth = await requireAuth(ctx);
  if (!auth) return;
  const l = auth.locale;
  setState(ctx.chat!.id, { step: "hub:meal", profileId: auth.profileId, locale: l, data: { backTo: "main" } });
  await replyKb(ctx, botT(l, "hub_meal_hint"), mealHubKeyboard(l));
}

async function showMedHub(ctx: Context) {
  const auth = await requireAuth(ctx);
  if (!auth) return;
  const l = auth.locale;
  setState(ctx.chat!.id, { step: "hub:med", profileId: auth.profileId, locale: l, data: { backTo: "main" } });
  await replyKb(ctx, botT(l, "hub_med_hint"), medHubKeyboard(l));
}

async function startLabelFlow(ctx: Context) {
  const auth = await requireAuth(ctx);
  if (!auth) return;
  setState(ctx.chat!.id, { step: "meal:label", profileId: auth.profileId, locale: auth.locale, data: { mealType: "snack", backTo: "meal_hub" } });
  await replyCancel(ctx, botT(auth.locale, "meal_label_prompt"), auth.locale);
}

async function startMealFlow(ctx: Context) {
  const auth = await requireAuth(ctx);
  if (!auth) return;
  setState(ctx.chat!.id, { step: "meal:type", profileId: auth.profileId, locale: auth.locale, data: { backTo: "meal_hub" } });
  await replyKb(ctx, botT(auth.locale, "meal_type_prompt"), mealTypeReplyKb(auth.locale));
}

async function startMedFlow(ctx: Context) {
  const auth = await requireAuth(ctx);
  if (!auth) return;
  const plans = await prisma.medicationPlan.findMany({ where: { profileId: auth.profileId, active: true } });
  const listMap: Record<string, string> = {};
  const rows: string[][] = [];
  for (const plan of plans) {
    const label = `💊 ${plan.name}${plan.dosage ? ` (${plan.dosage})` : ""}`;
    listMap[label] = plan.id;
    rows.push([label]);
  }
  rows.push([botT(auth.locale, "med_custom")]);
  rows.push([botT(auth.locale, "kb_cancel")]);
  setState(ctx.chat!.id, { step: "med:choose", profileId: auth.profileId, locale: auth.locale, data: { backTo: "med_hub", listMap } });
  await replyKb(ctx, botT(auth.locale, "med_prompt"), kb(rows));
}

async function startWeightFlow(ctx: Context) {
  const auth = await requireAuth(ctx);
  if (!auth) return;
  setState(ctx.chat!.id, { step: "weight:input", profileId: auth.profileId, locale: auth.locale, data: { backTo: "main" } });
  await replyCancel(ctx, botT(auth.locale, "weight_prompt"), auth.locale);
}

async function startWorkoutFlow(ctx: Context) {
  const auth = await requireAuth(ctx);
  if (!auth) return;
  setState(ctx.chat!.id, { step: "workout:type", profileId: auth.profileId, locale: auth.locale, data: { backTo: "main" } });
  await replyKb(ctx, botT(auth.locale, "workout_type_prompt"), workoutTypeReplyKb(auth.locale));
}

async function showToday(ctx: Context) {
  const auth = await requireAuth(ctx);
  if (!auth) return;
  const today = todayStr(auth.timezone);
  const meals = await prisma.meal.findMany({ where: { profileId: auth.profileId, date: today } });
  const goal = (await prisma.profile.findUnique({ where: { id: auth.profileId } }))?.dailyCalorieGoal || 2000;
  const eaten = meals.reduce((s, m) => s + m.calories, 0);
  const l = auth.locale;
  setState(ctx.chat!.id, { step: "today:pick", profileId: auth.profileId, locale: l, data: { backTo: "main", timezone: auth.timezone, date: today } });
  const text = botT(l, "today_title") + " (" + today + ")\n"
    + botT(l, "today_calories", { eaten: Math.round(eaten), goal, remaining: Math.max(0, Math.round(goal - eaten)) })
    + "\n\n" + botT(l, "today_pick");
  await replyKb(ctx, text, todayPickKeyboard(l));
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

function buildCalendarKeyboard(year: number, month: number, locale: string, prefix: string, activeDays?: Set<string>): InlineKeyboard {
  const kb = new InlineKeyboard();
  const months = getMonths(locale);
  const wd = getWeekdays(locale);

  // month is 0-based here; store 1-based in callback for nav
  const m1 = month + 1;
  kb.text("◀️", `${prefix}nav:${year}-${m1}:-1`)
    .text(`${months[month]} ${year}`, "noop")
    .text("▶️", `${prefix}nav:${year}-${m1}:1`);
  kb.row();

  for (const d of wd) kb.text(d, "noop");
  kb.row();

  const firstDay = new Date(year, month, 1).getDay();
  const off = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let col = 0;
  for (let i = 0; i < off; i++) { kb.text(" ", "noop"); col++; }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(m1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const label = activeDays?.has(dateStr) ? `[${d}]` : String(d);
    kb.text(label, `${prefix}pick:${dateStr}`);
    col++;
    if (col === 7) { kb.row(); col = 0; }
  }
  if (col > 0) kb.row();

  return kb;
}

async function getActiveDays(profileId: string, year: number, month0: number): Promise<Set<string>> {
  const m1 = month0 + 1;
  const prefix = `${year}-${String(m1).padStart(2, "0")}`;
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const dates = Array.from({ length: daysInMonth }, (_, i) => `${prefix}-${String(i + 1).padStart(2, "0")}`);

  const [meals, intakes, workouts, weights] = await Promise.all([
    prisma.meal.findMany({ where: { profileId, date: { in: dates } }, select: { date: true } }),
    prisma.medicationIntake.findMany({ where: { profileId, date: { in: dates } }, select: { date: true } }),
    prisma.workout.findMany({ where: { profileId, date: { in: dates } }, select: { date: true } }),
    prisma.weightEntry.findMany({ where: { profileId, date: { in: dates } }, select: { date: true } }),
  ]);

  const set = new Set<string>();
  for (const r of [...meals, ...intakes, ...workouts, ...weights]) set.add(r.date);
  return set;
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

const EDIT_WINDOW_MS = 60 * 60 * 1000;

/** Entries logged within the last hour, with edit/delete buttons. Null when nothing is editable. */
async function buildRecentPanel(
  profileId: string,
  locale: string,
  timezone: string,
): Promise<{ text: string; kb: InlineKeyboard } | null> {
  const since = new Date(Date.now() - EDIT_WINDOW_MS);
  // Yesterday's date is included so late-evening entries stay editable past midnight
  const today = todayStr(timezone);
  const yesterday = new Date(`${today}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const dates = [yesterday.toISOString().slice(0, 10), today];

  const [meals, intakes, workouts] = await Promise.all([
    prisma.meal.findMany({ where: { profileId, date: { in: dates }, createdAt: { gte: since } }, orderBy: { createdAt: "asc" } }),
    prisma.medicationIntake.findMany({ where: { profileId, date: { in: dates }, createdAt: { gte: since } }, orderBy: { createdAt: "asc" } }),
    prisma.workout.findMany({ where: { profileId, date: { in: dates }, createdAt: { gte: since } }, orderBy: { createdAt: "asc" } }),
  ]);

  if (meals.length === 0 && intakes.length === 0 && workouts.length === 0) return null;

  const kb = new InlineKeyboard();
  for (const m of meals) {
    kb.text(`🍽 ${m.name} · ${Math.round(m.calories)}`, `edit:meal:${m.id}`)
      .text(botT(locale, "delete_entry"), `del:meal:${m.id}`).row();
  }
  for (const i of intakes) {
    kb.text(`💊 ${i.name} · ${i.takenTime}`, `edit:med:${i.id}`)
      .text(botT(locale, "delete_entry"), `del:med:${i.id}`).row();
  }
  for (const w of workouts) {
    kb.text(`🏋️ ${botT(locale, w.type)} · ${w.quantity}`, `edit:workout:${w.id}`)
      .text(botT(locale, "delete_entry"), `del:workout:${w.id}`).row();
  }

  return { text: botT(locale, "recent_editable"), kb };
}

async function sendRecentPanel(ctx: Context, _profileId: string, _locale: string) {
  await sendTodaySection(ctx, "meals");
}

async function sendTodaySection(ctx: Context, section: "meals" | "meds" | "workouts") {
  const auth = await requireAuth(ctx);
  if (!auth) return;
  const l = auth.locale;
  const date = todayStr(auth.timezone);
  const rows: string[][] = [];
  const editMap: Record<string, { kind: string; id: string }> = {};
  let text = botT(l, "today_title") + " (" + date + ")\n";

  if (section === "meals") {
    const meals = await prisma.meal.findMany({ where: { profileId: auth.profileId, date }, orderBy: { createdAt: "asc" } });
    const goal = (await prisma.profile.findUnique({ where: { id: auth.profileId } }))?.dailyCalorieGoal || 2000;
    const eaten = meals.reduce((s, m) => s + m.calories, 0);
    text += botT(l, "today_calories", { eaten: Math.round(eaten), goal, remaining: Math.max(0, Math.round(goal - eaten)) });
    if (meals.length === 0) text += botT(l, "today_no_meals");
    else {
      text += botT(l, "today_meals");
      meals.forEach((m, i) => {
        const n = i + 1;
        text += `\n  ${n}. ${botT(l, m.mealType)}: ${m.name} — ${Math.round(m.calories)} ккал`;
        if (m.photoPath) text += " 📷";
        if (m.createdAt.getTime() >= Date.now() - EDIT_WINDOW_MS) {
          const editLbl = `✏️ ${n}`;
          const delLbl = `🗑 ${n}`;
          editMap[editLbl] = { kind: "meal", id: m.id };
          editMap[delLbl] = { kind: "del-meal", id: m.id };
          rows.push([editLbl, delLbl]);
        }
      });
    }
    setState(ctx.chat!.id, { step: "today:meals", profileId: auth.profileId, locale: l, data: { backTo: "today", editMap, section } });
    await replyKb(ctx, text, kb([...rows, [botT(l, "kb_back")]]), false);
    for (const m of meals) {
      if (m.photoPath) {
        try { await ctx.replyWithPhoto(m.photoPath, { caption: `🍽 ${m.name} — ${Math.round(m.calories)} ккал` }); } catch {}
      }
    }
    return;
  }

  if (section === "meds") {
    const intakes = await prisma.medicationIntake.findMany({ where: { profileId: auth.profileId, date }, orderBy: { createdAt: "asc" } });
    if (intakes.length === 0) text += botT(l, "today_no_meds");
    else {
      text += botT(l, "today_meds");
      intakes.forEach((item, i) => {
        const n = i + 1;
        text += `\n  ${n}. ${item.name}${item.dosage ? ` (${item.dosage})` : ""} — ${item.takenTime}`;
        if (item.createdAt.getTime() >= Date.now() - EDIT_WINDOW_MS) {
          const editLbl = `✏️ ${n}`;
          const delLbl = `🗑 ${n}`;
          editMap[editLbl] = { kind: "med", id: item.id };
          editMap[delLbl] = { kind: "del-med", id: item.id };
          rows.push([editLbl, delLbl]);
        }
      });
    }
    setState(ctx.chat!.id, { step: "today:meds", profileId: auth.profileId, locale: l, data: { backTo: "today", editMap, section } });
    await replyKb(ctx, text, kb([...rows, [botT(l, "kb_back")]]), false);
    return;
  }

  const workouts = await prisma.workout.findMany({ where: { profileId: auth.profileId, date }, orderBy: { createdAt: "asc" } });
  if (workouts.length === 0) text += botT(l, "today_no_workouts");
  else {
    text += botT(l, "today_workouts");
    workouts.forEach((w, i) => {
      const n = i + 1;
      text += `\n  ${n}. ${botT(l, w.type)} — ${w.quantity} ${w.unit}`;
      if (w.createdAt.getTime() >= Date.now() - EDIT_WINDOW_MS) {
        const editLbl = `✏️ ${n}`;
        const delLbl = `🗑 ${n}`;
        editMap[editLbl] = { kind: "workout", id: w.id };
        editMap[delLbl] = { kind: "del-workout", id: w.id };
        rows.push([editLbl, delLbl]);
      }
    });
  }
  setState(ctx.chat!.id, { step: "today:workouts", profileId: auth.profileId, locale: l, data: { backTo: "today", editMap, section } });
  await replyKb(ctx, text, kb([...rows, [botT(l, "kb_back")]]), false);
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
}

async function showHistory(ctx: Context) {
  const auth = await requireAuth(ctx);
  if (!auth) return;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  setState(ctx.chat!.id, { step: "history:cal", profileId: auth.profileId, locale: auth.locale, data: { timezone: auth.timezone, backTo: "main" } });
  await sweepChat(ctx);
  const calKb = buildCalendarKeyboard(year, month, auth.locale, "hcal_", await getActiveDays(auth.profileId, year, month));
  const msg = await ctx.reply(botT(auth.locale, "history_pick_start"), { reply_markup: calKb });
  rememberMsg(ctx.chat!.id, msg.message_id);
}

async function showAdvice(ctx: Context) {
  const auth = await requireAuth(ctx);
  if (!auth) return;
  const l = auth.locale;
  setState(ctx.chat!.id, { step: "advice:pick", profileId: auth.profileId, locale: l, data: { backTo: "main" } });
  await replyKb(ctx, botT(l, "advice_prompt"), kb([
    [botT(l, "advice_day"), botT(l, "advice_week"), botT(l, "advice_month")],
    [botT(l, "kb_back")],
  ]));
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
  const total = await prisma.advice.count({ where: { profileId: profile.id, period } });
  const rows: string[][] = [];
  const nav: string[] = [];
  if (offset > 0) nav.push(botT(l, "advice_newer"));
  if (offset + 1 < total) nav.push(botT(l, "advice_older"));
  if (nav.length) rows.push(nav);
  rows.push([botT(l, "kb_back")]);
  setState(chatId, { step: "advice:page", profileId: profile.id, locale: l, data: { backTo: "main", advicePeriod: period, adviceOffset: offset } });
  await replyKb(ctx, text, kb(rows), false);
}

function parseTimesJson(json: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(json || "[]");
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.map((t) => normalizeClock(String(t))).filter((t): t is string => !!t))].sort();
  } catch {
    return [];
  }
}

function parseWeekdaysJson(json: string | null | undefined): number[] {
  try {
    const parsed = JSON.parse(json || "[]");
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 7))].sort((a, b) => a - b);
  } catch {
    return [];
  }
}

function normalizeClock(raw: string): string | null {
  const m = raw.trim().replace(".", ":").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Math.min(23, Math.max(0, Number(m[1])));
  const min = Math.min(59, Math.max(0, Number(m[2])));
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function parseTimesInput(text: string): string[] {
  const parts = text.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
  const times = parts.map(normalizeClock).filter((t): t is string => !!t);
  return [...new Set(times)].sort();
}

function formatRecurrence(plan: { recurrence: string; intervalDays: number; weekdaysJson: string }, locale: string): string {
  if (plan.recurrence === "interval") return botT(locale, "schedule_interval", { n: plan.intervalDays });
  if (plan.recurrence === "weekly") {
    const days = parseWeekdaysJson(plan.weekdaysJson);
    const labels = getWeekdays(locale);
    return days.length ? days.map((d) => labels[d - 1]).join(", ") : botT(locale, "schedule_weekly");
  }
  return botT(locale, "schedule_daily");
}

function recKeyboard(locale: string): InlineKeyboard {
  return new InlineKeyboard()
    .text(botT(locale, "sch_rec_daily"), "srec:daily").row()
    .text(botT(locale, "sch_rec_weekly"), "srec:weekly").row()
    .text(botT(locale, "sch_rec_interval"), "srec:interval");
}

function weekdayKeyboard(selected: number[], locale: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  const labels = getWeekdays(locale);
  for (let i = 1; i <= 7; i++) {
    const mark = selected.includes(i) ? "✓ " : "";
    kb.text(`${mark}${labels[i - 1]}`, `swd:${i}`);
    if (i === 4) kb.row();
  }
  kb.row().text(botT(locale, "sch_weekdays_done"), "swd:ok");
  return kb;
}

function mealTypeKeyboard(locale: string, prefix: string): InlineKeyboard {
  return new InlineKeyboard()
    .text(botT(locale, "breakfast"), `${prefix}breakfast`)
    .text(botT(locale, "lunch"), `${prefix}lunch`).row()
    .text(botT(locale, "dinner"), `${prefix}dinner`)
    .text(botT(locale, "snack"), `${prefix}snack`);
}

async function showSchedules(ctx: Context) {
  const auth = await requireAuth(ctx);
  if (!auth) return;
  const l = auth.locale;
  setState(ctx.chat!.id, { step: "sch:pick", profileId: auth.profileId, locale: l, data: { backTo: "main" } });
  await replyKb(ctx, `${botT(l, "schedules_title")}\n${botT(l, "sch_pick_kind")}\n\n${botT(l, "sch_notify_hint")}`, kb([
    [botT(l, "hub_meal_sched")],
    [botT(l, "hub_med_sched")],
    [botT(l, "kb_back")],
  ]));
}

async function showMealSchedules(ctx: Context) {
  const auth = await requireAuth(ctx);
  if (!auth) return;
  const l = auth.locale;
  const plans = await prisma.mealPlan.findMany({
    where: { profileId: auth.profileId },
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
  });
  const listMap: Record<string, string> = {};
  const rows: string[][] = [];
  let text = botT(l, "sch_meal_title") + "\n" + botT(l, "sch_notify_hint") + "\n";
  if (plans.length === 0) text += "\n" + botT(l, "sch_empty");
  else {
    text += "\n" + botT(l, "sch_pick");
    for (const p of plans) {
      const times = parseTimesJson(p.timesJson).join(", ") || "—";
      const rec = formatRecurrence(p, l);
      const pause = p.active ? "" : ` · ${botT(l, "sch_paused")}`;
      const label = `${p.active ? "🍽" : "⏸"} ${p.name} · ${times} [${rec}]${pause}`.slice(0, 64);
      listMap[label] = p.id;
      rows.push([label]);
    }
  }
  rows.push([botT(l, "sch_add")]);
  rows.push([botT(l, "kb_back")]);
  setState(ctx.chat!.id, { step: "sch:meal:list", profileId: auth.profileId, locale: l, data: { backTo: "meal_hub", listMap } });
  await replyKb(ctx, text, kb(rows));
}

async function showMedSchedules(ctx: Context) {
  const auth = await requireAuth(ctx);
  if (!auth) return;
  const l = auth.locale;
  const plans = await prisma.medicationPlan.findMany({
    where: { profileId: auth.profileId },
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
  });
  const listMap: Record<string, string> = {};
  const rows: string[][] = [];
  let text = botT(l, "sch_med_title") + "\n" + botT(l, "sch_notify_hint") + "\n";
  if (plans.length === 0) text += "\n" + botT(l, "sch_empty");
  else {
    text += "\n" + botT(l, "sch_pick");
    for (const p of plans) {
      const times = parseTimesJson(p.timesJson).join(", ") || "—";
      const rec = formatRecurrence(p, l);
      const pause = p.active ? "" : ` · ${botT(l, "sch_paused")}`;
      const dose = p.dosage ? ` (${p.dosage})` : "";
      const label = `${p.active ? "💊" : "⏸"} ${p.name}${dose} · ${times} [${rec}]${pause}`.slice(0, 64);
      listMap[label] = p.id;
      rows.push([label]);
    }
  }
  rows.push([botT(l, "sch_add")]);
  rows.push([botT(l, "kb_back")]);
  setState(ctx.chat!.id, { step: "sch:med:list", profileId: auth.profileId, locale: l, data: { backTo: "med_hub", listMap } });
  await replyKb(ctx, text, kb(rows));
}

async function showMealPlanCard(ctx: Context, planId: string) {
  const plan = await prisma.mealPlan.findUnique({ where: { id: planId } });
  if (!plan) return;
  const profile = await prisma.profile.findUnique({ where: { id: plan.profileId } });
  const l = profile?.preferredLocale || "ru";
  const times = parseTimesJson(plan.timesJson).join(", ") || "—";
  const status = plan.active ? botT(l, "sch_active") : botT(l, "sch_paused");
  const text = [
    `🍽 ${plan.name}`,
    botT(l, "sch_card_type", { type: botT(l, plan.mealType) }),
    botT(l, "sch_card_times", { times }),
    botT(l, "sch_card_rec", { rec: formatRecurrence(plan, l) }),
    botT(l, "sch_card_status", { status }),
  ].join("\n");
  setState(ctx.chat!.id, {
    step: "sch:meal:card",
    profileId: plan.profileId,
    locale: l,
    data: { backTo: "mslist", planId, kind: "meal", active: plan.active },
  });
  await replyKb(ctx, text, kb([
    [`✅ ${botT(l, "taken")}`],
    [botT(l, "sch_edit_name"), botT(l, "sch_edit_times")],
    [botT(l, "sch_edit_rec"), botT(l, "sch_edit_type")],
    [plan.active ? botT(l, "sch_pause") : botT(l, "sch_resume"), botT(l, "sch_delete")],
    [botT(l, "kb_back")],
  ]));
}

async function showMedPlanCard(ctx: Context, planId: string) {
  const plan = await prisma.medicationPlan.findUnique({ where: { id: planId } });
  if (!plan) return;
  const profile = await prisma.profile.findUnique({ where: { id: plan.profileId } });
  const l = profile?.preferredLocale || "ru";
  const times = parseTimesJson(plan.timesJson).join(", ") || "—";
  const status = plan.active ? botT(l, "sch_active") : botT(l, "sch_paused");
  const text = [
    `💊 ${plan.name}`,
    botT(l, "sch_card_dosage", { dosage: plan.dosage || "—" }),
    botT(l, "sch_card_times", { times }),
    botT(l, "sch_card_rec", { rec: formatRecurrence(plan, l) }),
    botT(l, "sch_card_status", { status }),
  ].join("\n");
  setState(ctx.chat!.id, {
    step: "sch:med:card",
    profileId: plan.profileId,
    locale: l,
    data: { backTo: "dslist", planId, kind: "med", active: plan.active },
  });
  await replyKb(ctx, text, kb([
    [`✅ ${botT(l, "taken")}`],
    [botT(l, "sch_edit_name"), botT(l, "sch_edit_dosage")],
    [botT(l, "sch_edit_times"), botT(l, "sch_edit_rec")],
    [plan.active ? botT(l, "sch_pause") : botT(l, "sch_resume"), botT(l, "sch_delete")],
    [botT(l, "kb_back")],
  ]));
}

async function beginScheduleAdd(ctx: Context, kind: "meal" | "med") {
  const auth = await requireAuth(ctx);
  if (!auth) return;
  const l = auth.locale;
  setState(ctx.chat!.id, { step: "sch:name", profileId: auth.profileId, locale: l, data: { kind, backTo: kind === "meal" ? "mslist" : "dslist" } });
  await replyCancel(ctx, botT(l, kind === "meal" ? "sch_name_prompt" : "sch_med_name_prompt"), l);
}

async function promptScheduleTimes(ctx: Context, st: UserState) {
  st.step = "sch:times";
  await replyCancel(ctx, botT(st.locale!, "sch_times_prompt"), st.locale!);
}

async function promptScheduleRecurrence(ctx: Context, st: UserState) {
  st.step = "sch:rec";
  await replyKb(ctx, botT(st.locale!, "sch_rec_prompt"), recReplyKb(st.locale!));
}

async function saveNewSchedule(ctx: Context, st: UserState) {
  const rec = st.data!.recurrence || "daily";
  const weekdays = rec === "weekly" ? (st.data!.weekdays as number[] || []) : [];
  const intervalDays = rec === "interval" ? Math.max(1, Number(st.data!.intervalDays) || 1) : 1;
  const profile = await prisma.profile.findUnique({ where: { id: st.profileId } });
  const today = todayStr(profile?.timezone);
  const timesJson = JSON.stringify(st.data!.times || []);
  const weekdaysJson = rec === "weekly" ? JSON.stringify([...weekdays].sort((a, b) => a - b)) : "[]";
  const kind = st.data!.kind as "meal" | "med";
  if (kind === "meal") {
    await prisma.mealPlan.create({
      data: {
        profileId: st.profileId!,
        name: st.data!.name,
        mealType: st.data!.mealType || "snack",
        timesJson,
        recurrence: rec,
        weekdaysJson,
        intervalDays,
        anchorDate: rec === "interval" ? today : null,
        active: true,
      },
    });
  } else {
    await prisma.medicationPlan.create({
      data: {
        profileId: st.profileId!,
        name: st.data!.name,
        dosage: st.data!.dosage || null,
        timesJson,
        recurrence: rec,
        weekdaysJson,
        intervalDays,
        anchorDate: rec === "interval" ? today : null,
        active: true,
      },
    });
  }
  const loc = st.locale!;
  const tz = profile?.timezone || "UTC";
  const timesLabel = (st.data!.times as string[] || []).join(", ") || "—";
  let saved = botT(loc, "sch_saved") + "\n" + botT(loc, "sch_saved_when", { tz, now: nowTime(tz), times: timesLabel });
  if (tz === "UTC") saved += "\n" + botT(loc, "tz_utc_warn");
  clearState(ctx.chat!.id);
  await replyMain(ctx, saved, loc);
  if (kind === "meal") await showMealSchedules(ctx);
  else await showMedSchedules(ctx);
}

async function afterRecurrenceChosen(ctx: Context, st: UserState, rec: string) {
  st.data!.recurrence = rec;
  if (rec === "weekly") {
    st.data!.weekdays = st.data!.weekdays || [];
    st.step = "sch:weekdays";
    await replyKb(ctx, botT(st.locale!, "sch_weekdays_prompt"), weekdayReplyKb(st.data!.weekdays, st.locale!));
    return;
  }
  if (rec === "interval") {
    st.step = "sch:interval";
    await replyCancel(ctx, botT(st.locale!, "sch_interval_prompt"), st.locale!);
    return;
  }
  if (st.data!.editId) {
    await applySchedulePatch(ctx, st, { recurrence: "daily", weekdaysJson: "[]", intervalDays: 1, anchorDate: null });
    return;
  }
  await saveNewSchedule(ctx, st);
}

async function applySchedulePatch(ctx: Context, st: UserState, data: Record<string, unknown>) {
  const kind = st.data!.kind as "meal" | "med";
  const id = st.data!.editId as string;
  if (kind === "meal") await prisma.mealPlan.update({ where: { id }, data });
  else await prisma.medicationPlan.update({ where: { id }, data });
  const loc = st.locale!;
  clearState(ctx.chat!.id);
  await replyMain(ctx, botT(loc, "sch_updated"), loc);
  if (kind === "meal") await showMealPlanCard(ctx, id);
  else await showMedPlanCard(ctx, id);
}

async function startScheduleFieldEdit(ctx: Context, kind: "meal" | "med", field: string, id: string) {
  const profile = await getProfileByChatId(ctx.chat!.id);
  if (!profile) return;
  const l = profile.preferredLocale;
  if (field === "r") {
    setState(ctx.chat!.id, { step: "sch:rec", profileId: profile.id, locale: l, data: { kind, editId: id, planId: id, backTo: kind === "meal" ? "sch_meal_card" : "sch_med_card" } });
    await replyKb(ctx, botT(l, "sch_rec_prompt"), recReplyKb(l));
    return;
  }
  if (field === "m") {
    setState(ctx.chat!.id, { step: "sch:type", profileId: profile.id, locale: l, data: { kind, editId: id, planId: id, backTo: "sch_meal_card" } });
    await replyKb(ctx, botT(l, "sch_type_prompt"), mealTypeReplyKb(l));
    return;
  }
  const step = field === "n" ? "sch_edit:name" : field === "d" ? "sch_edit:dosage" : "sch_edit:times";
  const prompt = field === "n" ? (kind === "meal" ? "sch_name_prompt" : "sch_med_name_prompt") : field === "d" ? "med_dosage_prompt" : "sch_times_prompt";
  setState(ctx.chat!.id, { step, profileId: profile.id, locale: l, data: { kind, editId: id, planId: id, backTo: kind === "meal" ? "sch_meal_card" : "sch_med_card" } });
  await replyCancel(ctx, botT(l, prompt), l);
}

async function showSettings(ctx: Context) {
  const auth = await requireAuth(ctx);
  if (!auth) return;
  const profile = await prisma.profile.findUnique({ where: { id: auth.profileId } });
  const l = auth.locale;
  const rows = [
    [botT(l, "settings_language")],
    [botT(l, "settings_profile")],
    [botT(l, "settings_timezone")],
    [botT(l, "settings_email")],
  ];
  if (!profile?.phone) rows.push([botT(l, "settings_phone")]);
  rows.push([botT(l, "settings_logout")]);
  rows.push([botT(l, "kb_back")]);
  setState(ctx.chat!.id, { step: "settings:menu", profileId: auth.profileId, locale: l, data: { backTo: "main" } });
  await replyKb(ctx, botT(l, "settings_title"), kb(rows));
}

// ─── Commands ─────────────────────────────────────────────────────────────────

bot.command("start", async (ctx) => {
  const chatId = ctx.chat.id;
  clearState(chatId);
  const profile = await getProfileByChatId(chatId);
  if (profile && !profile.botLoggedOut) {
    const l = profile.preferredLocale;
    await replyMain(ctx, botT(l, "welcome") + "\n" + botT(l, "main_menu"), l);
  } else {
    const rows: string[][] = [];
    const entries = Object.entries(LOCALES_META);
    for (let i = 0; i < entries.length; i += 3) {
      rows.push(entries.slice(i, i + 3).map(([, name]) => name));
    }
    setState(chatId, { step: "start:lang", data: {} });
    await replyKb(ctx, "🌿 Healthy Life\n\n" + botT("en", "choose_language"), kb(rows));
  }
});

bot.command("help", async (ctx) => {
  const profile = await getProfileByChatId(ctx.chat.id);
  const l = profile?.preferredLocale || "ru";
  await replyMain(ctx, botT(l, "help"), l);
});

bot.command("cancel", async (ctx) => {
  const chatId = ctx.chat.id;
  const st = getState(chatId);
  const locale = st?.locale || "ru";
  clearState(chatId);
  const profile = await getProfileByChatId(chatId);
  if (!profile || profile.botLoggedOut) {
    await showAuthGate(ctx, profile?.preferredLocale || locale);
    return;
  }
  await replyMain(ctx, botT(profile.preferredLocale, "cancelled"), profile.preferredLocale);
});

bot.command("meal", showMealHub);
bot.command("med", showMedHub);
bot.command("weight", startWeightFlow);
bot.command("workout", startWorkoutFlow);
bot.command("today", showToday);
bot.command("history", showHistory);
bot.command("advice", showAdvice);
bot.command("schedules", showSchedules);
bot.command("settings", showSettings);
bot.command("register", async (ctx) => {
  const profile = await getProfileByChatId(ctx.chat.id);
  if (profile && !profile.botLoggedOut) {
    await replyMain(ctx, botT(profile.preferredLocale, "login_success", { name: profile.name }), profile.preferredLocale);
    return;
  }
  const st = getState(ctx.chat.id);
  const locale = st?.locale || profile?.preferredLocale || "ru";
  await startRegisterFlow(ctx, locale);
});

// ─── Callback queries ─────────────────────────────────────────────────────────

bot.on("callback_query:data", async (ctx) => {
  const data = ctx.callbackQuery.data;
  const chatId = ctx.chat!.id;
  await ctx.answerCallbackQuery();

  try {
    // Language on first start
    if (data.startsWith("start_lang:")) {
      const locale = data.split(":")[1];
      await showAuthGate(ctx, locale);
      return;
    }

    if (data === "auth:email") {
      const st = getState(chatId);
      const locale = st?.locale || "ru";
      setState(chatId, { step: "auth:email", locale, data: { backTo: "auth" } });
      await promptContactOrNumber(ctx, locale, "enter_email");
      return;
    }
    if (data === "auth:phone") {
      const st = getState(chatId);
      const locale = st?.locale || "ru";
      setState(chatId, { step: "auth:phone", locale, data: { backTo: "auth" } });
      await promptContactOrNumber(ctx, locale, "enter_phone");
      return;
    }
    if (data === "auth:register" || data === "auth:register_start") {
      const st = getState(chatId);
      await startRegisterFlow(ctx, st?.locale || "ru");
      return;
    }
    if (data === "auth:register_yes") {
      const st = getState(chatId);
      if (!st) return;
      await completeRegistration(ctx, st);
      return;
    }
    if (data === "auth:register_no") {
      const st = getState(chatId);
      const locale = st?.locale || "ru";
      await showAuthGate(ctx, locale);
      return;
    }

    if (data === "mlog") { await startMealFlow(ctx); return; }
    if (data === "mlabel") { await startLabelFlow(ctx); return; }
    if (data === "mslist") { await showMealSchedules(ctx); return; }
    if (data === "msadd") { await beginScheduleAdd(ctx, "meal"); return; }
    if (data === "dlog") { await startMedFlow(ctx); return; }
    if (data === "dslist") { await showMedSchedules(ctx); return; }
    if (data === "dsadd") { await beginScheduleAdd(ctx, "med"); return; }
    if (data.startsWith("msv:")) { await showMealPlanCard(ctx, data.slice(4)); return; }
    if (data.startsWith("dsv:")) { await showMedPlanCard(ctx, data.slice(4)); return; }

    if (data.startsWith("mse:") || data.startsWith("dse:")) {
      const kind = data.startsWith("mse:") ? "meal" : "med";
      const [, field, id] = data.split(":");
      if (field && id) await startScheduleFieldEdit(ctx, kind, field, id);
      return;
    }

    if (data.startsWith("msp:") || data.startsWith("dsp:")) {
      const isMeal = data.startsWith("msp:");
      const id = data.slice(4);
      if (isMeal) {
        const plan = await prisma.mealPlan.findUnique({ where: { id } });
        if (!plan) return;
        await prisma.mealPlan.update({ where: { id }, data: { active: !plan.active } });
        const profile = await getProfileByChatId(chatId);
        const l = profile?.preferredLocale || "ru";
        await ctx.reply(botT(l, plan.active ? "sch_paused_ok" : "sch_resumed_ok", { name: plan.name }));
        await showMealPlanCard(ctx, id);
      } else {
        const plan = await prisma.medicationPlan.findUnique({ where: { id } });
        if (!plan) return;
        await prisma.medicationPlan.update({ where: { id }, data: { active: !plan.active } });
        const profile = await getProfileByChatId(chatId);
        const l = profile?.preferredLocale || "ru";
        await ctx.reply(botT(l, plan.active ? "sch_paused_ok" : "sch_resumed_ok", { name: plan.name }));
        await showMedPlanCard(ctx, id);
      }
      return;
    }

    if (data.startsWith("msd:") || data.startsWith("dsd:")) {
      const isMeal = data.startsWith("msd:");
      const id = data.slice(4);
      const plan = isMeal
        ? await prisma.mealPlan.findUnique({ where: { id } })
        : await prisma.medicationPlan.findUnique({ where: { id } });
      if (!plan) return;
      const profile = await getProfileByChatId(chatId);
      const l = profile?.preferredLocale || "ru";
      await ctx.reply(botT(l, "sch_delete_confirm", { name: plan.name }), {
        reply_markup: new InlineKeyboard()
          .text(botT(l, "yes"), `${isMeal ? "msdy" : "dsdy"}:${id}`)
          .text(botT(l, "no"), isMeal ? "mslist" : "dslist"),
      });
      return;
    }
    if (data.startsWith("msdy:") || data.startsWith("dsdy:")) {
      const isMeal = data.startsWith("msdy:");
      const id = data.split(":")[1];
      if (isMeal) await prisma.mealPlan.delete({ where: { id } }).catch(() => {});
      else await prisma.medicationPlan.delete({ where: { id } }).catch(() => {});
      const profile = await getProfileByChatId(chatId);
      const l = profile?.preferredLocale || "ru";
      await replyMain(ctx, botT(l, "sch_deleted"), l);
      if (isMeal) await showMealSchedules(ctx);
      else await showMedSchedules(ctx);
      return;
    }

    if (data.startsWith("smt:")) {
      const st = getState(chatId);
      const type = data.slice(4);
      if (st?.data?.editId && st.data.kind === "meal") {
        await applySchedulePatch(ctx, st, { mealType: type });
        return;
      }
      if (st) {
        st.data!.mealType = type;
        await promptScheduleTimes(ctx, st);
      }
      return;
    }

    if (data.startsWith("srec:")) {
      const st = getState(chatId);
      if (!st) return;
      await afterRecurrenceChosen(ctx, st, data.slice(5));
      return;
    }

    if (data.startsWith("swd:")) {
      const st = getState(chatId);
      if (!st) return;
      const token = data.slice(4);
      const selected: number[] = st.data!.weekdays || [];
      if (token === "ok") {
        if (selected.length === 0) {
          await ctx.reply(botT(st.locale!, "sch_weekdays_need"));
          return;
        }
        st.data!.weekdays = selected;
        if (st.data!.editId) {
          await applySchedulePatch(ctx, st, {
            recurrence: "weekly",
            weekdaysJson: JSON.stringify([...selected].sort((a, b) => a - b)),
            intervalDays: 1,
          });
          return;
        }
        await saveNewSchedule(ctx, st);
        return;
      }
      const day = parseInt(token, 10);
      const next = selected.includes(day) ? selected.filter((d) => d !== day) : [...selected, day].sort((a, b) => a - b);
      st.data!.weekdays = next;
      try {
        await ctx.editMessageReplyMarkup({ reply_markup: weekdayKeyboard(next, st.locale!) });
      } catch {
        await ctx.reply(botT(st.locale!, "sch_weekdays_prompt"), { reply_markup: weekdayKeyboard(next, st.locale!) });
      }
      return;
    }

    // Meal type
    if (data.startsWith("meal_type:")) {
      const st = getState(chatId);
      if (!st) return;
      const type = data.split(":")[1];
      if (type === "label") {
        st.data!.mealType = "snack";
        st.step = "meal:label";
        await replyCancel(ctx, botT(st.locale!, "meal_label_prompt"), st.locale!);
      } else {
        st.data!.mealType = type;
        st.step = "meal:input";
        await replyCancel(ctx, botT(st.locale!, "meal_input_prompt"), st.locale!);
      }
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

    // Calendar navigation: hcal_nav:2026-8:-1  (month is 1-based)
    if (data.startsWith("hcal_nav:")) {
      const st = getState(chatId);
      if (!st) return;
      const parts = data.replace("hcal_nav:", "").split(":");
      const [ym, dir] = [parts[0], parseInt(parts[1], 10)];
      const [y, m1] = ym.split("-").map(Number);
      let newMonth0 = m1 - 1 + dir; // convert to 0-based then shift
      let newYear = y;
      if (newMonth0 < 0) { newMonth0 = 11; newYear--; }
      if (newMonth0 > 11) { newMonth0 = 0; newYear++; }
      const phase = st.data?.startDate ? "history_pick_end" : "history_pick_start";
      const activeDays = await getActiveDays(st.profileId!, newYear, newMonth0);
      const kb = buildCalendarKeyboard(newYear, newMonth0, st.locale!, "hcal_", activeDays);
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

    // ── Delete entries ──
    if (data.startsWith("del:")) {
      const [, type, id] = data.split(":");
      const profile = await getProfileByChatId(chatId);
      if (!profile) return;
      const l = profile.preferredLocale;
      try {
        if (type === "meal") await prisma.meal.delete({ where: { id } });
        else if (type === "med") await prisma.medicationIntake.delete({ where: { id } });
        else if (type === "workout") await prisma.workout.delete({ where: { id } });
        // Re-render the panel so the remaining entries stay editable
        const panel = await buildRecentPanel(profile.id, l, profile.timezone);
        if (panel) {
          await ctx.editMessageText(`${botT(l, "entry_deleted")}\n${panel.text}`, { reply_markup: panel.kb });
        } else {
          await ctx.editMessageText(botT(l, "entry_deleted"));
        }
      } catch (e) {
        console.error("Delete entry error:", e);
        await ctx.reply(botT(l, "error"));
      }
      return;
    }

    // ── Edit entries ──
    if (data.startsWith("edit:")) {
      const [, type, id] = data.split(":");
      const profile = await getProfileByChatId(chatId);
      if (!profile) return;
      const l = profile.preferredLocale;
      if (type === "meal") {
        setState(chatId, { step: "edit_meal:name", profileId: profile.id, locale: l, data: { entryId: id } });
        await replyCancel(ctx, botT(l, "edit_meal_name"), l);
      } else if (type === "med") {
        setState(chatId, { step: "edit_med:name", profileId: profile.id, locale: l, data: { entryId: id } });
        await replyCancel(ctx, botT(l, "edit_med_name"), l);
      } else if (type === "workout") {
        setState(chatId, { step: "edit_workout:duration", profileId: profile.id, locale: l, data: { entryId: id } });
        await replyCancel(ctx, botT(l, "workout_duration_prompt"), l);
      }
      return;
    }

    // noop (calendar headers etc.)
    if (data === "noop") return;

    // ── Quick "taken" from schedules ──
    if (data.startsWith("taken_meal:")) {
      const planId = data.split(":")[1];
      const plan = await prisma.mealPlan.findUnique({ where: { id: planId } });
      if (!plan) return;
      const profile = await getProfileByChatId(chatId);
      if (!profile) return;
      const l = profile.preferredLocale;
      const today = todayStr(profile.timezone);
      await prisma.meal.create({
        data: {
          profileId: profile.id, date: today,
          mealType: plan.mealType, name: plan.name,
          calories: 0, protein: null, fat: null, carbs: null,
        },
      });
      try { await ctx.reply(botT(l, "taken_meal_done", { name: plan.name })); } catch {}
      return;
    }
    if (data.startsWith("taken_med:")) {
      const planId = data.split(":")[1];
      const plan = await prisma.medicationPlan.findUnique({ where: { id: planId } });
      if (!plan) return;
      const profile = await getProfileByChatId(chatId);
      if (!profile) return;
      const l = profile.preferredLocale;
      const today = todayStr(profile.timezone);
      const time = nowTime(profile.timezone);
      await prisma.medicationIntake.create({
        data: {
          profileId: profile.id, planId: plan.id,
          date: today, name: plan.name, dosage: plan.dosage || null, takenTime: time,
        },
      });
      try { await ctx.reply(botT(l, "taken_med_done", { name: plan.name, time })); } catch {}
      return;
    }

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
        await prisma.profile.update({ where: { id: profile.id }, data: { botLoggedOut: true } });
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

  if (st?.step === "auth:phone" || st?.step === "auth:reg_phone" || st?.step === "auth:email" || st?.step === "auth:reg_email") {
    try {
      const normalized = normalizePhone(phone);
      st.data!.phone = normalized;
      st.data!.email = phoneToEmail(normalized);
      const registering = st.step === "auth:reg_phone" || st.step === "auth:reg_email";
      st.step = registering ? "auth:reg_password" : st.step === "auth:email" ? "auth:email_password" : "auth:phone_password";
      await replyCancel(
        ctx,
        botT(st.locale || "ru", registering ? "enter_password_new" : "enter_password"),
        st.locale || "ru",
      );
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
  if (t.kb_meal) KB_ACTIONS[t.kb_meal] = showMealHub;
  if (t.kb_med) KB_ACTIONS[t.kb_med] = showMedHub;
  if (t.kb_weight) KB_ACTIONS[t.kb_weight] = startWeightFlow;
  if (t.kb_workout) KB_ACTIONS[t.kb_workout] = startWorkoutFlow;
  if (t.kb_today) KB_ACTIONS[t.kb_today] = showToday;
  if (t.kb_settings) KB_ACTIONS[t.kb_settings] = showSettings;
  if (t.kb_history) KB_ACTIONS[t.kb_history] = showHistory;
  if (t.kb_advice) KB_ACTIONS[t.kb_advice] = showAdvice;
  if (t.kb_cancel) KB_ACTIONS[t.kb_cancel] = async (ctx) => {
    const chatId = ctx.chat!.id;
    const st = getState(chatId);
    const locale = st?.locale || "ru";
    clearState(chatId);
    const profile = await getProfileByChatId(chatId);
    if (!profile || profile.botLoggedOut) {
      await showAuthGate(ctx, profile?.preferredLocale || locale);
      return;
    }
    await replyMain(ctx, botT(profile.preferredLocale, "cancelled"), profile.preferredLocale);
  };
  if (t.kb_back) KB_ACTIONS[t.kb_back] = goBack;
  if (t.hub_meal_log) KB_ACTIONS[t.hub_meal_log] = startMealFlow;
  if (t.hub_meal_label) KB_ACTIONS[t.hub_meal_label] = startLabelFlow;
  if (t.hub_meal_sched) KB_ACTIONS[t.hub_meal_sched] = showMealSchedules;
  if (t.hub_med_log) KB_ACTIONS[t.hub_med_log] = startMedFlow;
  if (t.hub_med_sched) KB_ACTIONS[t.hub_med_sched] = showMedSchedules;
  if (t.kb_sec_meals) KB_ACTIONS[t.kb_sec_meals] = (ctx) => sendTodaySection(ctx, "meals");
  if (t.kb_sec_meds) KB_ACTIONS[t.kb_sec_meds] = (ctx) => sendTodaySection(ctx, "meds");
  if (t.kb_sec_workouts) KB_ACTIONS[t.kb_sec_workouts] = (ctx) => sendTodaySection(ctx, "workouts");
}

async function markMealTaken(ctx: Context, planId: string) {
  const plan = await prisma.mealPlan.findUnique({ where: { id: planId } });
  if (!plan) return;
  const profile = await prisma.profile.findUnique({ where: { id: plan.profileId } });
  const l = profile?.preferredLocale || "ru";
  await prisma.meal.create({
    data: { profileId: plan.profileId, date: todayStr(profile?.timezone), mealType: plan.mealType, name: plan.name, calories: 0 },
  });
  await ctx.reply(botT(l, "taken_meal_done", { name: plan.name }));
  await showMealPlanCard(ctx, planId);
}

async function markMedTaken(ctx: Context, planId: string) {
  const plan = await prisma.medicationPlan.findUnique({ where: { id: planId } });
  if (!plan) return;
  const profile = await prisma.profile.findUnique({ where: { id: plan.profileId } });
  const l = profile?.preferredLocale || "ru";
  const time = nowTime(profile?.timezone);
  await prisma.medicationIntake.create({
    data: { profileId: plan.profileId, planId: plan.id, date: todayStr(profile?.timezone), name: plan.name, dosage: plan.dosage || null, takenTime: time },
  });
  await ctx.reply(botT(l, "taken_med_done", { name: plan.name, time }));
  await showMedPlanCard(ctx, planId);
}

async function handleScreen(ctx: Context, text: string, st: UserState): Promise<boolean> {
  const l = st.locale || "ru";
  const chatId = ctx.chat!.id;

  if (st.step === "start:lang") {
    const code = Object.entries(LOCALES_META).find(([, n]) => n === text)?.[0];
    if (!code) return false;
    setState(chatId, { step: "awaiting_auth", locale: code, data: {} });
    await showAuthGate(ctx, code);
    return true;
  }

  if (st.step === "awaiting_auth") {
    if (text === botT(l, "login_email")) {
      setState(chatId, { step: "auth:email", locale: l, data: { backTo: "auth" } });
      await promptContactOrNumber(ctx, l, "enter_email");
      return true;
    }
    if (text === botT(l, "login_phone")) {
      setState(chatId, { step: "auth:phone", locale: l, data: { backTo: "auth" } });
      await promptContactOrNumber(ctx, l, "enter_phone");
      return true;
    }
    if (text === botT(l, "register")) {
      await startRegisterFlow(ctx, l);
      return true;
    }
  }

  if (st.step === "auth:reg_method") {
    if (text === botT(l, "register_email")) {
      st.step = "auth:reg_email";
      st.data = { ...(st.data || {}), backTo: "auth" };
      await promptContactOrNumber(ctx, l, "enter_email");
      return true;
    }
    if (text === botT(l, "register_phone")) {
      st.step = "auth:reg_phone";
      st.data = { ...(st.data || {}), backTo: "auth" };
      await promptContactOrNumber(ctx, l, "enter_phone");
      return true;
    }
  }

  if (st.step === "meal:type") {
    if (text === botT(l, "label")) { await startLabelFlow(ctx); return true; }
    for (const type of ["breakfast", "lunch", "dinner", "snack"]) {
      if (text === botT(l, type)) {
        st.data!.mealType = type;
        st.step = "meal:input";
        await replyCancel(ctx, botT(l, "meal_input_prompt"), l);
        return true;
      }
    }
  }

  if (st.step === "meal:photo_confirm") {
    if (text === botT(l, "confirm") && st.data?.aiResult) {
      const { aiResult, mealType, photoPath } = st.data;
      const profile = await prisma.profile.findUnique({ where: { id: st.profileId } });
      await prisma.meal.create({
        data: {
          profileId: st.profileId!, date: todayStr(profile?.timezone), mealType: mealType || "snack",
          name: aiResult.name, calories: aiResult.calories, protein: aiResult.protein, carbs: aiResult.carbs, fat: aiResult.fat,
          aiDetectedName: aiResult.name, aiCalories: aiResult.calories, photoPath: photoPath || null,
        },
      });
      clearState(chatId);
      await replyMain(ctx, botT(l, "meal_saved", { name: aiResult.name, cal: Math.round(aiResult.calories) }), l);
      return true;
    }
    if (text === botT(l, "edit")) {
      st.step = "meal:text_name";
      st.data!.aiResult = undefined;
      await replyCancel(ctx, botT(l, "meal_input_prompt"), l);
      return true;
    }
  }

  if (st.step === "med:photo_confirm" || st.step === "sch:photo_confirm") {
    if (text === botT(l, "confirm")) {
      const suggested = String(st.data?.dosage || "");
      st.step = st.step === "sch:photo_confirm" ? "sch:dosage" : "med:dosage";
      await replyCancel(
        ctx,
        suggested ? botT(l, "med_dosage_keep", { dosage: suggested }) : botT(l, "med_dosage_prompt"),
        l,
      );
      return true;
    }
    if (text === botT(l, "edit")) {
      const isSch = st.step === "sch:photo_confirm";
      st.step = isSch ? "sch:name" : "med:name";
      await replyCancel(ctx, botT(l, isSch ? "sch_med_name_prompt" : "med_name_prompt"), l);
      return true;
    }
  }

  if (st.step === "med:choose") {
    if (text === botT(l, "med_custom")) {
      st.step = "med:name";
      await replyCancel(ctx, botT(l, "med_name_prompt"), l);
      return true;
    }
    const planId = st.data?.listMap?.[text];
    if (planId) {
      const plan = await prisma.medicationPlan.findUnique({ where: { id: planId } });
      if (!plan) return true;
      st.data!.planId = plan.id;
      st.data!.name = plan.name;
      st.data!.dosage = plan.dosage || "";
      st.step = "med:time";
      await replyCancel(ctx, botT(l, "med_time_prompt"), l);
      return true;
    }
  }

  if (st.step === "workout:type") {
    for (const type of ["running", "walking", "cycling", "strength", "yoga", "swimming", "hiit", "sports", "other"]) {
      if (text === botT(l, type)) {
        st.data!.type = type;
        st.step = "workout:duration";
        await replyCancel(ctx, botT(l, "workout_duration_prompt"), l);
        return true;
      }
    }
  }

  if (st.step?.startsWith("today:")) {
    const item = st.data?.editMap?.[text];
    if (item) {
      if (item.kind.startsWith("del-")) {
        const type = item.kind.slice(4);
        if (type === "meal") await prisma.meal.delete({ where: { id: item.id } }).catch(() => {});
        else if (type === "med") await prisma.medicationIntake.delete({ where: { id: item.id } }).catch(() => {});
        else if (type === "workout") await prisma.workout.delete({ where: { id: item.id } }).catch(() => {});
        await sendTodaySection(ctx, (st.data?.section || "meals") as "meals" | "meds" | "workouts");
        return true;
      }
      if (item.kind === "meal") {
        setState(chatId, { step: "edit_meal:name", profileId: st.profileId, locale: l, data: { entryId: item.id, backTo: "today" } });
        await replyCancel(ctx, botT(l, "edit_meal_name"), l);
        return true;
      }
      if (item.kind === "med") {
        setState(chatId, { step: "edit_med:name", profileId: st.profileId, locale: l, data: { entryId: item.id, backTo: "today" } });
        await replyCancel(ctx, botT(l, "edit_med_name"), l);
        return true;
      }
      if (item.kind === "workout") {
        setState(chatId, { step: "edit_workout:duration", profileId: st.profileId, locale: l, data: { entryId: item.id, backTo: "today" } });
        await replyCancel(ctx, botT(l, "workout_duration_prompt"), l);
        return true;
      }
    }
  }

  if (st.step === "advice:pick" || st.step === "advice:page") {
    if (text === botT(l, "advice_day")) { await sendAdvicePage(ctx, chatId, "day", 0); return true; }
    if (text === botT(l, "advice_week")) { await sendAdvicePage(ctx, chatId, "week", 0); return true; }
    if (text === botT(l, "advice_month")) { await sendAdvicePage(ctx, chatId, "month", 0); return true; }
    if (st.step === "advice:page") {
      const period = st.data?.advicePeriod || "day";
      const offset = st.data?.adviceOffset || 0;
      if (text === botT(l, "advice_newer")) { await sendAdvicePage(ctx, chatId, period, Math.max(0, offset - 1)); return true; }
      if (text === botT(l, "advice_older")) { await sendAdvicePage(ctx, chatId, period, offset + 1); return true; }
    }
  }

  if (st.step === "settings:menu") {
    if (text === botT(l, "settings_language")) {
      const rows: string[][] = [];
      const entries = Object.entries(LOCALES_META);
      for (let i = 0; i < entries.length; i += 3) rows.push(entries.slice(i, i + 3).map(([, n]) => n));
      rows.push([botT(l, "kb_back")]);
      setState(chatId, { step: "settings:language", profileId: st.profileId, locale: l, data: { backTo: "settings" } });
      await replyKb(ctx, botT(l, "language_prompt"), kb(rows));
      return true;
    }
    if (text === botT(l, "settings_profile")) {
      const profile = await getProfileByChatId(chatId);
      if (!profile) return true;
      const info = botT(l, "profile_info", {
        name: profile.name, goal: profile.dailyCalorieGoal,
        target: profile.targetWeightKg ? `${profile.targetWeightKg}` : "—",
        height: profile.heightCm ? `${profile.heightCm}` : "—",
      });
      setState(chatId, { step: "settings:profile_view", profileId: profile.id, locale: l, data: { backTo: "settings" } });
      await replyKb(ctx, info, kb([[botT(l, "profile_edit")], [botT(l, "kb_back")]]));
      return true;
    }
    if (text === botT(l, "settings_email")) {
      const profile = await getProfileByChatId(chatId);
      if (!profile?.userId) return true;
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(profile.userId);
      await replyKb(ctx, botT(l, "email_info", { email: userData?.user?.email || "—" }), kb([[botT(l, "kb_back")]]));
      return true;
    }
    if (text === botT(l, "settings_phone")) {
      setState(chatId, { step: "settings:phone", profileId: st.profileId, locale: l, data: { backTo: "settings" } });
      await promptContactOrNumber(ctx, l, "enter_phone");
      return true;
    }
    if (text === botT(l, "settings_timezone")) {
      setState(chatId, { step: "settings:timezone", profileId: st.profileId, locale: l, data: { backTo: "settings" } });
      await replyCancel(ctx, botT(l, "timezone_prompt"), l);
      return true;
    }
    if (text === botT(l, "settings_logout")) {
      setState(chatId, { step: "confirm:logout", profileId: st.profileId, locale: l, data: { backTo: "settings" } });
      await replyKb(ctx, botT(l, "logout_confirm"), yesNoKeyboard(l));
      return true;
    }
  }

  if (st.step === "settings:language") {
    const code = Object.entries(LOCALES_META).find(([, n]) => n === text)?.[0];
    if (!code) return false;
    if (st.profileId) await prisma.profile.update({ where: { id: st.profileId }, data: { preferredLocale: code } });
    await replyMain(ctx, botT(code, "language_saved", { lang: LOCALES_META[code] }), code);
    return true;
  }

  if (st.step === "settings:profile_view" && text === botT(l, "profile_edit")) {
    setState(chatId, { step: "settings:name", profileId: st.profileId, locale: l, data: { backTo: "settings" } });
    await replyCancel(ctx, botT(l, "profile_name_prompt"), l);
    return true;
  }

  if (st.step === "confirm:logout") {
    if (text === botT(l, "yes")) {
      if (st.profileId) await prisma.profile.update({ where: { id: st.profileId }, data: { botLoggedOut: true } });
      clearState(chatId);
      await sweepChat(ctx);
      await ctx.reply(botT(l, "logout_done"), { reply_markup: { remove_keyboard: true } });
      return true;
    }
    if (text === botT(l, "no")) { await showSettings(ctx); return true; }
  }

  if (st.step === "sch:meal:list") {
    if (text === botT(l, "sch_add")) { await beginScheduleAdd(ctx, "meal"); return true; }
    const id = st.data?.listMap?.[text];
    if (id) { await showMealPlanCard(ctx, id); return true; }
  }
  if (st.step === "sch:med:list") {
    if (text === botT(l, "sch_add")) { await beginScheduleAdd(ctx, "med"); return true; }
    const id = st.data?.listMap?.[text];
    if (id) { await showMedPlanCard(ctx, id); return true; }
  }

  if (st.step === "sch:meal:card" || st.step === "sch:med:card") {
    const kind = st.step === "sch:meal:card" ? "meal" : "med";
    const planId = st.data?.planId as string;
    if (!planId) return false;
    if (text === `✅ ${botT(l, "taken")}`) {
      if (kind === "meal") await markMealTaken(ctx, planId);
      else await markMedTaken(ctx, planId);
      return true;
    }
    if (text === botT(l, "sch_edit_name")) { await startScheduleFieldEdit(ctx, kind, "n", planId); return true; }
    if (text === botT(l, "sch_edit_times")) { await startScheduleFieldEdit(ctx, kind, "t", planId); return true; }
    if (text === botT(l, "sch_edit_rec")) { await startScheduleFieldEdit(ctx, kind, "r", planId); return true; }
    if (text === botT(l, "sch_edit_type")) { await startScheduleFieldEdit(ctx, kind, "m", planId); return true; }
    if (text === botT(l, "sch_edit_dosage")) { await startScheduleFieldEdit(ctx, kind, "d", planId); return true; }
    if (text === botT(l, "sch_pause") || text === botT(l, "sch_resume")) {
      if (kind === "meal") {
        const plan = await prisma.mealPlan.findUnique({ where: { id: planId } });
        if (plan) {
          await prisma.mealPlan.update({ where: { id: planId }, data: { active: !plan.active } });
          await showMealPlanCard(ctx, planId);
        }
      } else {
        const plan = await prisma.medicationPlan.findUnique({ where: { id: planId } });
        if (plan) {
          await prisma.medicationPlan.update({ where: { id: planId }, data: { active: !plan.active } });
          await showMedPlanCard(ctx, planId);
        }
      }
      return true;
    }
    if (text === botT(l, "sch_delete")) {
      setState(chatId, { step: "confirm:sch_del", profileId: st.profileId, locale: l, data: { kind, planId, backTo: kind === "meal" ? "mslist" : "dslist" } });
      await replyKb(ctx, botT(l, "sch_delete_confirm", { name: "—" }), yesNoKeyboard(l));
      return true;
    }
  }

  if (st.step === "confirm:sch_del") {
    if (text === botT(l, "yes")) {
      const id = st.data?.planId;
      if (st.data?.kind === "meal") await prisma.mealPlan.delete({ where: { id } }).catch(() => {});
      else await prisma.medicationPlan.delete({ where: { id } }).catch(() => {});
      await replyMain(ctx, botT(l, "sch_deleted"), l);
      if (st.data?.kind === "meal") await showMealSchedules(ctx);
      else await showMedSchedules(ctx);
      return true;
    }
    if (text === botT(l, "no")) {
      if (st.data?.kind === "meal") await showMealSchedules(ctx);
      else await showMedSchedules(ctx);
      return true;
    }
  }

  if (st.step === "sch:rec") {
    if (text === botT(l, "sch_rec_daily")) { await afterRecurrenceChosen(ctx, st, "daily"); return true; }
    if (text === botT(l, "sch_rec_weekly")) { await afterRecurrenceChosen(ctx, st, "weekly"); return true; }
    if (text === botT(l, "sch_rec_interval")) { await afterRecurrenceChosen(ctx, st, "interval"); return true; }
  }

  if (st.step === "sch:weekdays") {
    if (text === botT(l, "sch_weekdays_done")) {
      const selected: number[] = st.data!.weekdays || [];
      if (selected.length === 0) { await ctx.reply(botT(l, "sch_weekdays_need")); return true; }
      st.data!.weekdays = selected;
      if (st.data!.editId) {
        await applySchedulePatch(ctx, st, { recurrence: "weekly", weekdaysJson: JSON.stringify([...selected].sort((a, b) => a - b)), intervalDays: 1 });
        return true;
      }
      await saveNewSchedule(ctx, st);
      return true;
    }
    const raw = text.replace(/^✓\s*/, "");
    const idx = getWeekdays(l).indexOf(raw);
    if (idx >= 0) {
      const day = idx + 1;
      const selected: number[] = st.data!.weekdays || [];
      st.data!.weekdays = selected.includes(day) ? selected.filter((d) => d !== day) : [...selected, day].sort((a, b) => a - b);
      await replyKb(ctx, botT(l, "sch_weekdays_prompt"), weekdayReplyKb(st.data!.weekdays, l));
      return true;
    }
  }

  if (st.step === "sch:type" || (st.step === "sch:name" && false)) {
    /* handled below */
  }
  if (st.step === "sch:type") {
    for (const type of ["breakfast", "lunch", "dinner", "snack"]) {
      if (text === botT(l, type)) {
        if (st.data?.editId && st.data.kind === "meal") {
          await applySchedulePatch(ctx, st, { mealType: type });
          return true;
        }
        st.data!.mealType = type;
        await promptScheduleTimes(ctx, st);
        return true;
      }
    }
  }

  if (st.step === "auth:email_password" || st.step === "auth:phone_password" || st.step === "auth:reg_password" || st.step === "auth:reg_password2") {
    if (text === botT(l, "register_yes") || text === botT(l, "register_no")) return false;
  }

  if (st.step === "auth:register") {
    if (text === botT(l, "register_yes")) {
      await completeRegistration(ctx, st);
      return true;
    }
    if (text === botT(l, "register_no")) {
      await showAuthGate(ctx, l);
      return true;
    }
  }

  return false;
}

// ─── Text handler ─────────────────────────────────────────────────────────────

bot.on("message:text", async (ctx) => {
  const chatId = ctx.chat.id;
  const text = ctx.message.text.trim();

  const st = getState(chatId);
  if (st && await handleScreen(ctx, text, st)) return;

  const action = KB_ACTIONS[text];
  if (action) return action(ctx);

  if (!st) return;

  try {
    // ── Auth flows ──
    if (st.step === "auth:email") {
      const parsed = parseLoginId(text);
      if (!parsed) {
        await ctx.reply(`${botT(st.locale || "ru", "email_invalid")}\n\n${botT(st.locale || "ru", "phone_invalid")}`);
        return;
      }
      st.data!.email = parsed.email;
      if (parsed.phone) st.data!.phone = parsed.phone;
      st.step = "auth:email_password";
      await replyCancel(ctx, botT(st.locale || "ru", "enter_password"), st.locale || "ru");
      return;
    }
    if (st.step === "auth:email_password") {
      const locale = st.locale || "ru";
      const phone = st.data!.phone ? String(st.data!.phone) : undefined;
      st.data!.password = text;
      const candidates = phone ? phoneAuthEmailCandidates(phone) : [String(st.data!.email || "")];
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
        st.step = "auth:register";
        await replyKb(ctx, botT(locale, "login_failed") + "\n\n" + botT(locale, "register_offer"), kb([
          [botT(locale, "register_yes")],
          [botT(locale, "register_no")],
        ]));
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
        st.step = "auth:register";
        await replyKb(ctx, botT(locale, "login_failed") + "\n\n" + botT(locale, "register_offer"), kb([
          [botT(locale, "register_yes")],
          [botT(locale, "register_no")],
        ]));
      }
      return;
    }
    if (st.step === "auth:reg_email") {
      const parsed = parseLoginId(text);
      if (!parsed) {
        await ctx.reply(`${botT(st.locale || "ru", "email_invalid")}\n\n${botT(st.locale || "ru", "phone_invalid")}`);
        return;
      }
      st.data!.email = parsed.email;
      if (parsed.phone) st.data!.phone = parsed.phone;
      st.step = "auth:reg_password";
      await replyCancel(ctx, botT(st.locale || "ru", "enter_password_new"), st.locale || "ru");
      return;
    }
    if (st.step === "auth:reg_phone") {
      try {
        const normalized = normalizePhone(text);
        st.data!.phone = normalized;
        st.data!.email = phoneToEmail(normalized);
        st.step = "auth:reg_password";
        await replyCancel(ctx, botT(st.locale || "ru", "enter_password_new"), st.locale || "ru");
      } catch {
        await ctx.reply(botT(st.locale || "ru", "phone_invalid"));
      }
      return;
    }
    if (st.step === "auth:reg_password") {
      if (text.length < 6) {
        await ctx.reply(botT(st.locale || "ru", "password_too_short"));
        return;
      }
      st.data!.password = text;
      st.step = "auth:reg_password2";
      await replyCancel(ctx, botT(st.locale || "ru", "enter_password_confirm"), st.locale || "ru");
      return;
    }
    if (st.step === "auth:reg_password2") {
      if (text !== st.data!.password) {
        st.step = "auth:reg_password";
        await replyCancel(
          ctx,
          botT(st.locale || "ru", "passwords_mismatch") + "\n" + botT(st.locale || "ru", "enter_password_new"),
          st.locale || "ru",
        );
        return;
      }
      await completeRegistration(ctx, st);
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

    // ── Edit meal ──
    if (st.step === "edit_meal:name") {
      if (text !== "/skip") st.data!.newName = text;
      st.step = "edit_meal:cal";
      await replyCancel(ctx, botT(st.locale!, "edit_meal_cal"), st.locale!);
      return;
    }
    if (st.step === "edit_meal:cal") {
      if (text !== "/skip") {
        const cal = parseFloat(text);
        if (!isNaN(cal) && cal > 0) st.data!.newCal = cal;
      }
      st.step = "edit_meal:macros";
      await replyCancel(ctx, botT(st.locale!, "edit_meal_macros"), st.locale!);
      return;
    }
    if (st.step === "edit_meal:macros") {
      const upd: any = {};
      if (st.data!.newName) upd.name = st.data!.newName;
      if (st.data!.newCal) upd.calories = st.data!.newCal;
      if (text !== "/skip") {
        const parts = text.split(/[\s,/]+/).map(Number);
        if (parts.length >= 3 && parts.every(n => !isNaN(n))) {
          [upd.protein, upd.fat, upd.carbs] = parts;
        }
      }
      if (Object.keys(upd).length > 0) {
        await prisma.meal.update({ where: { id: st.data!.entryId }, data: upd });
      }
      const pid = st.profileId!, loc = st.locale!;
      clearState(chatId);
      await replyMain(ctx, botT(loc, "entry_updated"), loc);
      await sendRecentPanel(ctx, pid, loc);
      return;
    }

    // ── Edit med ──
    if (st.step === "edit_med:name") {
      if (text !== "/skip") st.data!.newName = text;
      st.step = "edit_med:dosage";
      await replyCancel(ctx, botT(st.locale!, "edit_med_dosage"), st.locale!);
      return;
    }
    if (st.step === "edit_med:dosage") {
      if (text !== "/skip") st.data!.newDosage = text;
      st.step = "edit_med:time";
      await replyCancel(ctx, botT(st.locale!, "edit_med_time"), st.locale!);
      return;
    }
    if (st.step === "edit_med:time") {
      const upd: any = {};
      if (st.data!.newName) upd.name = st.data!.newName;
      if (st.data!.newDosage) upd.dosage = st.data!.newDosage;
      if (text !== "/skip") upd.takenTime = text.replace(".", ":");
      if (Object.keys(upd).length > 0) {
        await prisma.medicationIntake.update({ where: { id: st.data!.entryId }, data: upd });
      }
      const pid = st.profileId!, loc = st.locale!;
      clearState(chatId);
      await replyMain(ctx, botT(loc, "entry_updated"), loc);
      await sendRecentPanel(ctx, pid, loc);
      return;
    }

    // ── Edit workout ──
    if (st.step === "edit_workout:duration") {
      const upd: any = {};
      if (text !== "/skip") {
        const dur = parseFloat(text);
        if (!isNaN(dur) && dur > 0) upd.quantity = dur;
      }
      if (Object.keys(upd).length > 0) {
        await prisma.workout.update({ where: { id: st.data!.entryId }, data: upd });
      }
      const pid = st.profileId!, loc = st.locale!;
      clearState(chatId);
      await replyMain(ctx, botT(loc, "entry_updated"), loc);
      await sendRecentPanel(ctx, pid, loc);
      return;
    }

    // ── Label weight ──
    if (st.step === "meal:label_weight") {
      const grams = parseFloat(text.replace(",", "."));
      if (isNaN(grams) || grams <= 0) { await ctx.reply(botT(st.locale!, "meal_label_result", { cal: 0, p: 0, f: 0, c: 0 })); return; }
      const lbl = st.data!.labelPer100;
      const factor = grams / 100;
      const profile = await prisma.profile.findUnique({ where: { id: st.profileId } });
      await prisma.meal.create({
        data: {
          profileId: st.profileId!, date: todayStr(profile?.timezone),
          mealType: st.data!.mealType || "snack", name: st.data!.name,
          calories: Math.round(lbl.calories * factor),
          protein: Math.round((lbl.protein || 0) * factor),
          fat: Math.round((lbl.fat || 0) * factor),
          carbs: Math.round((lbl.carbs || 0) * factor),
          photoPath: st.data!.photoPath || null,
        },
      });
      const cal = Math.round(lbl.calories * factor);
      clearState(chatId);
      await replyMain(ctx, botT(st.locale!, "meal_saved", { name: st.data!.name, cal }), st.locale!);
      return;
    }

    // ── Schedule create / edit ──
    if (st.step === "sch:name") {
      st.data!.name = text;
      if (st.data!.kind === "meal") {
        st.step = "sch:type";
        await replyKb(ctx, botT(st.locale!, "sch_type_prompt"), mealTypeReplyKb(st.locale!));
      } else {
        st.step = "sch:dosage";
        await replyCancel(ctx, botT(st.locale!, "med_dosage_prompt"), st.locale!);
      }
      return;
    }
    if (st.step === "sch:dosage") {
      if (text !== "/skip") st.data!.dosage = text;
      await promptScheduleTimes(ctx, st);
      return;
    }
    if (st.step === "sch:times") {
      const times = parseTimesInput(text);
      if (times.length === 0) {
        await ctx.reply(botT(st.locale!, "sch_times_invalid"));
        return;
      }
      st.data!.times = times;
      await promptScheduleRecurrence(ctx, st);
      return;
    }
    if (st.step === "sch:interval") {
      const n = parseInt(text, 10);
      if (!Number.isInteger(n) || n < 1) {
        await ctx.reply(botT(st.locale!, "sch_interval_invalid"));
        return;
      }
      st.data!.intervalDays = n;
      if (st.data!.editId) {
        const profile = await prisma.profile.findUnique({ where: { id: st.profileId } });
        await applySchedulePatch(ctx, st, {
          recurrence: "interval",
          intervalDays: n,
          weekdaysJson: "[]",
          anchorDate: todayStr(profile?.timezone),
        });
        return;
      }
      await saveNewSchedule(ctx, st);
      return;
    }
    if (st.step === "sch_edit:name") {
      await applySchedulePatch(ctx, st, { name: text });
      return;
    }
    if (st.step === "sch_edit:dosage") {
      await applySchedulePatch(ctx, st, { dosage: text === "/skip" ? null : text });
      return;
    }
    if (st.step === "sch_edit:times") {
      const times = parseTimesInput(text);
      if (times.length === 0) {
        await ctx.reply(botT(st.locale!, "sch_times_invalid"));
        return;
      }
      await applySchedulePatch(ctx, st, { timesJson: JSON.stringify(times) });
      return;
    }

    // ── Med flow ──
    if (st.step === "med:name") {
      st.data!.name = text; st.step = "med:dosage";
      await replyCancel(ctx, botT(st.locale!, "med_dosage_prompt"), st.locale!);
      return;
    }
    if (st.step === "med:dosage") {
      if (text !== "/skip") st.data!.dosage = text;
      st.step = "med:time";
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

  // ── Medication photo (during med:name step) ──
  if (st?.step === "med:name") {
    try {
      const analyzing = await ctx.reply(botT(st.locale!, "med_photo_analyzing"));
      rememberMsg(ctx.chat.id, analyzing.message_id);
      const { buffer, base64 } = await downloadTelegramPhoto(ctx);
      try { await uploadPhotoToStorage(buffer, "medications"); } catch {}
      const aiLang = AI_LANGUAGE[st.locale!] || AI_LANGUAGE.en;
      const result = await visionJson(
        base64,
        `You are a pharmacist assistant. Identify the medication from the photo of its packaging. Answer ONLY with valid JSON, no markdown: {"name": string, "dosage": string}. Write name and dosage in ${aiLang}. If unreadable, return name="—" and dosage="".`,
        "What medication is this? Read the name and dosage from the pack.",
      );
      st.data!.name = result.name;
      st.data!.dosage = result.dosage || "";
      st.step = "med:photo_confirm";
      await replyKb(
        ctx,
        botT(st.locale!, "med_photo_result", { name: result.name, dosage: result.dosage || "—" }),
        confirmEditKeyboard(st.locale!),
      );
    } catch (e: any) {
      console.error("Med photo error:", e);
      await replyCancel(ctx, `${botT(st.locale!, "error")}\n${aiErrorDetail(e)}\n\n${botT(st.locale!, "med_name_prompt")}`, st.locale!);
    }
    return;
  }

  // ── Medication pack photo while adding a schedule ──
  if (st?.step === "sch:name" && st.data?.kind === "med") {
    try {
      const analyzing = await ctx.reply(botT(st.locale!, "med_photo_analyzing"));
      rememberMsg(ctx.chat.id, analyzing.message_id);
      const { buffer, base64 } = await downloadTelegramPhoto(ctx);
      try { await uploadPhotoToStorage(buffer, "medications"); } catch {}
      const aiLang = AI_LANGUAGE[st.locale!] || AI_LANGUAGE.en;
      const result = await visionJson(
        base64,
        `You are a pharmacist assistant. Identify the medication from the photo of its packaging. Answer ONLY with valid JSON, no markdown: {"name": string, "dosage": string}. Write name and dosage in ${aiLang}. If unreadable, return name="—" and dosage="".`,
        "What medication is this? Read the name and dosage from the pack.",
      );
      st.data!.name = result.name;
      st.data!.dosage = result.dosage || "";
      st.step = "sch:photo_confirm";
      await replyKb(
        ctx,
        botT(st.locale!, "med_photo_result", { name: result.name, dosage: result.dosage || "—" }),
        confirmEditKeyboard(st.locale!),
      );
    } catch (e: any) {
      console.error("Schedule med photo error:", e);
      await replyCancel(ctx, `${botT(st.locale!, "error")}\n${aiErrorDetail(e)}\n\n${botT(st.locale!, "sch_med_name_prompt")}`, st.locale!);
    }
    return;
  }

  // ── Nutrition label photo ──
  if (st?.step === "meal:label") {
    try {
      const analyzing = await ctx.reply(botT(st.locale!, "meal_photo_analyzing"));
      rememberMsg(ctx.chat.id, analyzing.message_id);
      const { buffer, base64 } = await downloadTelegramPhoto(ctx);
      let photoPath: string | null = null;
      try { photoPath = await uploadPhotoToStorage(buffer, "meals"); } catch {}
      st.data!.photoPath = photoPath;
      const aiLang = AI_LANGUAGE[st.locale!] || AI_LANGUAGE.en;
      const result = await visionJson(
        base64,
        `You read nutrition labels on food packaging. Extract the values PER 100 g (or per 100 ml). Answer ONLY with valid JSON, no markdown: {"name": string, "calories": number, "protein": number, "fat": number, "carbs": number}. Write name in ${aiLang}. If a value is missing, use 0.`,
        "Read the nutrition facts from this label.",
      );
      st.data!.labelPer100 = result;
      st.data!.name = result.name || "—";
      st.step = "meal:label_weight";
      await replyCancel(ctx, botT(st.locale!, "meal_label_result", {
        cal: Math.round(result.calories), p: Math.round(result.protein || 0),
        f: Math.round(result.fat || 0), c: Math.round(result.carbs || 0),
      }), st.locale!);
    } catch (e: any) {
      console.error("Label photo error:", e);
      // Stay in label flow: asking for a food photo here confused users
      await replyCancel(ctx, `${botT(st.locale!, "error")}\n${aiErrorDetail(e)}\n\n${botT(st.locale!, "meal_label_prompt")}`, st.locale!);
    }
    return;
  }

  // ── Food photo (default) ──
  if (!st || (st.step !== "meal:input" && st.step !== "meal:text_name")) {
    const auth = await requireAuth(ctx);
    if (!auth) return;
    setState(chatId, { step: "meal:input", profileId: auth.profileId, locale: auth.locale, data: { mealType: "snack" } });
    st = getState(chatId)!;
  }

  try {
    const analyzing = await ctx.reply(botT(st.locale!, "meal_photo_analyzing"));
    rememberMsg(ctx.chat.id, analyzing.message_id);

    const { buffer, base64 } = await downloadTelegramPhoto(ctx);

    let photoPath: string | null = null;
    try { photoPath = await uploadPhotoToStorage(buffer, "meals"); } catch (e) { console.error("Photo upload error:", e); }
    st.data!.photoPath = photoPath;

    const aiLang = AI_LANGUAGE[st.locale!] || AI_LANGUAGE.en;
    const result = await visionJson(
      base64,
      `You are a nutrition analyst. Estimate the nutrition of the food in the photo for the whole portion. Answer ONLY with valid JSON, no markdown: {"name": string, "calories": number, "protein": number, "fat": number, "carbs": number}. Write name in ${aiLang}. Never ask questions; always estimate. If no food is visible, return name="—" and calories=0.`,
      "What food is this? Estimate the nutrition of the portion.",
    );

    st.data!.aiResult = result;
    st.step = "meal:photo_confirm";
    await replyKb(
      ctx,
      botT(st.locale!, "meal_photo_result", {
        name: result.name, cal: Math.round(result.calories),
        p: Math.round(result.protein || 0), f: Math.round(result.fat || 0), c: Math.round(result.carbs || 0),
      }),
      confirmEditKeyboard(st.locale!),
    );
  } catch (e: any) {
    console.error("Photo analysis error:", e);
    st.step = "meal:text_name";
    await replyCancel(ctx, `${botT(st.locale!, "error")}\n${aiErrorDetail(e)}\n\n${botT(st.locale!, "meal_input_prompt")}`, st.locale!);
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return -1;
  return h * 60 + m;
}

function isDueSlot(slot: string, nowKey: string, windowMin = 5): boolean {
  const slotM = minutesOfDay(slot);
  const nowM = minutesOfDay(nowKey);
  if (slotM < 0 || nowM < 0) return false;
  let diff = nowM - slotM;
  if (diff < 0) diff += 24 * 60;
  return diff >= 0 && diff < windowMin;
}

function isoWeekdayFromDateKey(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const js = new Date(Date.UTC(y, (m || 1) - 1, d || 1)).getUTCDay();
  return js === 0 ? 7 : js;
}

function planDueToday(plan: { recurrence: string; weekdaysJson: string; intervalDays: number; anchorDate: string | null; active: boolean }, dateKey: string): boolean {
  if (!plan.active) return false;
  if (plan.anchorDate && dateKey < plan.anchorDate) return false;
  const rec = plan.recurrence || "daily";
  if (rec === "weekly") {
    const days = parseWeekdaysJson(plan.weekdaysJson);
    return days.includes(isoWeekdayFromDateKey(dateKey));
  }
  if (rec === "interval") {
    const n = Math.max(1, plan.intervalDays || 1);
    const anchor = plan.anchorDate || dateKey;
    const a = Date.parse(`${anchor}T00:00:00Z`);
    const b = Date.parse(`${dateKey}T00:00:00Z`);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return false;
    return Math.round((b - a) / 86_400_000) % n === 0;
  }
  return true;
}

async function claimReminder(profileId: string, kind: string, dedupeKey: string): Promise<boolean> {
  try {
    await prisma.pushReminderSent.create({ data: { profileId, kind, dedupeKey } });
    return true;
  } catch {
    return false;
  }
}

async function runBotReminders() {
  const profiles = await prisma.profile.findMany({
    where: { telegramChatId: { not: null }, botLoggedOut: false },
    include: {
      medicationPlans: { where: { active: true } },
      mealPlans: { where: { active: true } },
    },
  });
  for (const profile of profiles) {
    const tz = profile.timezone || "UTC";
    const dateKey = todayStr(tz);
    const timeKey = nowTime(tz);
    const chatId = Number(profile.telegramChatId);
    if (!Number.isFinite(chatId)) continue;

    for (const plan of profile.medicationPlans) {
      if (!planDueToday(plan, dateKey)) continue;
      for (const due of parseTimesJson(plan.timesJson).filter((t) => isDueSlot(t, timeKey))) {
        const taken = await prisma.medicationIntake.findFirst({
          where: { profileId: profile.id, planId: plan.id, date: dateKey, scheduledTime: due },
          select: { id: true },
        });
        if (taken) continue;
        if (!(await claimReminder(profile.id, "medication", `${plan.id}|${dateKey}|${due}`))) continue;
        const dosage = plan.dosage ? ` (${plan.dosage})` : "";
        try {
          await bot.api.sendMessage(chatId, `💊 ${plan.name}${dosage} — ${due}`);
        } catch (e) {
          console.error("bot reminder med failed", e);
        }
      }
    }

    for (const plan of profile.mealPlans) {
      if (!planDueToday(plan, dateKey)) continue;
      for (const due of parseTimesJson(plan.timesJson).filter((t) => isDueSlot(t, timeKey))) {
        const logged = await prisma.meal.findFirst({
          where: { profileId: profile.id, date: dateKey, mealType: plan.mealType },
          select: { id: true },
        });
        if (logged) continue;
        if (!(await claimReminder(profile.id, "meal", `mealplan|${plan.id}|${dateKey}|${due}`))) continue;
        try {
          await bot.api.sendMessage(chatId, `🍽 ${plan.name} — ${due}`);
        } catch (e) {
          console.error("bot reminder meal failed", e);
        }
      }
    }
  }
}

bot.catch((err) => { console.error("Bot error:", err); });

async function main() {
  await bot.api.setMyCommands([
    { command: "start", description: "Главное меню" },
    { command: "register", description: "Регистрация" },
    { command: "meal", description: "Еда и расписание питания" },
    { command: "med", description: "Лекарства и расписание" },
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
  setInterval(() => {
    runBotReminders().catch((e) => console.error("reminder tick failed", e));
  }, 30_000);
  runBotReminders().catch((e) => console.error("reminder tick failed", e));
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
