import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

const QUESTIONS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      "When did the Cubs last lose 14-2?",
      "Has a World Series game ever ended 13-12?",
      "What's the most common final score at Coors Field?",
      "What was the last scorigami?",
      "What's the most lopsided win in Yankees history?",
      "How many different final scores have the Dodgers had?",
    ];

(async () => {
  const { askScorigami, ASK_MODEL } = await import("@/lib/ask/agent");
  const { pool } = await import("@/lib/db");
  console.log("model:", ASK_MODEL);
  for (const q of QUESTIONS) {
    const started = Date.now();
    try {
      const r = await askScorigami([{ role: "user", content: q }]);
      console.log(`\n## ${q}\n[${r.status}${r.retried ? ", retried" : ""}] ${Date.now() - started}ms, ${r.usage.inputTokens} in / ${r.usage.outputTokens} out`);
      console.log(r.answer);
      if (r.status !== "answered") console.log("draft:", r.draft, "| unverified:", r.unverified);
      for (const s of r.steps) console.log(`  - ${s.label} → ${s.result}`);
      for (const g of r.games) console.log(`  * ${g.date} ${g.label} ${g.url ? "(link)" : ""}`);
    } catch (e) {
      console.log(`\n## ${q}\nFAILED: ${(e as Error).message}`);
    }
  }
  await pool.end();
})();
