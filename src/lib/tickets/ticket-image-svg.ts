import QRCode from "qrcode";

type TicketImageModel = {
  title: string;
  city: string | null;
  eventLine: string | null;
  companyName: string | null;
  address: string | null;
  dressCode: string | null;
  description: string | null;
  socialLinks: string[];
  ticketValidUntil: string | null;
  uuid: string;
  buyerName: string | null;
  phone: string | null;
  region: string | null;
  checkedInAt: string | null;
  customData: Record<string, unknown> | null;
  status: string;
};

function esc(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function line(label: string, value: string, y: number): string {
  return `<text x="44" y="${y}" font-size="16" fill="#64748b">${esc(label)}</text>
<text x="285" y="${y}" font-size="16" fill="#0f172a">${esc(value || "—")}</text>`;
}

function infoRows(model: TicketImageModel, includeStatus: boolean): string[] {
  const rows: string[] = [
    line("Код билета", model.uuid, 430),
    line("ФИО", model.buyerName ?? "—", 458),
    line("Телефон", model.phone ?? "—", 486),
    line("Регион", model.region ?? "—", 514),
    line("Билет действителен до", model.ticketValidUntil ?? "—", 542),
  ];
  if (model.checkedInAt) {
    rows.push(line("Пробит", model.checkedInAt, 570));
  }
  if (includeStatus) {
    rows.push(line("Статус", model.status || "—", rows.length ? 598 : 570));
  }
  const extras =
    model.customData && typeof model.customData === "object" && !Array.isArray(model.customData)
      ? Object.entries(model.customData).filter(([, v]) => v != null && String(v).trim() !== "")
      : [];
  let y = includeStatus ? 626 : model.checkedInAt ? 598 : 570;
  for (const [k, v] of extras.slice(0, 12)) {
    rows.push(line(k, String(v), y));
    y += 28;
  }
  return rows;
}

export async function buildTicketImageSvg(model: TicketImageModel, includeStatus: boolean): Promise<string> {
  const qrDataUrl = await QRCode.toDataURL(model.uuid, {
    type: "image/png",
    width: 320,
    margin: 1,
  });
  const rows = infoRows(model, includeStatus);
  const linkLines = model.socialLinks.filter(Boolean).slice(0, 3);
  const topMeta = [model.address, model.dressCode, model.description].filter(Boolean).join(" · ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1180" viewBox="0 0 1080 1180">
  <rect width="1080" height="1180" fill="#f1f5f9"/>
  <rect x="80" y="40" width="920" height="1100" rx="28" fill="#ffffff" stroke="#e2e8f0"/>
  <rect x="80" y="40" width="920" height="225" rx="28" fill="#0f766e"/>
  <text x="112" y="98" font-size="34" font-weight="700" fill="#ffffff">${esc(model.title)}</text>
  <text x="112" y="126" font-size="14" fill="#ccfbf1">${esc(model.companyName ?? "")}</text>
  <text x="112" y="148" font-size="18" fill="#d1fae5">${esc(model.city || "")}</text>
  <text x="112" y="176" font-size="16" fill="#ccfbf1">${esc(model.eventLine || "")}</text>
  <foreignObject x="112" y="188" width="850" height="58">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-size:13px;color:#ccfbf1;line-height:1.25;overflow:hidden;">
      ${esc(topMeta)}
    </div>
  </foreignObject>
  <rect x="257" y="286" width="560" height="560" rx="24" fill="#ffffff" stroke="#e2e8f0"/>
  <image x="291" y="320" width="492" height="492" href="${qrDataUrl}"/>
  <text x="112" y="874" font-size="13" fill="#64748b">Покажите этот QR-код на входе</text>
  <rect x="112" y="900" width="850" height="198" rx="16" fill="#ffffff" stroke="#e2e8f0"/>
  <text x="132" y="928" font-size="12" font-weight="700" fill="#64748b">ДАННЫЕ БИЛЕТА</text>
  ${model.companyName ? `<text x="132" y="954" font-size="14" fill="#0f172a">${esc(model.companyName)}</text>` : ""}
  ${linkLines
    .map(
      (url, idx) =>
        `<text x="132" y="${973 + idx * 18}" font-size="13" fill="#0f766e">${esc(url)}</text>`
    )
    .join("\n")}
  <g transform="translate(88, 540)">
    ${rows.join("\n")}
  </g>
</svg>`;
}
