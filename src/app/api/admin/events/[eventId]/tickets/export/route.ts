import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { ensureTicketMutationAccess } from "@/lib/auth/event-access";

type Params = { params: Promise<{ eventId: string }> };

/**
 * Fetch требует Latin-1 в значениях заголовков; кириллицу передаём через RFC 5987 filename*.
 */
function attachmentDisposition(utf8FileName: string, asciiFallback: string): string {
  const safeAscii = asciiFallback.replace(/[^\x20-\x7E]/g, "_");
  return `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(utf8FileName)}`;
}

function cellStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function escapeCsvCell(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const PREFERRED_TICKET_COLS = [
  "id",
  "uuid",
  "buyer_name",
  "phone",
  "region",
  "status",
  "manager_id",
  "created_at",
];

function ticketBaseColumns(tickets: Record<string, unknown>[]): string[] {
  const seen = new Set<string>();
  for (const t of tickets) {
    for (const k of Object.keys(t)) {
      if (k !== "custom_data" && k !== "event_id") seen.add(k);
    }
  }
  const rest = [...seen]
    .filter((k) => !PREFERRED_TICKET_COLS.includes(k) && k !== "ticket_type")
    .sort();
  const head = PREFERRED_TICKET_COLS.filter((k) => seen.has(k));
  return [...head, ...rest];
}

export async function GET(request: Request, { params }: Params) {
  const { eventId } = await params;
  const check = await ensureTicketMutationAccess(eventId);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";

  const admin = createAdminSupabaseClient();
  const { data: ev, error: evErr } = await admin
    .from("events")
    .select("id,title,city,event_date,event_time")
    .eq("id", eventId)
    .single();
  if (evErr || !ev) return NextResponse.json({ error: "Мероприятие не найдено" }, { status: 404 });

  const { data: ticketsRaw, error: tErr } = await admin
    .from("tickets")
    .select("*")
    .eq("event_id", eventId)
    .order("id", { ascending: true });
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 400 });

  const tickets = (ticketsRaw ?? []) as Record<string, unknown>[];
  const customKeys = new Set<string>();
  for (const t of tickets) {
    const cd = t.custom_data;
    if (cd && typeof cd === "object" && !Array.isArray(cd)) {
      Object.keys(cd as object).forEach((k) => customKeys.add(k));
    }
  }
  const sortedCustom = [...customKeys].sort();
  const baseCols = ticketBaseColumns(tickets);
  const headers = [...baseCols, ...sortedCustom.map((k) => `custom:${k}`)];

  const rows: string[][] = tickets.map((t) => {
    const cd =
      t.custom_data && typeof t.custom_data === "object" && !Array.isArray(t.custom_data)
        ? (t.custom_data as Record<string, unknown>)
        : {};
    const baseVals = baseCols.map((k) => cellStr(t[k]));
    const customVals = sortedCustom.map((k) => cellStr(cd[k]));
    return [...baseVals, ...customVals];
  });

  const metaRows: [string, string][] = [
    ["event_title", cellStr(ev.title)],
    ["event_city", cellStr(ev.city)],
    ["event_date", cellStr(ev.event_date)],
    ["event_time", cellStr(ev.event_time ?? "")],
    ["exported_at", new Date().toISOString()],
  ];

  const safeTitle = String(ev.title || "event")
    .replace(/[^\w\-\s\u0400-\u04FF]+/g, "_")
    .slice(0, 80);
  const csvName = `${safeTitle}-tickets.csv`;
  const xlsxName = `${safeTitle}-tickets.xlsx`;
  const asciiCsv = `tickets-${eventId.slice(0, 8)}.csv`;
  const asciiXlsx = `tickets-${eventId.slice(0, 8)}.xlsx`;

  if (format === "csv") {
    const lines = [
      ...metaRows.map(([a, b]) => `${escapeCsvCell(a)},${escapeCsvCell(b)}`),
      "",
      headers.map(escapeCsvCell).join(","),
      ...rows.map((r) => r.map(escapeCsvCell).join(",")),
    ];
    const csv = "\uFEFF" + lines.join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": attachmentDisposition(csvName, asciiCsv),
      },
    });
  }

  const wb = XLSX.utils.book_new();
  const metaWs = XLSX.utils.aoa_to_sheet([["Поле", "Значение"], ...metaRows]);
  XLSX.utils.book_append_sheet(wb, metaWs, "мероприятие");
  const dataWs = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, dataWs, "билеты");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": attachmentDisposition(xlsxName, asciiXlsx),
    },
  });
}
