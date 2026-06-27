import { NextResponse } from "next/server";
import {
  createSlackOAuthState,
  getAppUrl,
  getSlackCredentials,
  SLACK_BOT_SCOPES,
} from "@/lib/slack/server";

export async function GET(request) {
  const { clientId } = getSlackCredentials();
  const appUrl = getAppUrl(request);
  const redirectUri = `${appUrl}/api/integrations/slack/callback`;

  if (!clientId) {
    return NextResponse.json(
      { error: "SLACK_CLIENT_ID is not configured. Add it to your Vercel environment variables or frontend/.env.local for local development." },
      { status: 500 }
    );
  }

  const state = createSlackOAuthState();
  const params = new URLSearchParams({
    client_id: clientId,
    scope: SLACK_BOT_SCOPES.join(","),
    redirect_uri: redirectUri,
    state,
  });

  const response = NextResponse.redirect(
    `https://slack.com/oauth/v2/authorize?${params.toString()}`
  );
  response.cookies.set("slack_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: appUrl.startsWith("https://"),
    maxAge: 60 * 10,
    path: "/",
  });

  return response;
}
