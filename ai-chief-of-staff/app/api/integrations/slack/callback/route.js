import { NextResponse } from "next/server";
import { getAppUrl, getSlackCredentials, saveSlackInstallation } from "@/lib/slack/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");
  const state = searchParams.get("state");
  const expectedState = request.cookies.get("slack_oauth_state")?.value;

  const appUrl = getAppUrl(request);
  const redirectUri = `${appUrl}/api/integrations/slack/callback`;

  if (errorParam) {
    return NextResponse.redirect(`${appUrl}/integrations?slack_error=${encodeURIComponent(errorParam)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${appUrl}/integrations?slack_error=missing_code`);
  }

  if (!state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${appUrl}/integrations?slack_error=invalid_oauth_state`);
  }

  const { clientId, clientSecret } = getSlackCredentials();

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/integrations?slack_error=missing_credentials`);
  }

  try {
    // Exchange authorize code for access token via Slack OAuth API
    const response = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri
      }).toString()
    });

    const data = await response.json();

    if (!data.ok) {
      console.error("Slack OAuth access exchange failed:", data.error);
      return NextResponse.redirect(`${appUrl}/integrations?slack_error=${encodeURIComponent(data.error)}`);
    }

    await saveSlackInstallation(data);

    // Sync default tasks to populate the list upon successful integration
    try {
      await fetch(`${appUrl}/api/todo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" })
      });
    } catch (syncErr) {
      console.error("Failed to seed tasks post-OAuth:", syncErr);
    }

    const redirect = NextResponse.redirect(`${appUrl}/integrations?slack_success=true`);
    redirect.cookies.delete("slack_oauth_state");
    return redirect;
  } catch (err) {
    console.error("Slack OAuth callback handler crashed:", err);
    const msg = err instanceof Error ? err.message : "unknown_callback_error";
    return NextResponse.redirect(`${appUrl}/integrations?slack_error=${encodeURIComponent(msg)}`);
  }
}
