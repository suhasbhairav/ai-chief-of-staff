import { NextResponse } from "next/server";
import { readMailchimpMarketing, writeMailchimpMarketing } from "@/lib/current-data-store";
import {
  fetchMailchimpAudiences,
  fetchMailchimpCampaigns,
  fetchMailchimpReports,
  getMailchimpConfig,
  normalizeMailchimpAudiences,
  normalizeMailchimpCampaigns,
  normalizeMailchimpReports,
  summarizeMailchimpMarketing,
  validateMailchimpToken,
} from "@/lib/mailchimp/server";

export async function GET() {
  try {
    const [store, config] = await Promise.all([readMailchimpMarketing(), getMailchimpConfig()]);
    return NextResponse.json({
      ...store,
      connected: Boolean(config.apiKey),
      fromEnv: config.fromEnv,
      serverPrefix: config.serverPrefix,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read Mailchimp overview.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const config = await getMailchimpConfig();
    if (!config.apiKey) {
      return NextResponse.json(
        {
          error:
            "Mailchimp is not configured. Add MAILCHIMP_API_KEY in Vercel or connect Mailchimp from Integrations.",
        },
        { status: 400 }
      );
    }

    const [account, rawAudiences, rawCampaigns, rawReports] = await Promise.all([
      validateMailchimpToken({
        apiKey: config.apiKey,
        serverPrefix: config.serverPrefix,
      }),
      fetchMailchimpAudiences({ apiKey: config.apiKey, serverPrefix: config.serverPrefix }),
      fetchMailchimpCampaigns({ apiKey: config.apiKey, serverPrefix: config.serverPrefix }),
      fetchMailchimpReports({ apiKey: config.apiKey, serverPrefix: config.serverPrefix }),
    ]);

    const audiences = normalizeMailchimpAudiences(rawAudiences);
    const campaigns = normalizeMailchimpCampaigns(rawCampaigns);
    const reports = normalizeMailchimpReports(rawReports);
    const summary = summarizeMailchimpMarketing({ audiences, campaigns, reports });

    const store = await writeMailchimpMarketing({
      accountId: account.accountId,
      accountName: account.accountName,
      audiences,
      campaigns,
      reports,
      summary,
    });

    return NextResponse.json({
      ...store,
      connected: true,
      fromEnv: config.fromEnv,
      serverPrefix: account.serverPrefix,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync Mailchimp overview.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
