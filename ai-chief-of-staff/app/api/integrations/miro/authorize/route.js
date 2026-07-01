import { NextResponse } from "next/server";
import { createMiroOAuthState, getMiroCredentials } from "@/lib/miro/server";
import { getAppUrl } from "@/lib/slack/server";

export async function GET(request) {
  const { clientId } = getMiroCredentials();
  const appUrl = getAppUrl(request);

  if (!clientId) {
    return NextResponse.redirect(`${appUrl}/integrations?miro_error=missing_client_id`);
  }

  const state = createMiroOAuthState();
  const redirectUri = `${appUrl}/api/integrations/miro/callback`;
  const url = new URL("https://miro.com/oauth/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);

  const response = NextResponse.redirect(url.toString());
  response.cookies.set("miro_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: appUrl.startsWith("https://"),
    maxAge: 600,
    path: "/",
  });
  return response;
}
