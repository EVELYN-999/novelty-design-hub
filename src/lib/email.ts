import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const sendWelcomeEmail = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z.object({ email: z.string().email(), fullName: z.string() }).parse(raw),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("[email] RESEND_API_KEY not set — skipping welcome email");
      return { ok: true };
    }

    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    const { error } = await resend.emails.send({
      from: "Election/Node <onboarding@resend.dev>",
      to: data.email,
      subject: "Welcome to Election/Node",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#0a0a0a">Welcome, ${data.fullName || "voter"}!</h2>
          <p>Your Election/Node account has been created successfully.</p>
          <p>The admin will issue you a voting ticket when an election is active.</p>
          <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0"/>
          <p style="color:#666;font-size:12px">Election/Node — Secure Ballot System</p>
        </div>
      `,
    });

    if (error) console.error("[email] Resend error:", error);
    return { ok: !error };
  });
