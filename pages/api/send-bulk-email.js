
import { adminAuth, adminDB } from "../../firebase/admin";
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

    const { 
      targetUsers, // 'all', 'active', 'disabled', or array of user IDs
      templateType, 
      templateData, 
      customSubject, 
      customHtml, 
      customText 
    } = req.body;

    if (!targetUsers) {
      return res.status(400).json({ error: 'Target users specification is required' });
    }

    // Get users from Firestore
    const usersSnapshot = await adminDB.collection('users').get();
    let targetUserList = [];

    if (targetUsers === 'all') {
      targetUserList = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } else if (targetUsers === 'active') {
      targetUserList = usersSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(user => !user.isDisabled);
    } else if (targetUsers === 'disabled') {
      targetUserList = usersSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(user => user.isDisabled);
    } else if (Array.isArray(targetUsers)) {
      targetUserList = usersSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(user => targetUsers.includes(user.id));
    } else {
      return res.status(400).json({ error: 'Invalid targetUsers specification' });
    }

    // Filter out admin users and users without email
    targetUserList = targetUserList.filter(user => 
      !user.isAdmin && 
      !user.role === 'admin' && 
      user.email
    );

    if (targetUserList.length === 0) {
      return res.status(400).json({ error: 'No valid users found to send emails to' });
    }

    const results = {
      successful: [],
      failed: [],
      total: targetUserList.length
    };

    // Send emails to each user
    for (const user of targetUserList) {
      try {
        let subject, html, text;

        if (templateType && emailTemplates[templateType]) {
          const template = emailTemplates[templateType](
            user.name || 'User',
            user.email,
            templateData?.couponCode,
            templateData?.discountValue,
            templateData?.discountType
          );
          subject = template.subject;
          html = template.html;
          text = template.text;
        } else if (customSubject && customHtml) {
          subject = customSubject;
          html = customHtml.replace('{userName}', user.name || 'User').replace('{userEmail}', user.email);
          text = customText?.replace('{userName}', user.name || 'User').replace('{userEmail}', user.email) || '';
        } else {
          results.failed.push({ userId: user.id, email: user.email, error: 'No valid template or custom content' });
          continue;
        }

        const result = await sendEmail(user.email, subject, html, text);
        
        if (result.success) {
          results.successful.push({ userId: user.id, email: user.email, messageId: result.messageId });
        } else {
          results.failed.push({ userId: user.id, email: user.email, error: result.error });
        }
      } catch (error) {
        results.failed.push({ userId: user.id, email: user.email, error: error.message });
      }
    }

    res.status(200).json({ 
      message: 'Bulk email operation completed', 
      results 
    });

  } catch (error) {
    console.error('Error in send-bulk-email API:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
