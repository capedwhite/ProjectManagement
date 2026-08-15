import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

export async function sendInviteEmail({
  to,
  projectTitle,
  inviterName,
}) {
  const info = await transporter.sendMail({
    from: `"Project Management App" <${process.env.EMAIL_USER}>`,
    to,
    subject: `${inviterName} invited you to "${projectTitle}"`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
        <h2 style="color: #3ec170;">
          You've been invited to a project
        </h2>

        <p>
          <strong>${inviterName}</strong> invited you to collaborate on
          <strong>${projectTitle}</strong>.
        </p>

        <a
          href="${process.env.CLIENT_URL}/signup"
          style="
            display: inline-block;
            background: #3ec170;
            color: white;
            padding: 10px 20px;
            border-radius: 6px;
            text-decoration: none;
          "
        >
          Join the project
        </a>
      </div>
    `,
  });

  console.log("Email sent:", info.messageId);
}
export async function sendPasswordResetEmail({ to, name, resetLink }) {
  try {
    await transporter.sendMail({
      from: "onboarding@resend.dev",
      to,
      subject: "Reset your ProjectHub password",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #3ec170;">Reset your password</h2>
          <p>Hi ${name}, we got a request to reset your password. This link expires in 30 minutes.</p>
          <a href="${resetLink}"
             style="display: inline-block; background: #1a4d33; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; margin-top: 12px;">
            Reset Password
          </a>
          <p style="font-size: 12px; color: #888; margin-top: 20px;">
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send reset email:", err);
  }
}