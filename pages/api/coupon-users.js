
import { adminAuth, adminDB } from "../../firebase/admin";

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify the user is authenticated and is an admin
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const userRecord = await adminAuth.getUser(decodedToken.uid);
    
    if (!userRecord.customClaims?.admin) {
      return res.status(403).json({ error: 'Access denied: Admin required' });
    }

    const { couponCode } = req.query;

    if (!couponCode) {
      return res.status(400).json({ error: 'Coupon code is required' });
    }

    // Get all users
    const usersSnapshot = await adminDB.collection('users').get();
    const couponUsers = [];

    // Check each user's transactions/orders for this coupon usage
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      
      // Skip admin users
      if (userData.isAdmin || userData.role === 'admin') {
        continue;
      }

      // Check user's wallets subcollection for coupon usage
      const walletsSnapshot = await adminDB
        .collection('users')
        .doc(userDoc.id)
        .collection('wallets')
        .where('couponCode', '==', couponCode.toUpperCase())
        .get();

      if (!walletsSnapshot.empty) {
        const couponTransactions = walletsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        couponUsers.push({
          userId: userDoc.id,
          name: userData.name || 'N/A',
          email: userData.email || 'N/A',
          couponTransactions: couponTransactions,
          totalUsage: couponTransactions.length
        });
      }

      // Also check if coupon code is stored in user's couponHistory field
      if (userData.couponHistory && Array.isArray(userData.couponHistory)) {
        const couponUsage = userData.couponHistory.filter(
          coupon => coupon.code && coupon.code.toUpperCase() === couponCode.toUpperCase()
        );

        if (couponUsage.length > 0 && !couponUsers.find(u => u.userId === userDoc.id)) {
          couponUsers.push({
            userId: userDoc.id,
            name: userData.name || 'N/A',
            email: userData.email || 'N/A',
            couponHistory: couponUsage,
            totalUsage: couponUsage.length
          });
        }
      }
    }

    res.status(200).json({ 
      couponCode: couponCode.toUpperCase(),
      users: couponUsers,
      totalUsers: couponUsers.length
    });

  } catch (error) {
    console.error('Error fetching coupon users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
