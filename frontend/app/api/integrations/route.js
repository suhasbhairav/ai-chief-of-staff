import { NextResponse } from "next/server";
import { readIntegrations, writeIntegrations } from "@/lib/current-data-store";
import { getSlackCredentials, slackApi } from "@/lib/slack/server";

export async function GET() {
  try {
    const integrations = await readIntegrations();
    const oauthSupported = Boolean(getSlackCredentials().clientId);
    return NextResponse.json({ integrations, oauthSupported });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve integrations.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const current = await readIntegrations();

    // If saving Slack details, verify token if provided
    if (payload.slack && payload.slack.bot_token) {
      try {
        const authTest = await slackApi("auth.test", payload.slack.bot_token);
        payload.slack = {
          connected: true,
          name: "Slack",
          icon: "💬",
          bot_token: payload.slack.bot_token,
          bot_user_id: authTest.user_id,
          team_name: authTest.team || "Connected Workspace",
          team_id: authTest.team_id,
          integratedAt: new Date().toISOString()
        };
      } catch (error) {
        return NextResponse.json(
          { error: `Slack validation failed: ${error.message}. Ensure the token is a Bot User OAuth Token with the required scopes.` },
          { status: 400 }
        );
      }
    }
    
    // Merge or update
    const updated = { ...current, ...payload };
    const saved = await writeIntegrations(updated);
    
    return NextResponse.json(saved);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to modify integrations.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
