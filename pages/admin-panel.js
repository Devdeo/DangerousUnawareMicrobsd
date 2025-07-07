
import { useEffect, useState } from "react";
import { auth } from "../firebase/config";
import { getFirestore, collection, getDocs, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useRouter } from "next/router";
import Head from "next/head";
import styles from "../styles/AdminPanel.module.css";

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage] = useState(10);
  const [viewingUser, setViewingUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
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
        await fetchUsers();
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

  const fetchUsers = async () => {
    try {
      const db = getFirestore();
      const usersCol = collection(db, "users");
      const snapshot = await getDocs(usersCol);

      const allUsers = [];
      for (const doc of snapshot.docs) {
        const data = doc.data();
        
        // Skip admin users
        if (data.isAdmin || data.role === 'admin') {
          continue;
        }

        // Fetch tasks subcollection
        const tasksCol = collection(db, "users", doc.id, "tasks");
        const tasksSnapshot = await getDocs(tasksCol);
        const tasks = tasksSnapshot.docs.map(taskDoc => ({
          id: taskDoc.id,
          ...taskDoc.data()
        }));

        // Fetch wallets subcollection
        const walletsCol = collection(db, "users", doc.id, "wallets");
        const walletsSnapshot = await getDocs(walletsCol);
        const wallets = walletsSnapshot.docs.map(walletDoc => ({
          id: walletDoc.id,
          ...walletDoc.data()
        }));
        
        allUsers.push({ 
          id: doc.id, 
          name: data.name || "N/A",
          email: data.email || "N/A",
          creditBalance: data.creditBalance || 0,
          createdAt: data.createdAt || new Date(),
          lastWalletUpdate: data.lastWalletUpdate || null,
          isDisabled: data.isDisabled || false,
          tasks: tasks,
          wallets: wallets,
          walletHistory: wallets, // Use wallets subcollection for wallet history
          taskHistory: tasks, // Use tasks subcollection for task history
          liveHistory: data.liveHistory || [],
          ...data 
        });
      }

      setUsers(allUsers);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  };

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

  const handleDeleteUser = async (userId) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      return;
    }

    setActionLoading(prev => ({ ...prev, [userId]: 'deleting' }));
    try {
      const db = getFirestore();
      await deleteDoc(doc(db, "users", userId));
      setUsers(users.filter(user => user.id !== userId));
    } catch (error) {
      console.error("Failed to delete user:", error);
      alert("Failed to delete user. Please try again.");
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: null }));
    }
  };

  const handleEditUser = (user) => {
    setEditingUser(user.id);
    setEditForm({
      name: user.name,
      email: user.email,
      creditBalance: user.creditBalance,
      isDisabled: user.isDisabled
    });
  };

  const handleSaveEdit = async (userId) => {
    setActionLoading(prev => ({ ...prev, [userId]: 'saving' }));
    
    try {
      const db = getFirestore();
      await updateDoc(doc(db, "users", userId), editForm);
      setUsers(users.map(user => 
        user.id === userId ? { ...user, ...editForm } : user
      ));
      setEditingUser(null);
      setEditForm({});
    } catch (error) {
      console.error("Failed to update user:", error);
      alert("Failed to update user. Please try again.");
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: null }));
    }
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setEditForm({});
  };

  const handleViewUser = (user) => {
    setViewingUser(user);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setViewingUser(null);
  };

  const handleToggleDisableUser = async (userId, currentStatus) => {
    setActionLoading(prev => ({ ...prev, [userId]: 'toggling' }));
    
    try {
      const db = getFirestore();
      await updateDoc(doc(db, "users", userId), { isDisabled: !currentStatus });
      setUsers(users.map(user => 
        user.id === userId ? { ...user, isDisabled: !currentStatus } : user
      ));
    } catch (error) {
      console.error("Failed to toggle user status:", error);
      alert("Failed to update user status. Please try again.");
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: null }));
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
        await fetchCoupons(); // Refresh the coupons list
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
      
      // Convert date string to Date object if provided
      if (updateData.expirationDate) {
        updateData.expirationDate = new Date(updateData.expirationDate);
      } else {
        updateData.expirationDate = null;
      }
      
      // Convert usage limit to number if provided
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

  const getFilteredUsers = () => {
    let filtered = users;
    
    if (filter === "disabled") {
      filtered = users.filter(user => user.isDisabled);
    } else if (filter === "active") {
      filtered = users.filter(user => !user.isDisabled);
    }

    const sorted = filtered.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      
      if (sortBy === "createdAt" || sortBy === "lastWalletUpdate") {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }
      
      if (sortOrder === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return sorted;
  };

  const getPaginatedUsers = () => {
    const filtered = getFilteredUsers();
    const startIndex = (currentPage - 1) * usersPerPage;
    const endIndex = startIndex + usersPerPage;
    return filtered.slice(startIndex, endIndex);
  };

  const getTotalPages = () => {
    const filtered = getFilteredUsers();
    return Math.ceil(filtered.length / usersPerPage);
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  const filteredUsers = getFilteredUsers();
  const paginatedUsers = getPaginatedUsers();
  const totalPages = getTotalPages();
  const activeUsers = users.filter(user => !user.isDisabled).length;
  const disabledUsers = users.filter(user => user.isDisabled).length;
  const totalCreditBalance = users.reduce((sum, user) => sum + (user.creditBalance || 0), 0);

  return (
    <div className={styles.container}>
      <Head>
        <title>Admin Dashboard</title>
        <meta name="description" content="Admin dashboard for user management" />
      </Head>

      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>Admin Dashboard</h1>
          <div className={styles.userInfo}>
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
            <h3>Total Users</h3>
            <p className={styles.statNumber}>{users.length}</p>
          </div>
          <div className={styles.statCard}>
            <h3>Active Users</h3>
            <p className={styles.statNumber}>{activeUsers}</p>
          </div>
          <div className={styles.statCard}>
            <h3>Disabled Users</h3>
            <p className={styles.statNumber}>{disabledUsers}</p>
          </div>
          <div className={styles.statCard}>
            <h3>Total Credits</h3>
            <p className={styles.statNumber}>{totalCreditBalance.toFixed(2)}</p>
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
            
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">All Users</option>
              <option value="active">Active Users</option>
              <option value="disabled">Disabled Users</option>
            </select>
            
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className={styles.sortSelect}
            >
              <option value="createdAt">Created Date</option>
              <option value="name">Name</option>
              <option value="email">Email</option>
              <option value="creditBalance">Credit Balance</option>
              <option value="lastWalletUpdate">Last Wallet Update</option>
            </select>
            
            <button 
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              className={styles.sortButton}
            >
              {sortOrder === "asc" ? "↑" : "↓"}
            </button>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>User Management ({filteredUsers.length} users - Page {currentPage} of {totalPages})</h2>
          
          {filteredUsers.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No users found matching the current filter.</p>
            </div>
          ) : (
            <>
              <div className={styles.userTable}>
                <div className={styles.tableHeader}>
                  <div className={styles.headerCell}>Name</div>
                  <div className={styles.headerCell}>Email</div>
                  <div className={styles.headerCell}>Credits</div>
                  <div className={styles.headerCell}>Created</div>
                  <div className={styles.headerCell}>Last Wallet Update</div>
                  <div className={styles.headerCell}>Actions</div>
                </div>
                
                {paginatedUsers.map((user) => (
                <div key={user.id} className={styles.tableRow}>
                  <div className={styles.tableCell}>
                    {editingUser === user.id ? (
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                        className={styles.editInput}
                      />
                    ) : (
                      <div className={styles.userName}>{user.name}</div>
                    )}
                  </div>
                  
                  <div className={styles.tableCell}>
                    {editingUser === user.id ? (
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                        className={styles.editInput}
                      />
                    ) : (
                      <div className={styles.userEmail}>{user.email}</div>
                    )}
                  </div>
                  
                  <div className={styles.tableCell}>
                    {editingUser === user.id ? (
                      <div className={styles.creditEditContainer}>
                        <input
                          type="number"
                          value={editForm.creditBalance}
                          onChange={(e) => setEditForm(prev => ({ ...prev, creditBalance: parseFloat(e.target.value) || 0 }))}
                          className={styles.creditInput}
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                        />
                        <span className={styles.currencyLabel}>Credits</span>
                      </div>
                    ) : (
                      <div className={styles.creditBalance}>{user.creditBalance.toFixed(2)} Credits</div>
                    )}
                  </div>
                  
                  
                  
                  <div className={styles.tableCell}>
                    <div className={styles.dateText}>{formatDate(user.createdAt)}</div>
                  </div>
                  
                  <div className={styles.tableCell}>
                    <div className={styles.dateText}>{formatDate(user.lastWalletUpdate)}</div>
                  </div>
                  
                  <div className={styles.tableCell}>
                    <div className={styles.actionButtons}>
                      {editingUser === user.id ? (
                        <>
                          <button
                            onClick={() => handleSaveEdit(user.id)}
                            className={`${styles.actionBtn} ${styles.saveBtn}`}
                            disabled={actionLoading[user.id] === 'saving'}
                          >
                            {actionLoading[user.id] === 'saving' ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className={`${styles.actionBtn} ${styles.cancelBtn}`}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleViewUser(user)}
                            className={`${styles.actionBtn} ${styles.viewBtn}`}
                            title="View User Details"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleEditUser(user)}
                            className={`${styles.actionBtn} ${styles.editBtn}`}
                            title="Edit User"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleDisableUser(user.id, user.isDisabled)}
                            className={`${styles.actionBtn} ${user.isDisabled ? styles.enableBtn : styles.disableBtn}`}
                            disabled={actionLoading[user.id] === 'toggling'}
                            title={user.isDisabled ? "Enable User" : "Disable User"}
                          >
                            {actionLoading[user.id] === 'toggling' ? 'Updating...' : (user.isDisabled ? 'Enable' : 'Disable')}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className={`${styles.actionBtn} ${styles.deleteBtn}`}
                            disabled={actionLoading[user.id] === 'deleting'}
                            title="Delete User"
                          >
                            {actionLoading[user.id] === 'deleting' ? 'Deleting...' : 'Delete'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              </div>
              
              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <button 
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className={styles.pageButton}
                  >
                    Previous
                  </button>
                  
                  <div className={styles.pageNumbers}>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`${styles.pageButton} ${currentPage === page ? styles.activePage : ''}`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  
                  <button 
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className={styles.pageButton}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
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

      {showModal && viewingUser && (
        <div className={styles.modalOverlay} onClick={handleCloseModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>User Details: {viewingUser.name}</h2>
              <button onClick={handleCloseModal} className={styles.closeBtn}>×</button>
            </div>
            
            <div className={styles.modalContent}>
              <div className={styles.userDetailsSection}>
                <h3>Basic Information</h3>
                <div className={styles.detailRow}>
                  <strong>Name:</strong> {viewingUser.name}
                </div>
                <div className={styles.detailRow}>
                  <strong>Email:</strong> {viewingUser.email}
                </div>
                <div className={styles.detailRow}>
                  <strong>Credit Balance:</strong> {viewingUser.creditBalance?.toFixed(2) || '0.00'}
                </div>
                <div className={styles.detailRow}>
                  <strong>Created At:</strong> {formatDate(viewingUser.createdAt)}
                </div>
                <div className={styles.detailRow}>
                  <strong>Last Wallet Update:</strong> {formatDate(viewingUser.lastWalletUpdate)}
                </div>
                <div className={styles.detailRow}>
                  <strong>Status:</strong> 
                  <span className={`${styles.statusBadge} ${viewingUser.isDisabled ? styles.disabled : styles.active}`}>
                    {viewingUser.isDisabled ? 'Disabled' : 'Active'}
                  </span>
                </div>
              </div>

              <div className={styles.userDetailsSection}>
                <h3>Wallet History ({viewingUser.wallets?.length || 0})</h3>
                <div className={styles.detailsList}>
                  {viewingUser.wallets && viewingUser.wallets.length > 0 ? (
                    viewingUser.wallets.map((transaction, index) => (
                      <div key={index} className={styles.walletItem}>
                        <div><strong>Balance:</strong> {transaction.balance || '0'}</div>
                        <div><strong>Description:</strong> {transaction.description || 'N/A'}</div>
                        <div><strong>Quantity:</strong> {transaction.quantity || '0'}</div>
                        <div><strong>Task ID:</strong> {transaction.taskId || 'N/A'}</div>
                        <div><strong>Type:</strong> 
                          <span className={`${styles.transactionType} ${styles[transaction.type?.toLowerCase()] || ''}`}>
                            {transaction.type || 'Unknown'}
                          </span>
                        </div>
                        <div><strong>Timestamp:</strong> {formatDate(transaction.timestamp)}</div>
                      </div>
                    ))
                  ) : (
                    <p className={styles.emptyMessage}>No wallet history found</p>
                  )}
                </div>
              </div>

              <div className={styles.userDetailsSection}>
                <h3>Task History ({viewingUser.tasks?.length || 0})</h3>
                <div className={styles.detailsList}>
                  {viewingUser.tasks && viewingUser.tasks.length > 0 ? (
                    viewingUser.tasks.map((task, index) => (
                      <div key={index} className={styles.taskItem}>
                        <div><strong>Title:</strong> {task.title || 'N/A'}</div>
                        <div><strong>Status:</strong> 
                          <span className={`${styles.taskStatus} ${styles[task.status?.toLowerCase()] || ''}`}>
                            {task.status || 'Unknown'}
                          </span>
                        </div>
                        <div><strong>Credit Cost:</strong> {task.creditCost || '0'}</div>
                        <div><strong>Duration Type:</strong> {task.durationType || 'N/A'}</div>
                        <div><strong>Hours:</strong> {task.hours || '0'}</div>
                        <div><strong>Stream Key:</strong> {task.streamKey || 'N/A'}</div>
                        <div><strong>Video ID:</strong> {task.videoId || 'N/A'}</div>
                        <div><strong>Created At:</strong> {formatDate(task.createdAt)}</div>
                        <div><strong>Created Date:</strong> {task.createdDate ? new Date(task.createdDate).toLocaleDateString() : 'N/A'}</div>
                      </div>
                    ))
                  ) : (
                    <p className={styles.emptyMessage}>No task history found</p>
                  )}
                </div>
              </div>

              <div className={styles.userDetailsSection}>
                <h3>Live History</h3>
                <div className={styles.detailsList}>
                  {viewingUser.liveHistory && viewingUser.liveHistory.length > 0 ? (
                    viewingUser.liveHistory.map((session, index) => (
                      <div key={index} className={styles.liveItem}>
                        <div><strong>Session ID:</strong> {session.id || 'N/A'}</div>
                        <div><strong>Duration:</strong> {session.duration || 'N/A'}</div>
                        <div><strong>Viewers:</strong> {session.viewers || '0'}</div>
                        <div><strong>Started:</strong> {formatDate(session.startTime)}</div>
                        <div><strong>Ended:</strong> {formatDate(session.endTime)}</div>
                      </div>
                    ))
                  ) : (
                    <p className={styles.emptyMessage}>No live history found</p>
                  )}
                </div>
              </div>

              {/* Additional sections for any other user data */}
              {Object.keys(viewingUser).filter(key => 
                !['id', 'name', 'email', 'creditBalance', 'createdAt', 'lastWalletUpdate', 'isDisabled', 'wallets', 'tasks', 'walletHistory', 'taskHistory', 'liveHistory', 'isAdmin', 'role'].includes(key)
              ).length > 0 && (
                <div className={styles.userDetailsSection}>
                  <h3>Additional Data</h3>
                  <div className={styles.detailsList}>
                    {Object.entries(viewingUser).filter(([key]) => 
                      !['id', 'name', 'email', 'creditBalance', 'createdAt', 'lastWalletUpdate', 'isDisabled', 'wallets', 'tasks', 'walletHistory', 'taskHistory', 'liveHistory', 'isAdmin', 'role'].includes(key)
                    ).map(([key, value]) => (
                      <div key={key} className={styles.detailRow}>
                        <strong>{key}:</strong> {typeof value === 'object' ? JSON.stringify(value) : String(value)}
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
