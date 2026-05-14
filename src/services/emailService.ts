import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const APP_NAME = 'Merge';
const PRIMARY_COLOR = '#6366f1'; // Indigo-500
const DARK_BG = '#0f172a'; // Slate-900

const baseTemplate = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: ${DARK_BG}; color: #ffffff; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #1e293b; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border: 1px solid #334155; }
    .logo { font-size: 28px; font-weight: 800; color: ${PRIMARY_COLOR}; margin-bottom: 24px; text-align: center; letter-spacing: -0.025em; }
    .title { font-size: 24px; font-weight: 700; color: #f8fafc; margin-bottom: 16px; text-align: center; }
    .text { font-size: 16px; line-height: 1.6; color: #94a3b8; margin-bottom: 24px; text-align: center; }
    .button { display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, ${PRIMARY_COLOR} 0%, #4f46e5 100%); color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; text-align: center; transition: all 0.2s; }
    .footer { margin-top: 32px; text-align: center; font-size: 14px; color: #64748b; }
    .highlight { color: ${PRIMARY_COLOR}; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">${APP_NAME}</div>
      ${content}
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
    </div>
  </div>
</body>
</html>
`;

export const sendWelcomeEmail = async (email: string, name: string) => {
  const content = `
    <div class="title">Welcome to the future of collaboration!</div>
    <div class="text">
      Hi <span class="highlight">${name}</span>, we're thrilled to have you on board. 
      ${APP_NAME} is where developers find their perfect project partners and build something amazing.
    </div>
    <div style="text-align: center;">
      <a href="${process.env.FRONTEND_URL}/discover" class="button">Explore Developers</a>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"${APP_NAME}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Welcome to ${APP_NAME}! 🚀`,
      html: baseTemplate(content),
    });
    console.log(`Welcome email sent to ${email}`);
  } catch (error) {
    console.error('Error sending welcome email:', error);
  }
};

export const sendMatchEmail = async (email: string, userName: string, matchName: string) => {
  const content = `
    <div class="title">It's a Match! 🎉</div>
    <div class="text">
      Great news <span class="highlight">${userName}</span>! You and <span class="highlight">${matchName}</span> have both liked each other.
      It's time to connect and start building.
    </div>
    <div style="text-align: center;">
      <a href="${process.env.FRONTEND_URL}/matches" class="button">View Your Matches</a>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"${APP_NAME}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `New Match on ${APP_NAME}! 🤝`,
      html: baseTemplate(content),
    });
    console.log(`Match email sent to ${email}`);
  } catch (error) {
    console.error('Error sending match email:', error);
  }
};

export const sendForgotPasswordEmail = async (email: string, resetToken: string) => {
  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  const content = `
    <div class="title">Reset Your Password</div>
    <div class="text">
      We received a request to reset your password. No worries, it happens to the best of us!
      Click the button below to choose a new password. This link will expire in 1 hour.
    </div>
    <div style="text-align: center;">
      <a href="${resetLink}" class="button">Reset Password</a>
    </div>
    <div class="text" style="margin-top: 24px; font-size: 12px;">
      If you didn't request this, you can safely ignore this email.
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"${APP_NAME}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Reset your ${APP_NAME} password`,
      html: baseTemplate(content),
    });
    console.log(`Forgot password email sent to ${email}`);
  } catch (error) {
    console.error('Error sending forgot password email:', error);
  }
};
