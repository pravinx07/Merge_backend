import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config({ path: '/home/pravin/100xDevs/Merge/merge_backend/.env' });

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function testEmail() {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: 'test@example.com',
      subject: 'Test',
      text: 'Test',
    });
    console.log('Success');
  } catch (err) {
    console.error('Error:', err);
  }
}

testEmail();
