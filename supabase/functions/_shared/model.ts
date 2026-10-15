// Shared vision/text model call for the Edge Functions. Provider via secrets: AI_PROVIDER (gemini | anthropic), AI_MODEL, GEMINI_API_KEY / ANTHROPIC_API_KEY.
export async function callModel(prompt: string, schema: unknown, jpegB64?: string): Promise<unknown> {
  const provider = Deno.env.get('AI_PROVIDER') ?? (Deno.env.get('ANTHROPIC_API_KEY') ? 'anthropic' : 'gemini');
  if (provider === 'anthropic') {
    const content: unknown[] = [];
    if (jpegB64) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: jpegB64 } });
    content.push({ type: 'text', text: prompt });
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: Deno.env.get('AI_MODEL') ?? 'claude-sonnet-5-5', max_tokens: 4096, messages: [{ role: 'user', content }], output_config: { format: { type: 'json_schema', schema } } }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${body.error?.message ?? ''}`);
    return JSON.parse(body.content.find((c: { type: string }) => c.type === 'text').text);
  }
  const model = Deno.env.get('AI_MODEL') ?? 'gemini-3.5-flash-lite';
  const parts: unknown[] = [];
  if (jpegB64) parts.push({ inline_data: { mime_type: 'image/jpeg', data: jpegB64 } });
  parts.push({ text: prompt });
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': Deno.env.get('GEMINI_API_KEY')!, 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { response_mime_type: 'application/json', response_json_schema: schema, temperature: 0 } }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${body.error?.message ?? ''}`);
  return JSON.parse(body.candidates[0].content.parts[0].text);
}

export const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } });
