import { handle, json } from "@/lib/api";
import { requireSuperAdmin } from "@/lib/auth";
import { getSettings, saveSettings, SettingsZ } from "@/lib/settings";
import { mailConfigured } from "@/lib/mail";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await requireSuperAdmin();
  return json({ settings: await getSettings(), mailConfigured: mailConfigured() });
});

export const PUT = handle(async (req: Request) => {
  await requireSuperAdmin();
  const s = SettingsZ.parse(await req.json());
  return json({ settings: await saveSettings(s) });
});
