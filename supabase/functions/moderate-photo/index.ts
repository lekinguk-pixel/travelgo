// mmGO: screen a stamp photo with OpenAI's free moderation model.
// Called by the app right after a stamp is claimed. Only photos marked
// 'pending' are checked, and only by the player who took them.
// Approved photos become visible to friends; anything flagged (or any
// error) goes to the moderators' queue instead.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';
import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function adminKey(): string {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (keys) {
    try { const parsed = JSON.parse(keys); if (parsed.default) return parsed.default; } catch { /* fall through */ }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, adminKey(), { auth: { persistSession: false } });

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) return json({ error: 'Sign in first.' }, 401);

  let stampId: number;
  try { stampId = Number((await req.json()).stamp_id); } catch { return json({ error: 'Send a stamp_id.' }, 400); }
  if (!Number.isFinite(stampId)) return json({ error: 'Send a stamp_id.' }, 400);

  const { data: stamp } = await admin.from('stamps').select('id, user_id, photo_path, photo_status').eq('id', stampId).single();
  if (!stamp || stamp.user_id !== userData.user.id) return json({ error: 'Not your stamp.' }, 403);
  if (stamp.photo_status !== 'pending') return json({ status: stamp.photo_status, checked: false });

  const verdict = async (flagged: boolean, result: Record<string, unknown>) => {
    await admin.rpc('set_ai_verdict', { p_stamp_id: stampId, p_flagged: flagged, p_result: result });
    return json({ status: flagged ? 'flagged' : 'approved', checked: true });
  };

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return verdict(true, { error: 'OPENAI_API_KEY is not set, so the photo needs a manual check.' });

  try {
    const file = await admin.storage.from('stamp-photos').download(stamp.photo_path);
    if (file.error || !file.data) throw new Error('Could not read the photo.');
    const bytes = new Uint8Array(await file.data.arrayBuffer());
    const type = file.data.type || 'image/jpeg';

    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'omni-moderation-latest',
        input: [{ type: 'image_url', image_url: { url: `data:${type};base64,${encodeBase64(bytes)}` } }],
      }),
    });
    if (!res.ok) throw new Error(`Moderation service replied ${res.status}.`);
    const body = await res.json();
    const r = body.results?.[0];
    if (!r) throw new Error('Moderation service gave no result.');

    const categories = Object.fromEntries(Object.entries(r.categories ?? {}).filter(([, v]) => v === true));
    const top = Object.entries((r.category_scores ?? {}) as Record<string, number>).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return verdict(Boolean(r.flagged), { model: body.model, flagged: Boolean(r.flagged), categories, top_scores: Object.fromEntries(top), checked_at: new Date().toISOString() });
  } catch (e) {
    // When in doubt, a person decides.
    return verdict(true, { error: e instanceof Error ? e.message : 'Screening failed.' });
  }
});
