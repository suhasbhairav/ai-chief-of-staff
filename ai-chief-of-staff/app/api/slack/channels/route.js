import { NextResponse } from "next/server";
import { readActiveSlackInstallation, slackApi } from "@/lib/slack/server";

export async function GET() {
  try {
    const installation = await readActiveSlackInstallation();
    const botToken = installation?.bot_access_token;

    if (!botToken) {
      return NextResponse.json({ error: "Slack not integrated" }, { status: 400 });
    }

    const data = await slackApi("conversations.list", botToken, {
      types: "public_channel,private_channel,mpim,im",
      exclude_archived: true,
      limit: 200,
    }, {
      httpMethod: "GET",
    });

    return NextResponse.json({
      channels: (data.channels || []).map((c) => ({
        id: c.id,
        name: c.name || c.user || c.id,
        is_im: c.is_im,
        is_private: c.is_private,
        is_member: c.is_member,
        num_members: c.num_members,
        topic: c.topic?.value || ""
      }))
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Slack channels request failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
