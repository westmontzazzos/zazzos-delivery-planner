import type { Config, Context } from "@netlify/functions"

// Reads the delivery-screen photo(s) with Claude and returns the route plan text.
// Needs two environment variables in Netlify: ANTHROPIC_API_KEY and APP_PIN.
export default async (req: Request, context: Context) => {
  if (req.method !== "POST") return Response.json({ error: "POST only" }, { status: 405 })

  const key = Netlify.env.get("ANTHROPIC_API_KEY")
  const pinSet = Netlify.env.get("APP_PIN")
  if (!key || !pinSet) return Response.json({ error: "Server not set up yet" }, { status: 500 })

  let body: any
  try { body = await req.json() } catch { return Response.json({ error: "Bad request" }, { status: 400 }) }

  if (String(body.pin || "") !== pinSet) return Response.json({ error: "Wrong PIN" }, { status: 401 })

  const images: string[] = Array.isArray(body.images) ? body.images.slice(0, 4) : []
  const prompt = String(body.prompt || "").slice(0, 8000)
  if (!images.length || !prompt) return Response.json({ error: "Missing photo" }, { status: 400 })

  const content: any[] = images.map((data) => ({
    type: "image",
    source: { type: "base64", media_type: "image/jpeg", data },
  }))
  content.push({ type: "text", text: prompt })

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: Netlify.env.get("CLAUDE_MODEL") || "claude-sonnet-5-5",
      max_tokens: 3000,
      messages: [{ role: "user", content }],
    }),
  })

  const data: any = await r.json().catch(() => ({}))
  if (!r.ok) {
    console.log("Anthropic error", r.status, JSON.stringify(data).slice(0, 500))
    return Response.json({ error: "Planner error" }, { status: r.status === 429 ? 429 : 502 })
  }
  const text = (data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n")
  return Response.json({ text })
}

export const config: Config = { path: "/api/plan", method: "POST" }
