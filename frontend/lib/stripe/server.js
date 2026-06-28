import { readIntegrations } from "@/lib/current-data-store";

const clean = (value) => String(value || "").trim();

const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const fromMinor = (amount, currency = "usd") => {
  const normalized = clean(currency).toLowerCase();
  const divisor = ZERO_DECIMAL_CURRENCIES.has(normalized) ? 1 : 100;
  return Math.round((toNumber(amount) / divisor) * 100) / 100;
};

const unixToIso = (value) => {
  if (!value) return null;
  return new Date(Number(value) * 1000).toISOString();
};

const countBy = (items, getKey) => {
  const counts = new Map();
  for (const item of items) {
    const key = getKey(item) || "Unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
};

const normalizeCurrency = (currency) => clean(currency || "usd").toUpperCase();

export const getStripeConfig = async () => {
  const integrations = await readIntegrations();
  const stripe = integrations.stripe || {};
  return {
    secretKey: clean(process.env.STRIPE_SECRET_KEY) || stripe.secret_key,
    fromEnv: Boolean(process.env.STRIPE_SECRET_KEY),
    integration: stripe,
  };
};

export const stripeApi = async ({ secretKey, path, params }) => {
  if (!secretKey) throw new Error("Stripe secret key is required.");

  const url = new URL(`https://api.stripe.com/v1${path}`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
    },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error?.message || `Stripe API ${path} failed with ${response.status}`);
  }

  return payload;
};

export const validateStripeKey = async (secretKey) => {
  const account = await stripeApi({ secretKey, path: "/account" });
  return {
    id: account.id || null,
    displayName:
      account.business_profile?.name ||
      account.settings?.dashboard?.display_name ||
      account.email ||
      "Stripe Account",
    country: account.country || "",
    defaultCurrency: account.default_currency || "usd",
    email: account.email || "",
  };
};

export const fetchStripeCustomers = (config) =>
  stripeApi({
    ...config,
    path: "/customers",
    params: { limit: 100 },
  }).then((payload) => payload.data || []);

export const fetchStripePaymentIntents = (config) =>
  stripeApi({
    ...config,
    path: "/payment_intents",
    params: { limit: 100 },
  }).then((payload) => payload.data || []);

export const fetchStripeSubscriptions = (config) =>
  stripeApi({
    ...config,
    path: "/subscriptions",
    params: { status: "all", limit: 100 },
  }).then((payload) => payload.data || []);

export const fetchStripeInvoices = (config) =>
  stripeApi({
    ...config,
    path: "/invoices",
    params: { limit: 100 },
  }).then((payload) => payload.data || []);

export const fetchStripeBalance = (config) =>
  stripeApi({
    ...config,
    path: "/balance",
  });

export const normalizeStripeCustomers = (customers) =>
  customers.map((customer) => ({
    id: customer.id,
    name: customer.name || "Unnamed customer",
    email: customer.email || "",
    createdAt: unixToIso(customer.created),
    currency: normalizeCurrency(customer.currency),
    delinquent: Boolean(customer.delinquent),
    balance: fromMinor(customer.balance || 0, customer.currency),
    livemode: Boolean(customer.livemode),
  }));

export const normalizeStripePaymentIntents = (paymentIntents) =>
  paymentIntents.map((intent) => ({
    id: intent.id,
    amount: fromMinor(intent.amount, intent.currency),
    amountReceived: fromMinor(intent.amount_received, intent.currency),
    currency: normalizeCurrency(intent.currency),
    status: intent.status || "unknown",
    customer: typeof intent.customer === "string" ? intent.customer : intent.customer?.id || null,
    createdAt: unixToIso(intent.created),
    canceledAt: unixToIso(intent.canceled_at),
    paymentMethodTypes: intent.payment_method_types || [],
    description: intent.description || "",
    latestCharge: typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id || null,
  }));

export const normalizeStripeSubscriptions = (subscriptions) =>
  subscriptions.map((subscription) => {
    const items = subscription.items?.data || [];
    const firstPrice = items[0]?.price || {};
    const currency = normalizeCurrency(firstPrice.currency || subscription.currency);
    const mrr = items.reduce((sum, item) => {
      const price = item.price || {};
      const recurring = price.recurring || {};
      const unitAmount = fromMinor(price.unit_amount || price.unit_amount_decimal || 0, price.currency || currency);
      const quantity = item.quantity || 1;
      const intervalCount = recurring.interval_count || 1;
      const monthlyMultiplier =
        recurring.interval === "year"
          ? 1 / (12 * intervalCount)
          : recurring.interval === "week"
            ? 52 / (12 * intervalCount)
            : recurring.interval === "day"
              ? 365 / (12 * intervalCount)
              : 1 / intervalCount;
      return sum + unitAmount * quantity * monthlyMultiplier;
    }, 0);

    return {
      id: subscription.id,
      status: subscription.status || "unknown",
      customer: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id || null,
      createdAt: unixToIso(subscription.created),
      currentPeriodStart: unixToIso(subscription.current_period_start),
      currentPeriodEnd: unixToIso(subscription.current_period_end),
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      canceledAt: unixToIso(subscription.canceled_at),
      mrr: Math.round(mrr),
      currency,
      collectionMethod: subscription.collection_method || "unknown",
    };
  });

export const normalizeStripeInvoices = (invoices) =>
  invoices.map((invoice) => ({
    id: invoice.id,
    number: invoice.number || invoice.id,
    customer: typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id || null,
    customerName: invoice.customer_name || "Unknown customer",
    customerEmail: invoice.customer_email || "",
    status: invoice.status || "unknown",
    amountDue: fromMinor(invoice.amount_due, invoice.currency),
    amountPaid: fromMinor(invoice.amount_paid, invoice.currency),
    amountRemaining: fromMinor(invoice.amount_remaining, invoice.currency),
    total: fromMinor(invoice.total, invoice.currency),
    currency: normalizeCurrency(invoice.currency),
    createdAt: unixToIso(invoice.created),
    dueDate: unixToIso(invoice.due_date),
    paidAt: unixToIso(invoice.status_transitions?.paid_at),
    hostedInvoiceUrl: invoice.hosted_invoice_url || "",
  }));

export const normalizeStripeBalance = (balance) => {
  const normalizeAmounts = (amounts) =>
    (amounts || []).map((item) => ({
      amount: fromMinor(item.amount, item.currency),
      currency: normalizeCurrency(item.currency),
      sourceTypes: item.source_types || {},
    }));

  const available = normalizeAmounts(balance.available);
  const pending = normalizeAmounts(balance.pending);

  return {
    available,
    pending,
    availableTotal: Math.round(available.reduce((sum, item) => sum + item.amount, 0)),
    pendingTotal: Math.round(pending.reduce((sum, item) => sum + item.amount, 0)),
  };
};

export const summarizeStripePayments = ({
  customers,
  paymentIntents,
  subscriptions,
  invoices,
  balance,
}) => {
  const successfulPayments = paymentIntents.filter((intent) => intent.status === "succeeded");
  const failedPayments = paymentIntents.filter((intent) =>
    ["requires_payment_method", "canceled", "requires_action"].includes(intent.status)
  );
  const activeSubscriptions = subscriptions.filter((subscription) => subscription.status === "active");
  const trialingSubscriptions = subscriptions.filter((subscription) => subscription.status === "trialing");
  const canceledSubscriptions = subscriptions.filter((subscription) => subscription.status === "canceled");
  const openInvoices = invoices.filter((invoice) => invoice.status === "open");
  const now = Date.now();
  const overdueInvoices = invoices.filter((invoice) => {
    if (!invoice.dueDate || invoice.amountRemaining <= 0) return false;
    return new Date(invoice.dueDate).getTime() < now;
  });

  const revenueByCurrencyMap = new Map();
  for (const intent of successfulPayments) {
    revenueByCurrencyMap.set(
      intent.currency,
      (revenueByCurrencyMap.get(intent.currency) || 0) + intent.amountReceived
    );
  }

  const topRisks = [
    ...customers
      .filter((customer) => customer.delinquent)
      .map((customer) => ({
        id: customer.id,
        title: customer.name,
        detail: customer.email || "Customer marked delinquent in Stripe.",
        riskType: "Delinquent customer",
        value: customer.balance,
      })),
    ...overdueInvoices.map((invoice) => ({
      id: invoice.id,
      title: invoice.customerName || invoice.number,
      detail: `Invoice ${invoice.number} is overdue.`,
      riskType: "Overdue invoice",
      value: invoice.amountRemaining,
    })),
    ...subscriptions
      .filter((subscription) => subscription.cancelAtPeriodEnd)
      .map((subscription) => ({
        id: subscription.id,
        title: subscription.customer || subscription.id,
        detail: "Subscription is set to cancel at period end.",
        riskType: "Subscription churn",
        value: subscription.mrr,
      })),
  ]
    .sort((a, b) => (b.value || 0) - (a.value || 0))
    .slice(0, 10);

  return {
    totalCustomers: customers.length,
    delinquentCustomers: customers.filter((customer) => customer.delinquent).length,
    totalPaymentIntents: paymentIntents.length,
    successfulPayments: successfulPayments.length,
    failedPayments: failedPayments.length,
    totalPaymentVolume: Math.round(successfulPayments.reduce((sum, intent) => sum + intent.amountReceived, 0)),
    availableBalance: balance.availableTotal || 0,
    pendingBalance: balance.pendingTotal || 0,
    activeSubscriptions: activeSubscriptions.length,
    trialingSubscriptions: trialingSubscriptions.length,
    canceledSubscriptions: canceledSubscriptions.length,
    mrr: Math.round(
      [...activeSubscriptions, ...trialingSubscriptions].reduce((sum, subscription) => sum + subscription.mrr, 0)
    ),
    openInvoices: openInvoices.length,
    overdueInvoices: overdueInvoices.length,
    paidInvoices: invoices.filter((invoice) => invoice.status === "paid").length,
    totalInvoiceAmount: Math.round(invoices.reduce((sum, invoice) => sum + invoice.total, 0)),
    paymentStatusBreakdown: countBy(paymentIntents, (intent) => intent.status),
    subscriptionStatusBreakdown: countBy(subscriptions, (subscription) => subscription.status),
    invoiceStatusBreakdown: countBy(invoices, (invoice) => invoice.status),
    revenueByCurrency: [...revenueByCurrencyMap.entries()]
      .map(([name, amount]) => ({ name, amount: Math.round(amount) }))
      .sort((a, b) => b.amount - a.amount),
    topInvoices: [...invoices].sort((a, b) => b.amountDue - a.amountDue).slice(0, 10),
    topRisks,
  };
};
