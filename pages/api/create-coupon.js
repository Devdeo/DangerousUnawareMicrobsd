
import { adminAuth, adminDB } from "../../firebase/admin";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
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

    const { code, discountType, discountValue, expirationDate, usageLimit, isActive = true } = req.body;

    // Validate required fields
    if (!code || !discountType || !discountValue) {
      return res.status(400).json({ error: 'Missing required fields: code, discountType, discountValue' });
    }

    // Validate discount type
    if (!['percentage', 'fixed'].includes(discountType)) {
      return res.status(400).json({ error: 'Invalid discount type. Must be "percentage" or "fixed"' });
    }

    // Validate discount value
    if (discountValue <= 0) {
      return res.status(400).json({ error: 'Discount value must be greater than 0' });
    }

    if (discountType === 'percentage' && discountValue > 100) {
      return res.status(400).json({ error: 'Percentage discount cannot exceed 100%' });
    }

    // Check if coupon code already exists
    const existingCoupon = await adminDB.collection('coupons').doc(code).get();
    if (existingCoupon.exists) {
      return res.status(400).json({ error: 'Coupon code already exists' });
    }

    // Create the coupon data
    const couponData = {
      code: code.toUpperCase(),
      discountType,
      discountValue: Number(discountValue),
      expirationDate: expirationDate ? new Date(expirationDate) : null,
      usageLimit: usageLimit ? Number(usageLimit) : null,
      usedCount: 0,
      isActive,
      createdAt: new Date(),
      createdBy: decodedToken.uid
    };

    // Save to Firebase
    await adminDB.collection('coupons').doc(code.toUpperCase()).set(couponData);

    res.status(201).json({ 
      message: 'Coupon created successfully', 
      coupon: couponData 
    });

  } catch (error) {
    console.error('Error creating coupon:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
