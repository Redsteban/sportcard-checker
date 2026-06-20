// ponytail: no deps, zero npm install. Vercel runs Node 18+ with native fetch.
export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: { "content-type": "application/json" } });
  }

  let body;
  try { body = await req.json(); } catch { /**/ }
  if (!body || !body.image) {
    return new Response(JSON.stringify({ error: "Send {image: 'data:image/...base64...'}" }), { status: 400, headers: { "content-type": "application/json" } });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY not set in Vercel env" }), { status: 500, headers: { "content-type": "application/json" } });
  }

  const prompt = `You are a sport card expert. Analyze this collectible sport card image. Return ONLY valid JSON with no markdown:

{
  "card": "Full card name",
  "player": "Player name",
  "year_set": "Year / Set name",
  "condition": "Estimated condition (e.g., Near Mint, Good, etc.)",
  "estimated_value": "Price range in USD (e.g., $5-15)",
  "confidence": "Low / Medium / High"
}

If you cannot identify the card, set confidence to "Low" and estimated_value to "Unknown".`;

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: body.image } }
          ]
        }],
        max_tokens: 500,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return new Response(JSON.stringify({ error: `OpenAI error: ${resp.status} ${err}` }), { status: 502, headers: { "content-type": "application/json" } });
    }

    const data = await resp.json();
    let text = data.choices[0].message.content.trim();
    // strip markdown fences
    text = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    return new Response(text, {
      status: 200,
      headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "content-type": "application/json" } });
  }
}
