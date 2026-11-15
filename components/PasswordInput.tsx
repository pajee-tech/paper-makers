"use client";
import { useState } from "react";

/** Password field with a show/hide eye button. */
export default function PasswordInput({ value, onChange, placeholder, minLength, required = true, autoComplete = "current-password" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; minLength?: number; required?: boolean; autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        minLength={minLength}
        required={required}
        autoComplete={autoComplete}
        style={{ paddingRight: 42 }}
      />
      <button
        type="button"
        aria-label={show ? "Hide password" : "Show password"}
        title={show ? "Hide password" : "Show password"}
        onClick={() => setShow((s) => !s)}
        style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", color: "var(--muted)", padding: "4px 8px" }}
      >
        {show ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" /><path d="M1 1l22 22" /></svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
        )}
      </button>
    </div>
  );
}
