import Stripe from "stripe";

let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-04-22.dahlia",
    });
  }
  return _stripe;
}

// Keep named export for backwards compatibility with webhook handler
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return getStripe()[prop as keyof Stripe];
  },
});

export const PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID!;
export const FREE_ANALYSIS_LIMIT_SECS = 300; // 5 minutes

export async function getOrCreateStripeCustomer(
  userId: string,
  email: string
): Promise<string> {
  const { db } = await import("./db");

  const sub = await db.subscription.findUnique({ where: { userId } });
  if (sub?.stripeCustomerId) return sub.stripeCustomerId;

  const customer = await stripe.customers.create({ email, metadata: { userId } });

  await db.subscription.upsert({
    where: { userId },
    create: { userId, stripeCustomerId: customer.id },
    update: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

export async function isProUser(userId: string): Promise<boolean> {
  const { db } = await import("./db");
  const sub = await db.subscription.findUnique({ where: { userId } });
  if (!sub) return false;
  if (sub.status !== "active") return false;
  if (sub.currentPeriodEnd && sub.currentPeriodEnd < new Date()) return false;
  return true;
}
