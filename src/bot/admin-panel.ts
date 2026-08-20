import { InlineKeyboard, type Context } from "grammy";
import type { PrismaClient } from "@prisma/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getBotAdminUser,
  isBotAdmin,
  listBotAdminUsers,
  listRecentActivity,
  listUserMeals,
  listUserMedIntakes,
  parsePhotoCallbackData,
  resolveStoredPhotoUrl,
  searchBotAdminUsers,
  setUserAdminNote,
  setUserBotLoggedOut,
  toggleUserAccess,
  unlinkUserTelegram,
} from "../lib/healthy-life/bot-admin";

const USERS_PAGE = 6;
const ACTIVITY_PAGE = 8;
const ITEMS_PAGE = 6;

const T = {
  admin_btn: "🛡 Админ",
  admin_title: "🛡 Панель администратора",
  admin_users: "👥 Пользователи",
  admin_activity: "📋 Последние действия",
  admin_search: "🔍 Поиск",
  admin_back: "◀️ Назад",
  admin_back_users: "◀️ К списку",
  admin_back_user: "◀️ К пользователю",
  admin_no_users: "Пользователей нет.",
  admin_user_card: "👤 {name}\n\n📧 {email}\n📱 {phone}\n🤖 Telegram: {tg}\n🔐 Доступ: {access}\n📝 Заметка: {note}\n🌐 Язык: {locale}\n📅 Регистрация: {created}\n\n📊 Еда: {meals} · Вес: {weights} · Тренировки: {workouts}\n💊 Планы: {mplans} · Приёмы: {mintakes} · Советы: {advice}",
  admin_access_on: "✅ включён",
  admin_access_off: "🚫 выключен",
  admin_tg_linked: "привязан ({id})",
  admin_tg_out: "выход из бота",
  admin_tg_none: "не привязан",
  admin_toggle_access: "🔐 Доступ",
  admin_reset_pwd: "🔑 Новый пароль",
  admin_bot_logout: "🚪 Выйти из бота",
  admin_unlink_tg: "📱 Отвязать TG",
  admin_user_meals: "🍽 Приёмы пищи",
  admin_user_meds: "💊 Лекарства",
  admin_set_note: "📝 Заметка",
  admin_pwd_prompt: "Введите новый пароль для «{name}» (мин. 4 символа):",
  admin_pwd_done: "✅ Пароль обновлён для {name}",
  admin_note_prompt: "Введите заметку администратора (или /skip чтобы очистить):",
  admin_note_done: "✅ Заметка сохранена",
  admin_access_toggled: "✅ Доступ {state} для {name}",
  admin_bot_logout_done: "✅ Пользователь {name} выведен из бота",
  admin_unlink_done: "✅ Telegram отвязан у {name}",
  admin_search_prompt: "Введите имя, email или телефон:",
  admin_search_empty: "Никого не найдено.",
  admin_activity_title: "📋 Последние действия",
  admin_meals_title: "🍽 Приёмы пищи — {name}",
  admin_meds_title: "💊 Лекарства — {name}",
  admin_forbidden: "Нет доступа.",
} as const;

function fmt(vars: Record<string, string | number>, template: string) {
  let s = template;
  for (const [k, v] of Object.entries(vars)) {
    s = s.split(`{${k}}`).join(String(v));
  }
  return s;
}

export type AdminPanelHooks = {
  prisma: PrismaClient;
  supabaseAdmin: SupabaseClient;
  setState: (chatId: number, state: { step: string; profileId?: string; locale?: string; data?: Record<string, unknown> }) => void;
  getState: (chatId: number) => { step: string; profileId?: string; locale?: string; data?: Record<string, unknown> } | undefined;
  replyInline: (ctx: Context, text: string, markup: InlineKeyboard, track?: boolean) => Promise<void>;
  replyMain: (ctx: Context, text: string, locale?: string) => Promise<void>;
  replyCancel: (ctx: Context, text: string, locale?: string) => Promise<void>;
  changeProfilePassword: (profileId: string, password: string) => Promise<void>;
  isValidPassword: (password: string) => boolean;
  showSettings: (ctx: Context) => Promise<void>;
};

export async function adminCanAccess(profileId: string, hooks: AdminPanelHooks) {
  return isBotAdmin(profileId, hooks.prisma, hooks.supabaseAdmin);
}

function navRow(ik: InlineKeyboard, backData: string) {
  ik.row().text(T.admin_back, backData);
}

export async function showAdminMenu(ctx: Context, adminProfileId: string, hooks: AdminPanelHooks) {
  if (!(await adminCanAccess(adminProfileId, hooks))) {
    await ctx.reply(T.admin_forbidden);
    return;
  }
  hooks.setState(ctx.chat!.id, {
    step: "admin:menu",
    profileId: adminProfileId,
    locale: "ru",
    data: { backTo: "settings" },
  });
  const ik = new InlineKeyboard()
    .text(T.admin_users, "adm:users:0").row()
    .text(T.admin_activity, "adm:act:0").row()
    .text(T.admin_search, "adm:search").row();
  navRow(ik, "adm:back:settings");
  await hooks.replyInline(ctx, T.admin_title, ik);
}

async function showUsersPage(ctx: Context, page: number, hooks: AdminPanelHooks, adminProfileId: string) {
  const { rows, total } = await listBotAdminUsers(hooks.prisma, hooks.supabaseAdmin, page, USERS_PAGE);
  hooks.setState(ctx.chat!.id, {
    step: "admin:users",
    profileId: adminProfileId,
    locale: "ru",
    data: { backTo: "admin:menu", usersPage: page },
  });

  let text = `${T.admin_users} (${total})\n`;
  if (rows.length === 0) text += `\n${T.admin_no_users}`;

  const ik = new InlineKeyboard();
  for (const u of rows) {
    const access = u.accessEnabled ? "✅" : "🚫";
    const tg = u.telegramChatId ? "🤖" : "—";
    const label = `${access}${tg} ${u.name} · 🍽${u.counts.meals}`.slice(0, 64);
    ik.text(label, `adm:u:${u.profileId}`).row();
  }

  const nav: string[] = [];
  if (page > 0) nav.push("◀️");
  if ((page + 1) * USERS_PAGE < total) nav.push("▶️");
  if (nav.length) {
    if (page > 0) ik.text("◀️", `adm:users:${page - 1}`);
    if ((page + 1) * USERS_PAGE < total) ik.text("▶️", `adm:users:${page + 1}`);
    ik.row();
  }
  ik.text(T.admin_search, "adm:search").row();
  navRow(ik, "adm:back:menu");
  await hooks.replyInline(ctx, text, ik);
}

async function showUserCard(ctx: Context, targetId: string, hooks: AdminPanelHooks, adminProfileId: string) {
  const data = await getBotAdminUser(hooks.prisma, hooks.supabaseAdmin, targetId);
  if (!data) {
    await ctx.answerCallbackQuery({ text: "Не найден", show_alert: true }).catch(() => {});
    return;
  }
  const u = data.row;
  hooks.setState(ctx.chat!.id, {
    step: "admin:user",
    profileId: adminProfileId,
    locale: "ru",
    data: { backTo: "admin:users", targetId, usersPage: 0 },
  });

  let tg: string = T.admin_tg_none;
  if (u.telegramChatId) {
    tg = u.botLoggedOut
      ? fmt({ id: u.telegramChatId }, T.admin_tg_out)
      : fmt({ id: u.telegramChatId }, T.admin_tg_linked);
  }

  const text = fmt(
    {
      name: u.name,
      email: u.email || "—",
      phone: u.phone ? `+${u.phone}` : "—",
      tg,
      access: u.accessEnabled ? T.admin_access_on : T.admin_access_off,
      note: u.adminNote || "—",
      locale: u.preferredLocale,
      created: u.createdAt.toISOString().slice(0, 10),
      meals: u.counts.meals,
      weights: u.counts.weights,
      workouts: u.counts.workouts,
      mplans: u.counts.medicationPlans,
      mintakes: u.counts.medicationIntakes,
      advice: u.counts.advice,
    },
    T.admin_user_card,
  );

  const ik = new InlineKeyboard()
    .text(u.accessEnabled ? "🚫 Выключить доступ" : "✅ Включить доступ", `adm:acc:${targetId}`)
    .text(T.admin_reset_pwd, `adm:pwd:${targetId}`).row()
    .text(T.admin_bot_logout, `adm:bout:${targetId}`)
    .text(T.admin_unlink_tg, `adm:untg:${targetId}`).row()
    .text(T.admin_user_meals, `adm:um:${targetId}:0`)
    .text(T.admin_user_meds, `adm:ui:${targetId}:0`).row()
    .text(T.admin_set_note, `adm:note:${targetId}`).row();
  navRow(ik, `adm:users:0`);
  await hooks.replyInline(ctx, text, ik);
}

async function showActivityPage(ctx: Context, page: number, hooks: AdminPanelHooks, adminProfileId: string) {
  const { items, hasMore } = await listRecentActivity(hooks.prisma, page, ACTIVITY_PAGE);
  hooks.setState(ctx.chat!.id, {
    step: "admin:activity",
    profileId: adminProfileId,
    locale: "ru",
    data: { backTo: "admin:menu", actPage: page },
  });

  let text = `${T.admin_activity_title}\n\n`;
  if (items.length === 0) text += "—";
  else {
    for (const item of items) {
      const icon = item.kind === "meal" ? "🍽" : "💊";
      const photo = item.photoPath ? " 📷" : "";
      text += `${icon} ${item.date} · ${item.userName}\n   ${item.label}${photo}\n`;
    }
  }

  const ik = new InlineKeyboard();
  for (const item of items) {
    if (item.photoPath) {
      ik.text(`📷 ${item.userName.slice(0, 10)}`, `adm:photo:${item.kind}:${item.id}`).row();
    }
  }
  if (page > 0) ik.text("◀️", `adm:act:${page - 1}`);
  if (hasMore) ik.text("▶️", `adm:act:${page + 1}`);
  if (page > 0 || hasMore) ik.row();
  navRow(ik, "adm:back:menu");
  await hooks.replyInline(ctx, text, ik);
}

async function showUserMealsPage(
  ctx: Context,
  targetId: string,
  page: number,
  hooks: AdminPanelHooks,
  adminProfileId: string,
) {
  const user = await getBotAdminUser(hooks.prisma, hooks.supabaseAdmin, targetId);
  if (!user) return;
  const { meals, total } = await listUserMeals(hooks.prisma, targetId, page, ITEMS_PAGE);

  let text = fmt({ name: user.row.name }, T.admin_meals_title) + `\n\n`;
  if (meals.length === 0) text += "—";
  else {
    for (const m of meals) {
      text += `📅 ${m.date} · ${m.name} — ${Math.round(m.calories)} kcal${m.photoPath ? " 📷" : ""}\n`;
    }
  }

  const ik = new InlineKeyboard();
  for (const m of meals) {
    if (m.photoPath) ik.text(`📷 ${m.name.slice(0, 14)}`, `adm:photo:meal:${m.id}`).row();
  }
  if (page > 0) ik.text("◀️", `adm:um:${targetId}:${page - 1}`);
  if ((page + 1) * ITEMS_PAGE < total) ik.text("▶️", `adm:um:${targetId}:${page + 1}`);
  if (page > 0 || (page + 1) * ITEMS_PAGE < total) ik.row();
  navRow(ik, `adm:u:${targetId}`);
  await hooks.replyInline(ctx, text, ik);
}

async function showUserMedsPage(
  ctx: Context,
  targetId: string,
  page: number,
  hooks: AdminPanelHooks,
  adminProfileId: string,
) {
  const user = await getBotAdminUser(hooks.prisma, hooks.supabaseAdmin, targetId);
  if (!user) return;
  const { intakes, total } = await listUserMedIntakes(hooks.prisma, targetId, page, ITEMS_PAGE);

  let text = fmt({ name: user.row.name }, T.admin_meds_title) + `\n\n`;
  if (intakes.length === 0) text += "—";
  else {
    for (const i of intakes) {
      text += `📅 ${i.date} · ${i.name}${i.dosage ? ` (${i.dosage})` : ""}${i.photoPath ? " 📷" : ""}\n`;
    }
  }

  const ik = new InlineKeyboard();
  for (const i of intakes) {
    if (i.photoPath) ik.text(`📷 ${i.name.slice(0, 14)}`, `adm:photo:med-intake:${i.id}`).row();
  }
  if (page > 0) ik.text("◀️", `adm:ui:${targetId}:${page - 1}`);
  if ((page + 1) * ITEMS_PAGE < total) ik.text("▶️", `adm:ui:${targetId}:${page + 1}`);
  if (page > 0 || (page + 1) * ITEMS_PAGE < total) ik.row();
  navRow(ik, `adm:u:${targetId}`);
  await hooks.replyInline(ctx, text, ik);
}

export async function handleAdminCallback(ctx: Context, data: string, hooks: AdminPanelHooks): Promise<boolean> {
  const chatId = ctx.chat!.id;
  const st = hooks.getState(chatId);
  const adminId = st?.profileId;
  if (!adminId || !(await adminCanAccess(adminId, hooks))) return false;

  if (data === "adm:back:settings") {
    await hooks.showSettings(ctx);
    return true;
  }
  if (data === "adm:back:menu") {
    await showAdminMenu(ctx, adminId, hooks);
    return true;
  }
  if (data.startsWith("adm:users:")) {
    const page = parseInt(data.slice("adm:users:".length), 10) || 0;
    await showUsersPage(ctx, page, hooks, adminId);
    return true;
  }
  if (data.startsWith("adm:u:")) {
    const targetId = data.slice("adm:u:".length);
    await showUserCard(ctx, targetId, hooks, adminId);
    return true;
  }
  if (data.startsWith("adm:act:")) {
    const page = parseInt(data.slice("adm:act:".length), 10) || 0;
    await showActivityPage(ctx, page, hooks, adminId);
    return true;
  }
  if (data === "adm:search") {
    hooks.setState(chatId, {
      step: "admin:search",
      profileId: adminId,
      locale: "ru",
      data: { backTo: "admin:menu" },
    });
    await hooks.replyCancel(ctx, T.admin_search_prompt, "ru");
    return true;
  }
  if (data.startsWith("adm:um:")) {
    const rest = data.slice("adm:um:".length);
    const sep = rest.lastIndexOf(":");
    const targetId = rest.slice(0, sep);
    const page = parseInt(rest.slice(sep + 1), 10) || 0;
    await showUserMealsPage(ctx, targetId, page, hooks, adminId);
    return true;
  }
  if (data.startsWith("adm:ui:")) {
    const rest = data.slice("adm:ui:".length);
    const sep = rest.lastIndexOf(":");
    const targetId = rest.slice(0, sep);
    const page = parseInt(rest.slice(sep + 1), 10) || 0;
    await showUserMedsPage(ctx, targetId, page, hooks, adminId);
    return true;
  }
  if (data.startsWith("adm:acc:")) {
    const targetId = data.slice("adm:acc:".length);
    const updated = await toggleUserAccess(hooks.prisma, targetId);
    await ctx.answerCallbackQuery({
      text: fmt({ state: updated.accessEnabled ? "включён" : "выключен", name: updated.name }, T.admin_access_toggled),
    }).catch(() => {});
    await showUserCard(ctx, targetId, hooks, adminId);
    return true;
  }
  if (data.startsWith("adm:pwd:")) {
    const targetId = data.slice("adm:pwd:".length);
    const user = await getBotAdminUser(hooks.prisma, hooks.supabaseAdmin, targetId);
    if (!user) return true;
    hooks.setState(chatId, {
      step: "admin:pwd",
      profileId: adminId,
      locale: "ru",
      data: { backTo: "admin:user", targetId, userName: user.row.name },
    });
    await hooks.replyCancel(ctx, fmt({ name: user.row.name }, T.admin_pwd_prompt), "ru");
    return true;
  }
  if (data.startsWith("adm:note:")) {
    const targetId = data.slice("adm:note:".length);
    hooks.setState(chatId, {
      step: "admin:note",
      profileId: adminId,
      locale: "ru",
      data: { backTo: "admin:user", targetId },
    });
    await hooks.replyCancel(ctx, T.admin_note_prompt, "ru");
    return true;
  }
  if (data.startsWith("adm:bout:")) {
    const targetId = data.slice("adm:bout:".length);
    const updated = await setUserBotLoggedOut(hooks.prisma, targetId, true);
    await ctx.answerCallbackQuery({ text: fmt({ name: updated.name }, T.admin_bot_logout_done) }).catch(() => {});
    await showUserCard(ctx, targetId, hooks, adminId);
    return true;
  }
  if (data.startsWith("adm:untg:")) {
    const targetId = data.slice("adm:untg:".length);
    const updated = await unlinkUserTelegram(hooks.prisma, targetId);
    await ctx.answerCallbackQuery({ text: fmt({ name: updated.name }, T.admin_unlink_done) }).catch(() => {});
    await showUserCard(ctx, targetId, hooks, adminId);
    return true;
  }
  if (data.startsWith("adm:photo:")) {
    const parsed = parsePhotoCallbackData(data);
    if (!parsed) {
      await ctx.answerCallbackQuery({ text: "Фото не найдено", show_alert: true }).catch(() => {});
      return true;
    }
    const url = await resolveStoredPhotoUrl(hooks.prisma, parsed.kind, parsed.id);
    if (url) {
      await ctx.answerCallbackQuery().catch(() => {});
      try {
        await ctx.replyWithPhoto(url);
      } catch {
        await ctx.reply(url);
      }
    } else {
      await ctx.answerCallbackQuery({ text: "Фото не найдено", show_alert: true }).catch(() => {});
    }
    return true;
  }

  return false;
}

export async function handleAdminText(
  ctx: Context,
  text: string,
  hooks: AdminPanelHooks,
): Promise<boolean> {
  const chatId = ctx.chat!.id;
  const st = hooks.getState(chatId);
  if (!st?.profileId || !(await adminCanAccess(st.profileId, hooks))) return false;

  if (st.step === "admin:search") {
    const rows = await searchBotAdminUsers(hooks.prisma, hooks.supabaseAdmin, text);
    if (rows.length === 0) {
      await ctx.reply(T.admin_search_empty);
      return true;
    }
    const ik = new InlineKeyboard();
    for (const u of rows) {
      ik.text(`${u.name} · 🍽${u.counts.meals}`, `adm:u:${u.profileId}`).row();
    }
    navRow(ik, "adm:back:menu");
    await hooks.replyInline(ctx, `🔍 «${text}»`, ik);
    return true;
  }

  if (st.step === "admin:pwd") {
    const targetId = String(st.data?.targetId || "");
    const userName = String(st.data?.userName || "");
    if (!hooks.isValidPassword(text)) {
      await ctx.reply("Пароль слишком короткий (мин. 4 символа).");
      return true;
    }
    await hooks.changeProfilePassword(targetId, text);
    await ctx.reply(fmt({ name: userName }, T.admin_pwd_done));
    await showUserCard(ctx, targetId, hooks, st.profileId);
    return true;
  }

  if (st.step === "admin:note") {
    const targetId = String(st.data?.targetId || "");
    const note = text === "/skip" ? null : text;
    await setUserAdminNote(hooks.prisma, targetId, note);
    await ctx.reply(T.admin_note_done);
    await showUserCard(ctx, targetId, hooks, st.profileId);
    return true;
  }

  return false;
}

export { T as adminT };
