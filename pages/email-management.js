
import { useEffect, useState } from "react";
import { auth } from "../firebase/config";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import styles from "../styles/AdminPanel.module.css";

export default function EmailManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [emailForm, setEmailForm] = useState({
    subject: '',
    message: '',
    htmlMessage: ''
  });
  const [manualEmails, setManualEmails] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectAll, setSelectAll] = useState(false);
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
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        
        // Skip admin users
        if (data.isAdmin || data.role === 'admin') {
          return;
        }

        allUsers.push({ 
          id: doc.id, 
          name: data.name || "N/A",
          email: data.email || "N/A",
          isDisabled: data.isDisabled || false,
          createdAt: data.createdAt || new Date(),
          ...data 
        });
      });

      setUsers(allUsers);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  };

  const handleUserSelection = (userId) => {
    setSelectedUsers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  const handleSelectAll = () => {
    const filteredUsers = getFilteredUsers();
    if (selectAll) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(user => user.id));
    }
    setSelectAll(!selectAll);
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();
    
    // Parse manual emails
    const manualEmailList = manualEmails
      .split(/[,;\n]/)
      .map(email => email.trim())
      .filter(email => email && email.includes('@'));

    const totalRecipients = selectedUsers.length + manualEmailList.length;
    
    if (totalRecipients === 0) {
      alert('Please select at least one user or enter manual email addresses.');
      return;
    }

    if (!emailForm.subject.trim() || !emailForm.message.trim()) {
      alert('Please provide both subject and message.');
      return;
    }

    setEmailLoading(true);

    try {
      const token = await auth.currentUser.getIdToken();
      
      // Send emails to selected users
      const userEmailPromises = selectedUsers.map(async (userId) => {
        const user = users.find(u => u.id === userId);
        if (!user || !user.email) return { success: false, userId, error: 'No email found' };

        const htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">${emailForm.subject}</h2>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              ${emailForm.htmlMessage || emailForm.message.replace(/\n/g, '<br>')}
            </div>
            <hr style="border: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">This message was sent from the admin panel.</p>
          </div>
        `;

        const response = await fetch('/api/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            to: user.email,
            customSubject: emailForm.subject,
            customHtml: htmlContent,
            customText: emailForm.message
          })
        });

        const result = await response.json();
        return { 
          success: response.ok, 
          userId, 
          email: user.email, 
          name: user.name,
          error: response.ok ? null : result.error 
        };
      });

      // Send emails to manual email addresses
      const manualEmailPromises = manualEmailList.map(async (email) => {
        const htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">${emailForm.subject}</h2>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              ${emailForm.htmlMessage || emailForm.message.replace(/\n/g, '<br>')}
            </div>
            <hr style="border: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">This message was sent from the admin panel.</p>
          </div>
        `;

        const response = await fetch('/api/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            to: email,
            customSubject: emailForm.subject,
            customHtml: htmlContent,
            customText: emailForm.message
          })
        });

        const result = await response.json();
        return { 
          success: response.ok, 
          email: email, 
          name: 'Manual Entry',
          error: response.ok ? null : result.error 
        };
      });

      const allPromises = [...userEmailPromises, ...manualEmailPromises];
      const results = await Promise.all(allPromises);
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      let message = `Email sending completed!\n`;
      message += `Successful: ${successful.length}\n`;
      message += `Failed: ${failed.length}`;
      
      if (failed.length > 0) {
        message += `\n\nFailed recipients:\n`;
        failed.forEach(f => {
          message += `- ${f.name} (${f.email}): ${f.error}\n`;
        });
      }

      alert(message);

      if (successful.length > 0) {
        // Clear form and selections after successful sends
        setEmailForm({ subject: '', message: '', htmlMessage: '' });
        setSelectedUsers([]);
        setSelectAll(false);
        setManualEmails('');
      }

    } catch (error) {
      console.error('Failed to send emails:', error);
      alert('Failed to send emails. Please try again.');
    } finally {
      setEmailLoading(false);
    }
  };

  const getFilteredUsers = () => {
    let filtered = users;
    
    if (filter === "disabled") {
      filtered = users.filter(user => user.isDisabled);
    } else if (filter === "active") {
      filtered = users.filter(user => !user.isDisabled);
    }

    if (searchTerm.trim()) {
      filtered = filtered.filter(user => 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
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
        <p>Loading email management...</p>
      </div>
    );
  }

  const filteredUsers = getFilteredUsers();
  const selectedUserCount = selectedUsers.length;
  const selectedUserDetails = users.filter(user => selectedUsers.includes(user.id));
  const manualEmailCount = manualEmails.split(/[,;\n]/).map(email => email.trim()).filter(email => email && email.includes('@')).length;
  const totalRecipientCount = selectedUserCount + manualEmailCount;

  return (
    <div className={styles.container}>
      <Head>
        <title>Email Management - Admin Dashboard</title>
        <meta name="description" content="Email management for admin dashboard" />
      </Head>

      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>Email Management</h1>
          <div className={styles.userInfo}>
            <Link href="/admin-panel" className={styles.navLink}>
              Overview
            </Link>
            <Link href="/user-management" className={styles.navLink}>
              Users
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
            <h3>Filtered Users</h3>
            <p className={styles.statNumber}>{filteredUsers.length}</p>
          </div>
          <div className={styles.statCard}>
            <h3>Selected Users</h3>
            <p className={styles.statNumber}>{selectedUserCount}</p>
          </div>
          <div className={styles.statCard}>
            <h3>Manual Emails</h3>
            <p className={styles.statNumber}>
              {manualEmails.split(/[,;\n]/).map(email => email.trim()).filter(email => email && email.includes('@')).length}
            </p>
          </div>
        </div>

        <div className={styles.emailSection}>
          <div className={styles.userSelectionPanel}>
            <h2 className={styles.sectionTitle}>Select Recipients</h2>
            
            <div className={styles.controls}>
              <div className={styles.filterControls}>
                <input
                  type="text"
                  placeholder="Search users by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={styles.searchInput}
                />
                
                <select 
                  value={filter} 
                  onChange={(e) => setFilter(e.target.value)}
                  className={styles.filterSelect}
                >
                  <option value="all">All Users</option>
                  <option value="active">Active Users</option>
                  <option value="disabled">Disabled Users</option>
                </select>
                
                <button 
                  onClick={handleSelectAll}
                  className={`${styles.actionBtn} ${styles.selectAllBtn}`}
                >
                  {selectAll ? 'Deselect All' : 'Select All Filtered'}
                </button>
              </div>
            </div>

            <div className={styles.userList}>
              {filteredUsers.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No users found matching the current filter.</p>
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <div key={user.id} className={styles.userItem}>
                    <label className={styles.userCheckbox}>
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => handleUserSelection(user.id)}
                        className={styles.checkbox}
                      />
                      <div className={styles.userInfo}>
                        <div className={styles.userName}>{user.name}</div>
                        <div className={styles.userEmail}>{user.email}</div>
                        <div className={styles.userMeta}>
                          <span className={`${styles.statusBadge} ${user.isDisabled ? styles.disabled : styles.active}`}>
                            {user.isDisabled ? 'Disabled' : 'Active'}
                          </span>
                          <span className={styles.userDate}>Joined: {formatDate(user.createdAt)}</span>
                        </div>
                      </div>
                    </label>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className={styles.emailComposerPanel}>
            <h2 className={styles.sectionTitle}>Compose Email</h2>
            
            {(selectedUserCount > 0 || manualEmailCount > 0) && (
              <div className={styles.selectedUsersPreview}>
                <h3>Recipients ({totalRecipientCount} total)</h3>
                {selectedUserCount > 0 && (
                  <div>
                    <h4>Selected Users ({selectedUserCount})</h4>
                    <div className={styles.selectedUsersList}>
                      {selectedUserDetails.slice(0, 3).map(user => (
                        <div key={user.id} className={styles.selectedUserTag}>
                          {user.name} ({user.email})
                        </div>
                      ))}
                      {selectedUserCount > 3 && (
                        <div className={styles.selectedUserTag}>
                          +{selectedUserCount - 3} more users...
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {manualEmailCount > 0 && (
                  <div>
                    <h4>Manual Emails ({manualEmailCount})</h4>
                    <div className={styles.selectedUsersList}>
                      {manualEmails.split(/[,;\n]/).map(email => email.trim()).filter(email => email && email.includes('@')).slice(0, 3).map((email, index) => (
                        <div key={index} className={styles.selectedUserTag}>
                          {email}
                        </div>
                      ))}
                      {manualEmailCount > 3 && (
                        <div className={styles.selectedUserTag}>
                          +{manualEmailCount - 3} more emails...
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSendEmail} className={styles.emailForm}>
              <div className={styles.formGroup}>
                <label htmlFor="manualEmails">Additional Email Addresses</label>
                <textarea
                  id="manualEmails"
                  value={manualEmails}
                  onChange={(e) => setManualEmails(e.target.value)}
                  placeholder="Enter additional email addresses separated by commas, semicolons, or new lines&#10;example@email.com, another@email.com&#10;third@email.com"
                  className={styles.messageTextarea}
                  rows="3"
                />
                <small className={styles.helpText}>
                  Enter email addresses separated by commas, semicolons, or new lines. These will be added to the selected users above.
                </small>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="emailSubject">Subject *</label>
                <input
                  id="emailSubject"
                  type="text"
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Enter email subject"
                  className={styles.formInput}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="emailMessage">Message *</label>
                <textarea
                  id="emailMessage"
                  value={emailForm.message}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Enter your message here..."
                  className={styles.messageTextarea}
                  rows="8"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="emailHtmlMessage">HTML Message (Optional)</label>
                <textarea
                  id="emailHtmlMessage"
                  value={emailForm.htmlMessage}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, htmlMessage: e.target.value }))}
                  placeholder="Enter HTML formatted message (optional)..."
                  className={styles.messageTextarea}
                  rows="6"
                />
                <small className={styles.helpText}>
                  If provided, this will be used instead of the plain text message above.
                </small>
              </div>

              <div className={styles.formActions}>
                <button
                  type="submit"
                  disabled={emailLoading || totalRecipientCount === 0}
                  className={`${styles.actionBtn} ${styles.sendBtn}`}
                >
                  {emailLoading ? 'Sending...' : `Send Email to ${totalRecipientCount} Recipient${totalRecipientCount !== 1 ? 's' : ''}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
