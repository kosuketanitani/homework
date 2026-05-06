import fs from "node:fs/promises";
import { buildMessage, buildMessagesForRange } from "./chore-core.mjs";

const groupId = process.env.LINE_GROUP_ID || "Ccc1162334d31aff07a93f22b170a2ba2";
const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  || (await fs.readFile(new URL("./line-channel-access-token.txt", import.meta.url), "utf8")).trim();

function getArgValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return null;
  }
  return process.argv[index + 1] ?? null;
}

function parseDateInput(value) {
  if (!value) {
    return new Date();
  }
  return new Date(`${value}T00:00:00+09:00`);
}

const previewMode = process.argv.includes("--preview");
const baseDate = parseDateInput(getArgValue("--date"));
const days = Number(getArgValue("--days") ?? "1");

const messages = days === 1
  ? [{ date: baseDate, text: buildMessage(baseDate).text }]
  : buildMessagesForRange(baseDate, days).map((message) => ({
      date: message.date,
      text: message.text,
    }));

if (previewMode) {
  console.log(messages.map((message) => message.text).join("\n\n"));
  process.exit(0);
}

for (const message of messages) {
  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: groupId,
      messages: [
        {
          type: "text",
          text: message.text,
        },
      ],
    }),
  });

  const body = await response.text();

  console.log(JSON.stringify({
    date: message.date.toISOString().slice(0, 10),
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    body,
  }, null, 2));

  if (!response.ok) {
    process.exit(1);
  }
}
