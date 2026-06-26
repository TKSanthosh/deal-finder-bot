import { NextResponse } from 'next/server';

// Mock database to store subscribed members
const subscribers: Record<string, { active: boolean; plan: string; customerId: string }> = {};

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('stripe-signature');

    // In a real app, you would verify the signature using stripe.webhooks.constructEvent:
    // const event = stripe.webhooks.constructEvent(rawBody, signature, endpointSecret);
    
    // For demonstration, parse the raw body directly:
    const event = JSON.parse(rawBody);
    console.log(`[Stripe Webhook] Received event: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const email = session.customer_details?.email;
        const customerId = session.customer;

        if (email) {
          subscribers[email] = {
            active: true,
            plan: 'premium',
            customerId
          };
          console.log(`[Stripe Webhook] Provisioned premium access for user: ${email}`);
          
          // Here, you would trigger Telegram/Discord API integrations to generate 
          // a unique one-time invite link and email it to the user.
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        
        // Find user by customerId and deactivate them
        const email = Object.keys(subscribers).find(
          (key) => subscribers[key].customerId === customerId
        );
        
        if (email) {
          subscribers[email].active = false;
          console.log(`[Stripe Webhook] Revoked premium access for user: ${email}`);
          
          // Here, you would trigger a script to kick the user from Telegram/Discord channels.
        }
        break;
      }
      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error(`[Stripe Webhook] Error processing event: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
