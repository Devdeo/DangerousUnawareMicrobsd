
import nodemailer from 'nodemailer';

// Create transporter for Gmail
const createTransporter = () => {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.ZOHO_EMAIL,
      pass: process.env.ZOHO_APP_PASSWORD,
    },
  });
};

// Send email function
export const sendEmail = async (to, subject, htmlContent, textContent = '') => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"${process.env.ZOHO_SENDER_NAME || 'Admin'}" <${process.env.ZOHO_EMAIL}>`,
      to: to,
      subject: subject,
      text: textContent,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};

// Email templates
export const emailTemplates = {
  userRegistration: (userName, userEmail) => ({
    subject: 'Welcome to Our Platform!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome ${userName}!</h2>
        <p>Thank you for joining our platform. Your account has been successfully created.</p>
        <p><strong>Email:</strong> ${userEmail}</p>
        <p>You can now start using our services. If you have any questions, please don't hesitate to contact us.</p>
        <hr style="border: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
      </div>
    `,
    text: `Welcome ${userName}! Thank you for joining our platform. Your account has been successfully created with email: ${userEmail}.`
  }),
  
  couponCreated: (couponCode, discountValue, discountType) => ({
    subject: 'New Coupon Available!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Coupon Available!</h2>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #28a745; margin-top: 0;">Coupon Code: ${couponCode}</h3>
          <p><strong>Discount:</strong> ${discountValue}${discountType === 'percentage' ? '%' : ' Credits'}</p>
        </div>
        <p>Use this coupon code to get a discount on your next purchase!</p>
        <hr style="border: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
      </div>
    `,
    text: `New Coupon Available! Use code: ${couponCode} for ${discountValue}${discountType === 'percentage' ? '%' : ' Credits'} discount.`
  }),
  
  accountDisabled: (userName) => ({
    subject: 'Account Status Update',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc3545;">Account Status Update</h2>
        <p>Dear ${userName},</p>
        <p>Your account has been temporarily disabled by our administrators.</p>
        <p>If you believe this is an error or would like to appeal this decision, please contact our support team.</p>
        <hr style="border: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
      </div>
    `,
    text: `Dear ${userName}, Your account has been temporarily disabled by our administrators. Please contact support if you believe this is an error.`
  }),
  
  accountEnabled: (userName) => ({
    subject: 'Account Reactivated',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #28a745;">Account Reactivated</h2>
        <p>Dear ${userName},</p>
        <p>Good news! Your account has been reactivated and you can now access all platform features.</p>
        <p>Thank you for your patience.</p>
        <hr style="border: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
      </div>
    `,
    text: `Dear ${userName}, Your account has been reactivated and you can now access all platform features.`
  })
};
