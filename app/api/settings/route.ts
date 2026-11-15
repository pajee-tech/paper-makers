import { handle, json } from "@/lib/api";
import { getSettings, publicSettings } from "@/lib/settings";

/** Public: plans, prices, payment accounts (billing + landing pages). */
export const dynamic = "force-dynamic";

export const GET = handle(async () => json(publicSettings(await getSettings())));
