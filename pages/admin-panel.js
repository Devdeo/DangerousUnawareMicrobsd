
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
        allUsers.push({ 
          id: doc.id, 
          name: data.name || "N/A",
          email: data.email || "N/A",
          creditBalance: data.creditBalance || 0,
          createdAt: data.createdAt || new Date(),
          lastWalletUpdate: data.lastWalletUpdate || null,
          isDisabled: data.isDisabled || false,
          tasks: data.tasks || [],
          wallets: data.wallets || [],
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

    return filtered.sort((a, b) => {
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
          <h2 className={styles.sectionTitle}>User Management ({filteredUsers.length} users)</h2>
          
          {filteredUsers.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No users found matching the current filter.</p>
            </div>
          ) : (
            <div className={styles.userTable}>
              <div className={styles.tableHeader}>
                <div className={styles.headerCell}>Name</div>
                <div className={styles.headerCell}>Email</div>
                <div className={styles.headerCell}>Credits</div>
                <div className={styles.headerCell}>Status</div>
                <div className={styles.headerCell}>Created</div>
                <div className={styles.headerCell}>Last Wallet Update</div>
                <div className={styles.headerCell}>Actions</div>
              </div>
              
              {filteredUsers.map((user) => (
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
                      <input
                        type="number"
                        value={editForm.creditBalance}
                        onChange={(e) => setEditForm(prev => ({ ...prev, creditBalance: parseFloat(e.target.value) || 0 }))}
                        className={styles.editInput}
                        step="0.01"
                      />
                    ) : (
                      <div className={styles.creditBalance}>{user.creditBalance.toFixed(2)}</div>
                    )}
                  </div>
                  
                  <div className={styles.tableCell}>
                    {editingUser === user.id ? (
                      <input
                        type="checkbox"
                        checked={editForm.isDisabled}
                        onChange={(e) => setEditForm(prev => ({ ...prev, isDisabled: e.target.checked }))}
                        className={styles.checkbox}
                      />
                    ) : (
                      <span className={`${styles.statusBadge} ${user.isDisabled ? styles.disabled : styles.active}`}>
                        {user.isDisabled ? "Disabled" : "Active"}
                      </span>
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
          )}
        </div>
      </main>
    </div>
  );
}
