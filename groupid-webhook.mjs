import http from "node:http";

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";

const server = http.createServer((req, res) => {
  if (req.method !== "POST") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("ok");
    return;
  }

  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });

  req.on("end", () => {
    try {
      const payload = JSON.parse(body || "{}");
      const groupIds = [];

      for (const event of payload.events || []) {
        const source = event?.source;
        if (source?.type === "group" && source.groupId) {
          groupIds.push(source.groupId);
        }
      }

      const log = {
        receivedAt: new Date().toISOString(),
        headers: {
          "x-line-signature": req.headers["x-line-signature"] || "",
        },
        groupIds,
        payload,
      };

      console.log(JSON.stringify(log, null, 2));
    } catch (error) {
      console.error("Failed to parse webhook payload");
      console.error(error);
      console.error(body);
    }

    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("ok");
  });
});

server.listen(port, host, () => {
  console.log(`Listening on http://${host}:${port}`);
  console.log("Send a message in the LINE group after setting the webhook URL.");
});
