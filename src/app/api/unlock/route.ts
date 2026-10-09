import { NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  ACCESS_MAX_AGE,
  accessToken,
  safeReturn,
  sitePassword,
} from "@/lib/access";

/**
 * Exchanges the password for the cookie.
 *
 * A form POST rather than fetch, so the page works before any
 * JavaScript has run and so the browser offers to remember the password
 * in its own manager — which is where a password belongs, rather than
 * in a note the owner keeps retyping.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


export async function POST(request: Request) {
  const password = sitePassword();
  const form = await request.formData().catch(() => null);
  const back = safeReturn(String(form?.get("from") ?? "/"));

  /* With no password configured there is nothing to unlock and the
     middleware is already letting everything through. Sending the
     visitor on rather than setting a cookie keeps one source of truth
     for "is this site locked". */
  if (!password) return NextResponse.redirect(new URL(back, request.url), 303);

  const given = String(form?.get("password") ?? "");
  if (given !== password) {
    const url = new URL("/unlock", request.url);
    url.searchParams.set("from", back);
    url.searchParams.set("bad", "1");
    /* 303 so the browser turns the POST into a GET and a refresh does
       not resubmit the password. */
    return NextResponse.redirect(url, 303);
  }

  const response = NextResponse.redirect(new URL(back, request.url), 303);
  response.cookies.set({
    name: ACCESS_COOKIE,
    value: await accessToken(password),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACCESS_MAX_AGE,
  });
  return response;
}
