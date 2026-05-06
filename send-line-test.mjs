import fs from "node:fs/promises";

const tokenPath = new URL("./line-channel-access-token.txt", import.meta.url);

const token = (await fs.readFile(tokenPath, "utf8")).trim();
const groupId = "Ccc1162334d31aff07a93f22b170a2ba2";

const body = {
  to: groupId,
  messages: [
    {
      type: "text",
      text: "ローカル送信テストです。",
    },
  ],
};

const response = await fetch("https://api.line.me/v2/bot/message/push", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify(body),
});

const text = await response.text();

console.log(JSON.stringify({
  ok: response.ok,
  status: response.status,
  statusText: response.statusText,
  body: text,
}, null, 2));
