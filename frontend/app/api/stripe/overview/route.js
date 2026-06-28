import { NextResponse } from "next/server";
import { readStripePayments, writeStripePayments } from "@/lib/current-data-store";
import {
  fetchStripeBalance,
  fetchStripeCustomers,
  fetchStripeInvoices,
  fetchStripePaymentIntents,
  fetchStripeSubscriptions,
  getStripeConfig,
  normalizeStripeBalance,
  normalizeStripeCustomers,
  normalizeStripeInvoices,
  normalizeStripePaymentIntents,
  normalizeStripeSubscriptions,
  summarizeStripePayments,
  validateStripeKey,
} from "@/lib/stripe/server";

export async function GET() {
  try {
    const [store, config] = await Promise.all([readStripePayments(), getStripeConfig()]);
    return NextResponse.json({
      ...store,
      connected: Boolean(config.secretKey),
      fromEnv: config.fromEnv,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read Stripe overview.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const config = await getStripeConfig();
    if (!config.secretKey) {
      return NextResponse.json(
        {
          error:
            "Stripe is not configured. Add STRIPE_SECRET_KEY in Vercel, or connect Stripe from Integrations.",
        },
        { status: 400 }
      );
    }

    const [account, rawCustomers, rawPaymentIntents, rawSubscriptions, rawInvoices, rawBalance] =
      await Promise.all([
        validateStripeKey(config.secretKey),
        fetchStripeCustomers(config),
        fetchStripePaymentIntents(config),
        fetchStripeSubscriptions(config),
        fetchStripeInvoices(config),
        fetchStripeBalance(config),
      ]);

    const customers = normalizeStripeCustomers(rawCustomers);
    const paymentIntents = normalizeStripePaymentIntents(rawPaymentIntents);
    const subscriptions = normalizeStripeSubscriptions(rawSubscriptions);
    const invoices = normalizeStripeInvoices(rawInvoices);
    const balance = normalizeStripeBalance(rawBalance);
    const summary = summarizeStripePayments({
      customers,
      paymentIntents,
      subscriptions,
      invoices,
      balance,
    });

    const store = await writeStripePayments({
      accountId: account.id,
      accountName: account.displayName,
      customers,
      paymentIntents,
      subscriptions,
      invoices,
      balance,
      summary,
    });

    return NextResponse.json({
      ...store,
      connected: true,
      fromEnv: config.fromEnv,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync Stripe overview.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
