import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({});
async function run() {
  const models = ["gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.8-flash"];
  for (const m of models) {
    try {
      const res = await ai.models.generateContent({ model: m, contents: "hi" });
      console.log(m, "SUCCESS");
    } catch (e: any) {
      console.log(m, "ERROR", e.message.substring(0, 80));
    }
  }
}
run();
