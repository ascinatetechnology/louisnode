import SibApiV3Sdk from "sib-api-v3-sdk";

const client = SibApiV3Sdk.ApiClient.instance;
const apiKey = client.authentications["api-key"];

apiKey.apiKey = process.env.BREVO_API_KEY;

export const sendEmail = async (to, otp) => {
  try {
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

    const sendSmtpEmail = {
      sender: {
        email: "devski756@gmail.com",
        name: "Louis App",
      },
      to: [{ email: to }],
      subject: "Your OTP Code",
      htmlContent: `
        <div style="font-family:sans-serif">
          <h2>Louis App</h2>
          <p>Your OTP is:</p>
          <h1>${otp}</h1>
          <p>This OTP will expire in 5 minutes</p>
        </div>
      `,
    };

    const response = await apiInstance.sendTransacEmail(sendSmtpEmail);

    console.log("✅ Brevo Email sent:", response);
    return response;

  } catch (err) {
    console.error("🔥 Brevo Error:", err);
    throw err;
  }
};