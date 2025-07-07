
import { useEffect, useState } from "react";
import { auth } from "../firebase/config";
import { getFirestore, collection, getDocs, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import styles from "../styles/AdminPanel.module.css";

export default function UserManagement() {
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
          walletHistory: wallets,
          taskHistory: tasks,
          liveHistory: data.liveHistory || [],
          ...data 
        });
      }

      setUsers(allUsers);
    } catch (error) {
      console.error("Failed to fetch users:", error);
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
      
      // Send email notification
      const user = users.find(u => u.id === userId);
      if (user?.email) {
        await sendUserStatusEmail(user, !currentStatus);
      }
    } catch (error) {
      console.error("Failed to toggle user status:", error);
      alert("Failed to update user status. Please try again.");
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: null }));
    }
  };

  const sendUserStatusEmail = async (user, isDisabled) => {
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          to: user.email,
          templateType: isDisabled ? 'accountDisabled' : 'accountEnabled',
          templateData: {
            userName: user.name || 'User',
            userEmail: user.email
          }
        }),
      });

      if (!response.ok) {
        console.error('Failed to send status email');
      }
    } catch (error) {
      console.error('Error sending status email:', error);
    }
  };

  const handleSendBulkEmail = async () => {
    if (!confirm('Are you sure you want to send bulk emails to all filtered users?')) {
      return;
    }

    setActionLoading(prev => ({ ...prev, 'bulk-email': 'sending' }));
    
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/send-bulk-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetUsers: filter === 'all' ? 'all' : filter,
          templateType: 'userRegistration',
          templateData: {}
        }),
      });

      const result = await response.json();
      if (response.ok) {
        alert(`Bulk email sent! Successful: ${result.results.successful.length}, Failed: ${result.results.failed.length}`);
      } else {
        alert(`Failed to send bulk email: ${result.error}`);
      }
    } catch (error) {
      console.error('Error sending bulk email:', error);
      alert('Failed to send bulk email. Please try again.');
    } finally {
      setActionLoading(prev => ({ ...prev, 'bulk-email': null }));
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
        <p>Loading user management...</p>
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
        <title>User Management - Admin Dashboard</title>
        <meta name="description" content="User management for admin dashboard" />
      </Head>

      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>User Management</h1>
          <div className={styles.userInfo}>
            <Link href="/admin-panel" className={styles.navLink}>
              Overview
            </Link>
            <Link href="/coupon-management" className={styles.navLink}>
              Coupons
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
            
            <button 
              onClick={handleSendBulkEmail}
              className={`${styles.actionBtn} ${styles.emailBtn}`}
              disabled={actionLoading['bulk-email'] === 'sending' || filteredUsers.length === 0}
            >
              {actionLoading['bulk-email'] === 'sending' ? 'Sending...' : 'Send Bulk Email'}
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
      </main>

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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
