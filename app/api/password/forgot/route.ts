import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, json } from "@/lib/api";
import { mailConfigured, sendMail } from "@/lib/mail";
import { appOrigin, createResetLink, RESET_TTL_MIN } from "@/lib/passwordReset";
import { getSettings } from "@/lib/settings";

/** Always answers the same way so nobody can test which emails are registered. */
export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  const { email } = z.object({ email: z.string().email() }).parse(await req.json());
  const s = await getSettings();
  if (mailConfigured()) {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (user) {
      // Max 3 links per hour per user
      const recent = await prisma.passwordResetToken.count({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 3600_000) } } });
      if (recent < 3) {
        const link = await createResetLink(user.id, appOrigin(req));
        await sendMail(
          user.email,
          `${s.appName} — reset your password`,
          `<p>Assalam-o-Alaikum ${user.name},</p><p>Click the link below to set a new password (valid for ${RESET_TTL_MIN} minutes):</p><p><a href="${link}">${link}</a></p><p>If you did not ask for this, ignore this email.</p><p>— ${s.appName} by ${s.companyName}</p>`,
        ).catch((e) => console.error("mail failed", e));
      }
    }
  }
  return json({ ok: true, emailEnabled: mailConfigured(), supportWhatsapp: s.supportWhatsapp });
});
