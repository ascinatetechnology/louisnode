import express from "express";
import Stripe from "stripe";
import supabase from "../config/supabase.js";

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post("/create-subscription", async (req, res) => {

    try {

        const customer = await stripe.customers.create();

        const ephemeralKey = await stripe.ephemeralKeys.create(
            { customer: customer.id },
            { apiVersion: "2024-06-20" }
        );

        const paymentIntent = await stripe.paymentIntents.create({
            amount: 8099,
            currency: "usd",
            customer: customer.id,

            automatic_payment_methods: {
                enabled: true,
            },
        });

        res.json({
            paymentIntent: paymentIntent.client_secret,
            ephemeralKey: ephemeralKey.secret,
            customer: customer.id,
            paymentIntentId: paymentIntent.id,
        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            error: err.message,
        });
    }
});

router.post("/activate", async (req, res) => {

    try {

        const {
            user_id,
            payment_intent_id,
            plan,
        } = req.body;

        // VERIFY PAYMENT WITH STRIPE
        const paymentIntent = await stripe.paymentIntents.retrieve(
            payment_intent_id
        );

        if (paymentIntent.status !== "succeeded") {

            return res.status(400).json({
                success: false,
                message: "Payment not completed"
            });
        }

        const startDate = new Date();

        const endDate = new Date();

        endDate.setFullYear(endDate.getFullYear() + 1);

        // INSERT INTO SUPABASE
        const { data, error } = await supabase
            .from("subscriptions")
            .insert([
                {
                    user_id,
                    plan,
                    status: "active",
                    start_date: startDate,
                    end_date: endDate,
                }
            ]);

        if (error) {

            return res.status(400).json({
                success: false,
                error: error.message
            });
        }

        res.json({
            success: true,
            data
        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

export default router;