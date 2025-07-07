
import { useEffect, useState } from "react";
import { auth } from "../firebase/config";
import { getFirestore, collection, getDocs, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import styles from "../styles/AdminPanel.module.css";

export default function CouponManagement() {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [couponForm, setCouponForm] = useState({
    code: '',
    discountType: 'percentage',
    discountValue: '',
    expirationDate: '',
    usageLimit: '',
    isActive: true
  });
  const [couponLoading, setCouponLoading] = useState(false);
  const [coupons, setCoupons] = useState([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [editCouponForm, setEditCouponForm] = useState({});
  const [viewingCoupon, setViewingCoupon] = useState(null);
  const [showCouponViewModal, setShowCouponViewModal] = useState(false);
  const [couponUsers, setCouponUsers] = useState([]);
  const [loadingCouponUsers, setLoadingCouponUsers] = useState(false);
  const [showCouponUsersModal, setShowCouponUsersModal] = useState(false);
  const [selectedCouponForUsers, setSelectedCouponForUsers] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      if (!auth.currentUser) {
        router.push("/");
        return;
      }

      try {
        const token = await auth.currentUser.getIdTokenResult(true);
        if (!token.claims.admin) {
          router.push("/");
          return;
        }

        setCurrentUser(auth.currentUser);
        await fetchCoupons();
      } catch (error) {
        console.error("Auth check failed:", error);
        router.push("/");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const fetchCoupons = async () => {
    setCouponsLoading(true);
    try {
      const db = getFirestore();
      const couponsCol = collection(db, "coupons");
      const snapshot = await getDocs(couponsCol);

      const allCoupons = [];
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        allCoupons.push({
          id: doc.id,
          ...data
        });
      });

      setCoupons(allCoupons);
    } catch (error) {
      console.error("Failed to fetch coupons:", error);
    } finally {
      setCouponsLoading(false);
    }
  };

  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    setCouponLoading(true);

    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/create-coupon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(couponForm)
      });

      const data = await response.json();

      if (response.ok) {
        alert('Coupon created successfully!');
        setShowCouponModal(false);
        setCouponForm({
          code: '',
          discountType: 'percentage',
          discountValue: '',
          expirationDate: '',
          usageLimit: '',
          isActive: true
        });
        await fetchCoupons();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to create coupon:', error);
      alert('Failed to create coupon. Please try again.');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleViewCoupon = (coupon) => {
    setViewingCoupon(coupon);
    setShowCouponViewModal(true);
  };

  const handleEditCoupon = (coupon) => {
    setEditingCoupon(coupon.id);
    setEditCouponForm({
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      expirationDate: coupon.expirationDate ? 
        (coupon.expirationDate.toDate ? 
          coupon.expirationDate.toDate().toISOString().split('T')[0] : 
          new Date(coupon.expirationDate).toISOString().split('T')[0]) : '',
      usageLimit: coupon.usageLimit || '',
      isActive: coupon.isActive
    });
  };

  const handleSaveCouponEdit = async (couponId) => {
    setActionLoading(prev => ({ ...prev, [couponId]: 'saving' }));
    
    try {
      const db = getFirestore();
      const updateData = { ...editCouponForm };
      
      if (updateData.expirationDate) {
        updateData.expirationDate = new Date(updateData.expirationDate);
      } else {
        updateData.expirationDate = null;
      }
      
      if (updateData.usageLimit) {
        updateData.usageLimit = Number(updateData.usageLimit);
      } else {
        updateData.usageLimit = null;
      }
      
      updateData.discountValue = Number(updateData.discountValue);
      
      await updateDoc(doc(db, "coupons", couponId), updateData);
      
      setCoupons(coupons.map(coupon => 
        coupon.id === couponId ? { ...coupon, ...updateData } : coupon
      ));
      setEditingCoupon(null);
      setEditCouponForm({});
    } catch (error) {
      console.error("Failed to update coupon:", error);
      alert("Failed to update coupon. Please try again.");
    } finally {
      setActionLoading(prev => ({ ...prev, [couponId]: null }));
    }
  };

  const handleCancelCouponEdit = () => {
    setEditingCoupon(null);
    setEditCouponForm({});
  };

  const handleDeleteCoupon = async (couponId) => {
    if (!confirm("Are you sure you want to delete this coupon? This action cannot be undone.")) {
      return;
    }

    setActionLoading(prev => ({ ...prev, [couponId]: 'deleting' }));
    try {
      const db = getFirestore();
      await deleteDoc(doc(db, "coupons", couponId));
      setCoupons(coupons.filter(coupon => coupon.id !== couponId));
    } catch (error) {
      console.error("Failed to delete coupon:", error);
      alert("Failed to delete coupon. Please try again.");
    } finally {
      setActionLoading(prev => ({ ...prev, [couponId]: null }));
    }
  };

  const handleViewCouponUsers = async (coupon) => {
    setSelectedCouponForUsers(coupon);
    setLoadingCouponUsers(true);
    setShowCouponUsersModal(true);

    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(`/api/coupon-users?couponCode=${encodeURIComponent(coupon.code)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setCouponUsers(data.users);
      } else {
        alert(`Error: ${data.error}`);
        setCouponUsers([]);
      }
    } catch (error) {
      console.error('Failed to fetch coupon users:', error);
      alert('Failed to fetch coupon users. Please try again.');
      setCouponUsers([]);
    } finally {
      setLoadingCouponUsers(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    if (typeof date === 'string') {
      return new Date(date).toLocaleDateString();
    }
    if (date.toDate) {
      return date.toDate().toLocaleDateString();
    }
    return new Date(date).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading coupon management...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>Coupon Management - Admin Dashboard</title>
        <meta name="description" content="Coupon management for admin dashboard" />
      </Head>

      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>Coupon Management</h1>
          <div className={styles.userInfo}>
            <Link href="/admin-panel" className={styles.navLink}>
              Overview
            </Link>
            <Link href="/user-management" className={styles.navLink}>
              Users
            </Link>
            <span className={styles.welcome}>
              Welcome, {currentUser?.email}
            </span>
            <button onClick={handleLogout} className={styles.logoutBtn}>
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.stats}>
          <div className={styles.statCard}>
            <h3>Total Coupons</h3>
            <p className={styles.statNumber}>{coupons.length}</p>
          </div>
          <div className={styles.statCard}>
            <h3>Active Coupons</h3>
            <p className={styles.statNumber}>{coupons.filter(c => c.isActive).length}</p>
          </div>
          <div className={styles.statCard}>
            <h3>Expired Coupons</h3>
            <p className={styles.statNumber}>
              {coupons.filter(c => c.expirationDate && new Date(c.expirationDate.toDate ? c.expirationDate.toDate() : c.expirationDate) < new Date()).length}
            </p>
          </div>
          <div className={styles.statCard}>
            <h3>Total Usage</h3>
            <p className={styles.statNumber}>{coupons.reduce((sum, c) => sum + (c.usedCount || 0), 0)}</p>
          </div>
        </div>

        <div className={styles.controls}>
          <div className={styles.filterControls}>
            <button 
              onClick={() => setShowCouponModal(true)}
              className={styles.createCouponBtn}
            >
              Create Coupon
            </button>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Coupon Management ({coupons.length} coupons)</h2>
          
          {couponsLoading ? (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <p>Loading coupons...</p>
            </div>
          ) : coupons.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No coupons found. Create your first coupon to get started.</p>
            </div>
          ) : (
            <div className={styles.couponTable}>
              <div className={styles.tableHeader}>
                <div className={styles.headerCell}>Code</div>
                <div className={styles.headerCell}>Type</div>
                <div className={styles.headerCell}>Value</div>
                <div className={styles.headerCell}>Usage</div>
                <div className={styles.headerCell}>Expiration</div>
                <div className={styles.headerCell}>Status</div>
                <div className={styles.headerCell}>Created</div>
                <div className={styles.headerCell}>Actions</div>
              </div>
              
              {coupons.map((coupon) => (
                <div key={coupon.id} className={styles.tableRow}>
                  <div className={styles.tableCell}>
                    <div className={styles.couponCode}>{coupon.code}</div>
                  </div>
                  
                  <div className={styles.tableCell}>
                    {editingCoupon === coupon.id ? (
                      <select
                        value={editCouponForm.discountType}
                        onChange={(e) => setEditCouponForm(prev => ({ ...prev, discountType: e.target.value }))}
                        className={styles.editInput}
                      >
                        <option value="percentage">Percentage</option>
                        <option value="fixed">Fixed Amount</option>
                      </select>
                    ) : (
                      <div className={styles.discountType}>
                        {coupon.discountType === 'percentage' ? 'Percentage' : 'Fixed Amount'}
                      </div>
                    )}
                  </div>
                  
                  <div className={styles.tableCell}>
                    {editingCoupon === coupon.id ? (
                      <input
                        type="number"
                        value={editCouponForm.discountValue}
                        onChange={(e) => setEditCouponForm(prev => ({ ...prev, discountValue: e.target.value }))}
                        className={styles.editInput}
                        min="0"
                        max={editCouponForm.discountType === 'percentage' ? '100' : undefined}
                        step="0.01"
                      />
                    ) : (
                      <div className={styles.discountValue}>
                        {coupon.discountType === 'percentage' 
                          ? `${coupon.discountValue}%` 
                          : `${coupon.discountValue} Credits`}
                      </div>
                    )}
                  </div>
                  
                  <div className={styles.tableCell}>
                    <div className={styles.usageInfo}>
                      {coupon.usedCount || 0}
                      {coupon.usageLimit ? ` / ${coupon.usageLimit}` : ' / ∞'}
                    </div>
                  </div>
                  
                  <div className={styles.tableCell}>
                    {editingCoupon === coupon.id ? (
                      <input
                        type="date"
                        value={editCouponForm.expirationDate}
                        onChange={(e) => setEditCouponForm(prev => ({ ...prev, expirationDate: e.target.value }))}
                        className={styles.editInput}
                      />
                    ) : (
                      <div className={styles.dateText}>
                        {coupon.expirationDate 
                          ? formatDate(coupon.expirationDate) 
                          : 'No expiration'}
                      </div>
                    )}
                  </div>
                  
                  <div className={styles.tableCell}>
                    {editingCoupon === coupon.id ? (
                      <label className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={editCouponForm.isActive}
                          onChange={(e) => setEditCouponForm(prev => ({ ...prev, isActive: e.target.checked }))}
                          className={styles.checkbox}
                        />
                        Active
                      </label>
                    ) : (
                      <span className={`${styles.statusBadge} ${coupon.isActive ? styles.active : styles.inactive}`}>
                        {coupon.isActive ? 'Active' : 'Inactive'}
                      </span>
                    )}
                  </div>
                  
                  <div className={styles.tableCell}>
                    <div className={styles.dateText}>{formatDate(coupon.createdAt)}</div>
                  </div>
                  
                  <div className={styles.tableCell}>
                    <div className={styles.actionButtons}>
                      {editingCoupon === coupon.id ? (
                        <>
                          <button
                            onClick={() => handleSaveCouponEdit(coupon.id)}
                            className={`${styles.actionBtn} ${styles.saveBtn}`}
                            disabled={actionLoading[coupon.id] === 'saving'}
                          >
                            {actionLoading[coupon.id] === 'saving' ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={handleCancelCouponEdit}
                            className={`${styles.actionBtn} ${styles.cancelBtn}`}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleViewCoupon(coupon)}
                            className={`${styles.actionBtn} ${styles.viewBtn}`}
                            title="View Coupon Details"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleViewCouponUsers(coupon)}
                            className={`${styles.actionBtn} ${styles.usersBtn}`}
                            title="View Users Who Used This Coupon"
                          >
                            Users
                          </button>
                          <button
                            onClick={() => handleEditCoupon(coupon)}
                            className={`${styles.actionBtn} ${styles.editBtn}`}
                            title="Edit Coupon"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteCoupon(coupon.id)}
                            className={`${styles.actionBtn} ${styles.deleteBtn}`}
                            disabled={actionLoading[coupon.id] === 'deleting'}
                            title="Delete Coupon"
                          >
                            {actionLoading[coupon.id] === 'deleting' ? 'Deleting...' : 'Delete'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {showCouponModal && (
        <div className={styles.modalOverlay} onClick={() => setShowCouponModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Create New Coupon</h2>
              <button onClick={() => setShowCouponModal(false)} className={styles.closeBtn}>×</button>
            </div>
            
            <div className={styles.modalContent}>
              <form onSubmit={handleCreateCoupon} className={styles.couponForm}>
                <div className={styles.formGroup}>
                  <label htmlFor="couponCode">Coupon Code *</label>
                  <input
                    id="couponCode"
                    type="text"
                    value={couponForm.code}
                    onChange={(e) => setCouponForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    placeholder="Enter coupon code (e.g., SAVE20)"
                    className={styles.formInput}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="discountType">Discount Type *</label>
                  <select
                    id="discountType"
                    value={couponForm.discountType}
                    onChange={(e) => setCouponForm(prev => ({ ...prev, discountType: e.target.value }))}
                    className={styles.formInput}
                    required
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="discountValue">
                    Discount Value * {couponForm.discountType === 'percentage' ? '(%)' : '(Credits)'}
                  </label>
                  <input
                    id="discountValue"
                    type="number"
                    value={couponForm.discountValue}
                    onChange={(e) => setCouponForm(prev => ({ ...prev, discountValue: e.target.value }))}
                    placeholder={couponForm.discountType === 'percentage' ? 'e.g., 20' : 'e.g., 5.00'}
                    className={styles.formInput}
                    min="0"
                    max={couponForm.discountType === 'percentage' ? '100' : undefined}
                    step="0.01"
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="expirationDate">Expiration Date</label>
                  <input
                    id="expirationDate"
                    type="date"
                    value={couponForm.expirationDate}
                    onChange={(e) => setCouponForm(prev => ({ ...prev, expirationDate: e.target.value }))}
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="usageLimit">Usage Limit</label>
                  <input
                    id="usageLimit"
                    type="number"
                    value={couponForm.usageLimit}
                    onChange={(e) => setCouponForm(prev => ({ ...prev, usageLimit: e.target.value }))}
                    placeholder="Leave empty for unlimited use"
                    className={styles.formInput}
                    min="1"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={couponForm.isActive}
                      onChange={(e) => setCouponForm(prev => ({ ...prev, isActive: e.target.checked }))}
                      className={styles.checkbox}
                    />
                    Active
                  </label>
                </div>

                <div className={styles.formActions}>
                  <button
                    type="button"
                    onClick={() => setShowCouponModal(false)}
                    className={`${styles.actionBtn} ${styles.cancelBtn}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={couponLoading}
                    className={`${styles.actionBtn} ${styles.saveBtn}`}
                  >
                    {couponLoading ? 'Creating...' : 'Create Coupon'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showCouponViewModal && viewingCoupon && (
        <div className={styles.modalOverlay} onClick={() => setShowCouponViewModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Coupon Details: {viewingCoupon.code}</h2>
              <button onClick={() => setShowCouponViewModal(false)} className={styles.closeBtn}>×</button>
            </div>
            
            <div className={styles.modalContent}>
              <div className={styles.userDetailsSection}>
                <h3>Coupon Information</h3>
                <div className={styles.detailRow}>
                  <strong>Code:</strong> {viewingCoupon.code}
                </div>
                <div className={styles.detailRow}>
                  <strong>Discount Type:</strong> {viewingCoupon.discountType === 'percentage' ? 'Percentage' : 'Fixed Amount'}
                </div>
                <div className={styles.detailRow}>
                  <strong>Discount Value:</strong> {viewingCoupon.discountType === 'percentage' 
                    ? `${viewingCoupon.discountValue}%` 
                    : `${viewingCoupon.discountValue} Credits`}
                </div>
                <div className={styles.detailRow}>
                  <strong>Usage Count:</strong> {viewingCoupon.usedCount || 0}
                </div>
                <div className={styles.detailRow}>
                  <strong>Usage Limit:</strong> {viewingCoupon.usageLimit || 'Unlimited'}
                </div>
                <div className={styles.detailRow}>
                  <strong>Expiration Date:</strong> {viewingCoupon.expirationDate 
                    ? formatDate(viewingCoupon.expirationDate) 
                    : 'No expiration'}
                </div>
                <div className={styles.detailRow}>
                  <strong>Status:</strong> 
                  <span className={`${styles.statusBadge} ${viewingCoupon.isActive ? styles.active : styles.inactive}`}>
                    {viewingCoupon.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <strong>Created At:</strong> {formatDate(viewingCoupon.createdAt)}
                </div>
                <div className={styles.detailRow}>
                  <strong>Created By:</strong> {viewingCoupon.createdBy || 'N/A'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCouponUsersModal && selectedCouponForUsers && (
        <div className={styles.modalOverlay} onClick={() => setShowCouponUsersModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Users Who Used Coupon: {selectedCouponForUsers.code}</h2>
              <button onClick={() => setShowCouponUsersModal(false)} className={styles.closeBtn}>×</button>
            </div>
            
            <div className={styles.modalContent}>
              {loadingCouponUsers ? (
                <div className={styles.loading}>
                  <div className={styles.spinner}></div>
                  <p>Loading users...</p>
                </div>
              ) : couponUsers.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No users have used this coupon yet.</p>
                </div>
              ) : (
                <div className={styles.userDetailsSection}>
                  <h3>Total Users: {couponUsers.length}</h3>
                  <div className={styles.couponUsersList}>
                    {couponUsers.map((user, index) => (
                      <div key={user.userId} className={styles.couponUserItem}>
                        <div className={styles.detailRow}>
                          <strong>User #{index + 1}</strong>
                        </div>
                        <div className={styles.detailRow}>
                          <strong>Name:</strong> {user.name}
                        </div>
                        <div className={styles.detailRow}>
                          <strong>Email:</strong> {user.email}
                        </div>
                        <div className={styles.detailRow}>
                          <strong>Total Usage:</strong> {user.totalUsage} time(s)
                        </div>
                        {user.couponTransactions && user.couponTransactions.length > 0 && (
                          <div className={styles.transactionDetails}>
                            <strong>Transactions:</strong>
                            {user.couponTransactions.map((transaction, txIndex) => (
                              <div key={txIndex} className={styles.transactionItem}>
                                <div>Amount: {transaction.quantity || transaction.amount || 'N/A'}</div>
                                <div>Date: {formatDate(transaction.timestamp || transaction.createdAt)}</div>
                                {transaction.description && <div>Description: {transaction.description}</div>}
                              </div>
                            ))}
                          </div>
                        )}
                        {user.couponHistory && user.couponHistory.length > 0 && (
                          <div className={styles.transactionDetails}>
                            <strong>Coupon History:</strong>
                            {user.couponHistory.map((couponUse, chIndex) => (
                              <div key={chIndex} className={styles.transactionItem}>
                                <div>Used: {formatDate(couponUse.usedAt || couponUse.timestamp)}</div>
                                {couponUse.discountAmount && <div>Discount: {couponUse.discountAmount}</div>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
