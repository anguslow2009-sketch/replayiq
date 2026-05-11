import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata.userId;
      if (!userId) break;

      const periodEnd = sub.items.data[0]?.current_period_end;
      await db.subscription.upsert({
        where: { userId },
        create: {
          userId,
          stripeCustomerId: sub.customer as string,
          stripeSubscriptionId: sub.id,
          stripePriceId: sub.items.data[0]?.price.id,
          status: sub.status,
          currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
        },
        update: {
          stripeSubscriptionId: sub.id,
          stripePriceId: sub.items.data[0]?.price.id,
          status: sub.status,
          currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
        },
      });
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata.userId;
      if (!userId) break;

      await db.subscription.update({
        where: { userId },
        data: { status: "canceled", currentPeriodEnd: new Date() },
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
