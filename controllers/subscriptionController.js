import Stripe from "stripe";
import supabase from "../config/supabase.js";

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY
);


export const getSubscriptionPlans =
async (req, res) => {

  try {

    const { data, error } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("price", {
        ascending: true
      });

    if (error) {
      throw error;
    }

    return res.json({
      plans: data || []
    });

  } catch(error) {

    console.log(error);

    return res.status(500).json({
      message: error.message
    });
  }
};

export const createSubscription =
async (req, res) => {

  try {

    const {
      planId
    } = req.body;

    const {
      data: plan,
      error: planError
    } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (planError || !plan) {

      return res.status(404).json({
        success: false,
        message: "Plan not found"
      });
    }
    const customer =
      await stripe.customers.create();

    const ephemeralKey =
      await stripe.ephemeralKeys.create(
        {
          customer: customer.id
        },
        {
          apiVersion: "2024-06-20"
        }
      );

    const paymentIntent =
      await stripe.paymentIntents.create({

        amount: Math.round(
          Number(plan.price) * 100
        ),

        currency: "usd",

        customer: customer.id,

        automatic_payment_methods: {
          enabled: true,
        },

        metadata: {
          plan_id: plan.id,
          plan_name: plan.name,
          billing_cycle: plan.billing_cycle
        }
      });

    return res.json({

      success: true,

      paymentIntent:
        paymentIntent.client_secret,

      paymentIntentId:
        paymentIntent.id,

      ephemeralKey:
        ephemeralKey.secret,

      customer:
        customer.id,

      plan
    });

  } catch(err) {

    console.log(err);

    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};


export const activateSubscription =
async (req, res) => {

  try {

    const {
      user_id,
      payment_intent_id,
      plan_id
    } = req.body;

    const paymentIntent =
      await stripe.paymentIntents.retrieve(
        payment_intent_id
      );

    if (
      paymentIntent.status !== "succeeded"
    ) {

      return res.status(400).json({
        success: false,
        message: "Payment not completed"
      });
    }

    // GET PLAN
    const {
      data: plan,
      error: planError
    } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", plan_id)
      .single();

    if (planError || !plan) {

      return res.status(404).json({
        success: false,
        message: "Plan not found"
      });
    }

    const startDate = new Date();

    const endDate = new Date();

    // MONTHLY / YEARLY
    if (
      plan.billing_cycle === "yearly"
    ) {

      endDate.setFullYear(
        endDate.getFullYear() + 1
      );

    } else {

      endDate.setMonth(
        endDate.getMonth() + 1
      );
    }

    // SAVE SUBSCRIPTION
    const {
      data,
      error
    } = await supabase
      .from("subscriptions")
      .insert([
        {
          user_id,
          plan: plan.name,
          status: "active",
          start_date: startDate,
          end_date: endDate,
        }
      ])
      .select()
      .single();

    if (error) {

      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    return res.json({
      success: true,
      subscription: data
    });

  } catch(err) {

    console.log(err);

    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};