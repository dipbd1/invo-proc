import { GoogleGenAI } from "@google/genai";
import { extractionSchema, type Check, type Extraction } from "@invo/shared";
import { requireGeminiKey, settings } from "./config.ts";
import { EXTRACT_PROMPT, extractionJsonSchema } from "./prompt.ts";

function mimeFor(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  throw new Error(`Unsupported file type: ${filePath}`);
}

function parseExtraction(text: string | undefined): Extraction {
  if (!text) throw new Error("Gemini returned empty text");
  const parsed: unknown = JSON.parse(text);
  return extractionSchema.parse(parsed);
}

export async function extractWithGemini(
  fileBytes: Buffer,
  filePath: string,
  repair?: { previous: Extraction; checks: Check[] },
): Promise<Extraction> {
  const apiKey = requireGeminiKey();
  const ai = new GoogleGenAI({ apiKey });
  const prompt = repair
    ? `${EXTRACT_PROMPT}

The previous JSON failed these checks. Fix only what the checks name. Keep integers and YYYY-MM-DD.
Previous JSON:
${JSON.stringify(repair.previous, null, 2)}
Checks:
${repair.checks
  .filter((c) => !c.ok)
  .map((c) => `- ${c.id}: ${c.message}`)
  .join("\n")}`
    : EXTRACT_PROMPT;

  const response = await ai.models.generateContent({
    model: settings.geminiModel,
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeFor(filePath),
              data: fileBytes.toString("base64"),
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: extractionJsonSchema,
    },
  });

  return parseExtraction(response.text);
}
