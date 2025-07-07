
import { adminAuth } from "../../firebase/admin";
import { sendEmail, emailTemplates } from "../../utils/emailService";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify admin authentication
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const userRecord = await adminAuth.getUser(decodedToken.uid);
    
    if (!userRecord.customClaims?.admin) {
      return res.status(403).json({ error: 'Access denied: Admin required' });
    }

    const { to, templateType, templateData, customSubject, customHtml, customText } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'Recipient email is required' });
    }

    let subject, html, text;

    if (templateType && emailTemplates[templateType]) {
      const template = emailTemplates[templateType](
        templateData?.userName || 'User',
        templateData?.userEmail || to,
        templateData?.couponCode,
        templateData?.discountValue,
        templateData?.discountType
      );
      subject = template.subject;
      html = template.html;
      text = template.text;
    } else if (customSubject && customHtml) {
      subject = customSubject;
      html = customHtml;
      text = customText || '';
    } else {
      return res.status(400).json({ error: 'Either templateType or custom email content is required' });
    }

    const result = await sendEmail(to, subject, html, text);

    if (result.success) {
      res.status(200).json({ 
        message: 'Email sent successfully', 
        messageId: result.messageId 
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to send email', 
        details: result.error 
      });
    }

  } catch (error) {
    console.error('Error in send-email API:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
