import { createServerFn } from "@tanstack/react-start";

export const isAiAvailable = createServerFn({ method: "GET" }).handler(async () => {
  return Boolean(process.env.XAI_API_KEY);
});

export const extractTextWithAi = createServerFn({ method: "POST" })
  .validator((input: { imageDataUrl: string }) => {
    if (!input?.imageDataUrl?.startsWith("data:image/")) {
      throw new Error("A JPEG or PNG image is required.");
    }
    if (input.imageDataUrl.length > 6_500_000) {
      throw new Error("That page is too large to send. Try a smaller crop.");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "AI reading is not available right now." };
    }

    const prompt =
      "Extract every readable character from this document image. " +
      "Preserve reading order, line breaks, headings, lists, and spacing. " +
      "Do not summarize, translate, correct, or add commentary. " +
      "If the page has no text, return an empty string.";

    const models = ["grok-4.5", "grok-4.6"] as const;
    const payloads = [
      {
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: data.imageDataUrl, detail: "high" } },
              { type: "text", text: prompt },
            ],
          },
        ],
      },
      {
        messages: [
          {
            role: "user",
            content: [
              { type: "input_image", image_url: data.imageDataUrl, detail: "high" },
              { type: "input_text", text: prompt },
            ],
          },
        ],
      },
    ];

    let lastError = "AI reading failed.";
    for (const model of models) {
      for (const payload of payloads) {
        const res = await fetch("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            max_tokens: 4000,
            temperature: 0,
            ...payload,
          }),
        });

        if (!res.ok) {
          lastError = `AI reading failed (${res.status}).`;
          continue;
        }

        const body = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const text = body.choices?.[0]?.message?.content ?? "";
        return { ok: true as const, text: text.trim() };
      }
    }

    return { ok: false as const, error: lastError };
  });
