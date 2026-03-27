import nodemailer from "nodemailer";

export const sendEmail = async (to, otp) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: `"Louis App" <${process.env.EMAIL_USER}>`,
      to,
      subject: "Your OTP Code",
      html: `
        <div style="font-family:sans-serif">
          <h2>Louis App</h2>
          <p>Your OTP is:</p>
          <h1>${otp}</h1>
          <p>This OTP will expire in 5 minutes</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);

    console.log("✅ Email sent:", info);
    return info;

  } catch (err) {
    console.error("🔥 Nodemailer Error:", err);
    throw err;
  }
};