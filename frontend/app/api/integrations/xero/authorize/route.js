import { NextResponse } from "next/server";
import { createXeroOAuthState, getXeroCredentials } from "@/lib/xero/server";
import { getAppUrl } from "@/lib/slack/server";

export async function GET(request) {
  const { clientId } = getXeroCredentials();
  const appUrl = getAppUrl(request);

  if (!clientId) {
    return NextResponse.redirect(`${appUrl}/integrations?xero_error=missing_client_id`);
  }

  const state = createXeroOAuthState();
  const redirectUri = `${appUrl}/api/integrations/xero/callback`;
  const url = new URL("https://login.xero.com/identity/connect/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set(
    "scope",
    "openid profile email offline_access accounting.settings.read accounting.contacts.read accounting.transactions.read"
  );
  url.searchParams.set("state", state);

  const response = NextResponse.redirect(url.toString());
  response.cookies.set("xero_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: appUrl.startsWith("https://"),
    maxAge: 600,
    path: "/",
  });
  return response;
}
