// Copyright (c) Pajee Technologies. All rights reserved.
/** /developer works only when both env vars are set (key ≥ 16 chars). Remove the key to switch it off. */
export function developerSetupEnabled() {
  return !!process.env.SUPER_ADMIN_EMAIL && (process.env.SUPER_ADMIN_SETUP_KEY ?? "").length >= 16;
}
