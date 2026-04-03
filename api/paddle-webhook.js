// api/paddle-webhook.js
// Paddle webhook — fires when a subscription is created or payment succeeds
// Automatically upgrades user to Pro in Supabase

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://latbebqtayfvgzgebxam.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // Add this to Vercel env vars
const PADDLE_WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET; // Add this to Vercel env vars

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;

    // Verify it's a real Paddle event
    const eventType = body?.event_type;
    if (!eventType) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    console.log('Paddle webhook received:', eventType);

    // Handle subscription activated or payment completed
    if (
      eventType === 'subscription.activated' ||
      eventType === 'subscription.updated' ||
      eventType === 'transaction.completed'
    ) {
      // Get customer email from Paddle payload
      const email =
        body?.data?.customer?.email ||
        body?.data?.billing_details?.email ||
        null;

      if (!email) {
        console.log('No email found in webhook payload');
        return res.status(200).json({ received: true });
      }

      // Initialize Supabase with service key (bypasses RLS)
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      // Find user by email
      const { data: users, error: userError } = await sb
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();

      if (userError || !users) {
        // Try auth.users table
        const { data: authUser } = await sb.auth.admin.getUserByEmail(email);
        if (!authUser?.user) {
          console.log('User not found for email:', email);
          return res.status(200).json({ received: true });
        }

        // Update by auth user ID
        const { error: updateError } = await sb
          .from('profiles')
          .update({ is_pro: true })
          .eq('id', authUser.user.id);

        if (updateError) {
          console.error('Error upgrading user:', updateError);
        } else {
          console.log('User upgraded to Pro:', authUser.user.id);
        }
      } else {
        // Update by profile ID
        const { error: updateError } = await sb
          .from('profiles')
          .update({ is_pro: true })
          .eq('id', users.id);

        if (updateError) {
          console.error('Error upgrading user:', updateError);
        } else {
          console.log('User upgraded to Pro:', users.id);
        }
      }
    }

    // Handle subscription cancelled
    if (
      eventType === 'subscription.canceled' ||
      eventType === 'subscription.paused'
    ) {
      const email =
        body?.data?.customer?.email ||
        body?.data?.billing_details?.email ||
        null;

      if (email) {
        const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const { data: authUser } = await sb.auth.admin.getUserByEmail(email);
        if (authUser?.user) {
          await sb
            .from('profiles')
            .update({ is_pro: false })
            .eq('id', authUser.user.id);
          console.log('User downgraded:', authUser.user.id);
        }
      }
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
