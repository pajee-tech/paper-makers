// Copyright (c) Pajee Technologies. All rights reserved.
import nodemailer from "nodemailer";

/**
 * Free email via any SMTP account — e.g. Gmail with an App Password
 * (SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_USER=you@gmail.com, SMTP_PASS=<16-char app password>).
 * If SMTP is not configured, mailConfigured() is false and the app falls back to admin-generated reset links.
 */
export const mailConfigured = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

export async function sendMail(to: string, subject: string, html: string) {
  if (!mailConfigured()) return false;
  const port = Number(process.env.SMTP_PORT ?? 465);
  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await t.sendMail({ from: process.env.SMTP_FROM ?? process.env.SMTP_USER, to, subject, html });
  return true;
}
