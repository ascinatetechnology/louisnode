import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = async (to, otp) => {
  try {
    const response = await resend.emails.send({
      from: "Louis App <onboarding@resend.dev>",
      to: to,
      subject: "Your OTP Code",
      html: `
        <div style="font-family:sans-serif">
          <h2>Louis App 💛</h2>
          <p>Your OTP is:</p>
          <h1>${otp}</h1>
          <p>This OTP will expire in 5 minutes</p>
        </div>
      `
    });

    console.log("✅ Email sent:", response);
    return response;

  } catch (err) {
    console.error("🔥 Resend Error:", err);
    throw err;
  }
};