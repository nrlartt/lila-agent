import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});

const key = process.env.GROQ_API_KEY;
const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

if (!key?.trim()) {
  console.error("No GROQ_API_KEY");
  process.exit(1);
}

const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  },
  body: JSON.stringify({
    model,
    messages: [{ role: "user", content: "Say hi in one word." }],
    max_tokens: 32,
  }),
});

const text = await res.text();
console.log("HTTP", res.status);
if (!res.ok) {
  console.log(text.slice(0, 500));
  process.exit(1);
}
console.log("OK", JSON.parse(text).choices?.[0]?.message?.content);
