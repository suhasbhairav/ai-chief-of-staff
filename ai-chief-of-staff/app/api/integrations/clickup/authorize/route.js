import { NextResponse } from "next/server";
import { createClickUpOAuthState, getClickUpCredentials } from "@/lib/clickup/server";
import { getAppUrl } from "@/lib/slack/server";

export async function GET(request) {
  const { clientId } = getClickUpCredentials();
  const appUrl = getAppUrl(request);

  if (!clientId) {
    return NextResponse.redirect(`${appUrl}/integrations?clickup_error=missing_client_id`);
  }

  const state = createClickUpOAuthState();
  const redirectUri = `${appUrl}/api/integrations/clickup/callback`;
  const url = new URL("https://app.clickup.com/api");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);

  const response = NextResponse.redirect(url.toString());
  response.cookies.set("clickup_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: appUrl.startsWith("https://"),
    maxAge: 600,
    path: "/",
  });
  return response;
}
