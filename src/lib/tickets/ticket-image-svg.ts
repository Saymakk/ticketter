import QRCode from "qrcode";

type TicketImageModel = {
  title: string;
  city: string | null;
  eventLine: string | null;
  address: string | null;
  dressCode: string | null;
  description: string | null;
  socialLinks: string[];
  uuid: string;
  buyerName: string | null;
  phone: string | null;
  region: string | null;
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
  return `<text x="44" y="${y}" font-size="18" fill="#64748b">${esc(label)}</text>
<text x="250" y="${y}" font-size="18" fill="#0f172a">${esc(value || "—")}</text>`;
}

export async function buildTicketImageSvg(model: TicketImageModel, includeStatus: boolean): Promise<string> {
  const qrDataUrl = await QRCode.toDataURL(model.uuid, {
    type: "image/png",
    width: 320,
    margin: 1,
  });
  const links = model.socialLinks.filter(Boolean).slice(0, 3).join(" · ");
  const headerExtra = [model.address, model.dressCode, model.description, links].filter(Boolean).join("  •  ");
  const rows: string[] = [];
  let y = 430;
  rows.push(line("Код", model.uuid, y));
  y += 32;
  rows.push(line("ФИО", model.buyerName ?? "—", y));
  y += 32;
  rows.push(line("Телефон", model.phone ?? "—", y));
  y += 32;
  rows.push(line("Регион", model.region ?? "—", y));
  y += 32;
  if (includeStatus) {
    rows.push(line("Статус", model.status || "—", y));
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <rect width="1080" height="1350" fill="#f8fafc"/>
  <rect x="28" y="28" width="1024" height="1294" rx="32" fill="#ffffff" stroke="#e2e8f0"/>
  <rect x="28" y="28" width="1024" height="250" rx="32" fill="#0f766e"/>
  <text x="44" y="92" font-size="44" font-weight="700" fill="#ffffff">${esc(model.title)}</text>
  <text x="44" y="136" font-size="24" fill="#d1fae5">${esc(model.city || "")}</text>
  <text x="44" y="172" font-size="22" fill="#ccfbf1">${esc(model.eventLine || "")}</text>
  <foreignObject x="44" y="190" width="990" height="78">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-size:16px;color:#ccfbf1;line-height:1.25;overflow:hidden;">
      ${esc(headerExtra)}
    </div>
  </foreignObject>
  <rect x="360" y="312" width="360" height="360" rx="20" fill="#ffffff" stroke="#e2e8f0"/>
  <image x="380" y="332" width="320" height="320" href="${qrDataUrl}"/>
  ${rows.join("\n")}
</svg>`;
}
