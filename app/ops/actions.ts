"use server";

import { createHash } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function opsLogin(formData: FormData): Promise<void> {
  const password = formData.get("password");
  const secret = process.env.OPS_SECRET;
  if (secret && typeof password === "string" && password === secret) {
    const token = createHash("sha256").update(secret).digest("hex");
    (await cookies()).set("ops_auth", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/ops",
      maxAge: 60 * 60 * 24 * 90,
    });
    redirect("/ops");
  }
  redirect("/ops?error=1");
}
