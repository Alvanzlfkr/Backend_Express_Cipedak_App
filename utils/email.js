import nodemailer from "nodemailer";

export async function sendOTP(email, otp) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Kode OTP Reset Password",
    text: `Kode OTP kamu adalah: ${otp}. Berlaku 5 menit.`,
  });
}
