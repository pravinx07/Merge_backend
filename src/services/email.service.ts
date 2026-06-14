import logger from '../Config/logger';

// In a production environment, this would use Resend, SendGrid, AWS SES, or Nodemailer
export const sendEmail = async (to: string, subject: string, htmlBody: string) => {
  try {
    // MOCK EMAIL SENDING
    logger.info(`[Email Service] Sending email to: ${to}`);
    logger.info(`[Email Service] Subject: ${subject}`);
    logger.info(`[Email Service] Body: ${htmlBody.substring(0, 50)}... (truncated)`);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    logger.info(`[Email Service] Email sent successfully to ${to}`);
    return true;
  } catch (error) {
    logger.error(`[Email Service] Failed to send email to ${to}`, error);
    return false;
  }
};
