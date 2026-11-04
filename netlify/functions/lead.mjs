// Netlify Function: принимает заявку с сайта и отправляет её в Telegram.
// Токен и chat_id задаются в Netlify: Site configuration → Environment variables
//   TG_BOT_TOKEN — токен от @BotFather
//   TG_CHAT_ID   — id чата/группы, куда слать заявки (можно несколько через запятую)

const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])).slice(0, 500);

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let d;
  try { d = await req.json(); } catch { return Response.json({ ok: false, error: "bad_json" }, { status: 400 }); }

  // Защита от ботов: скрытое поле должно быть пустым
  if (d.website) return Response.json({ ok: true });

  if (!String(d.name || "").trim() || !String(d.phone || "").trim()) {
    return Response.json({ ok: false, error: "required" }, { status: 400 });
  }

  const token = process.env.TG_BOT_TOKEN;
  const chats = String(process.env.TG_CHAT_ID || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!token || !chats.length) return Response.json({ ok: false, error: "not_configured" }, { status: 500 });

  const title = d.form === "audit" ? "🔎 Заявка на аудит" : "🎯 Заявка на стратсессию";
  const lines = [
    `<b>${title}</b>`,
    "",
    `👤 <b>Имя:</b> ${esc(d.name)}`,
    `📞 <b>Контакт:</b> ${esc(d.phone)}`,
    d.niche && `🏢 <b>Сфера:</b> ${esc(d.niche)}`,
    d.revenue && `💰 <b>Оборот:</b> ${esc(d.revenue)}`,
    d.site && `🔗 <b>Сайт/IG:</b> ${esc(d.site)}`,
  ];
  const utm = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]
    .filter((k) => d[k]).map((k) => `${k.replace("utm_", "")}: ${esc(d[k])}`);
  if (utm.length) lines.push("", "<b>📊 Источник</b>", ...utm);
  if (d.page) lines.push("", `<i>${esc(d.page)}</i>`);

  const text = lines.filter((l) => typeof l === "string").join("\n");

  const results = await Promise.all(chats.map((chat_id) =>
    fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id, text, parse_mode: "HTML", disable_web_page_preview: true }),
    }).then((r) => r.ok).catch(() => false)
  ));

  return results.some(Boolean)
    ? Response.json({ ok: true })
    : Response.json({ ok: false, error: "telegram_failed" }, { status: 502 });
};

export const config = { path: "/api/lead" };
