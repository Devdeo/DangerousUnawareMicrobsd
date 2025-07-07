import { useEffect, useState } from "react";
import { auth } from "../firebase/config";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import styles from "../styles/AdminPanel.module.css";

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
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
      snapshot.docs.forEach(doc => {
        const data = doc.data();

        // Skip admin users
        if (data.isAdmin || data.role === 'admin') {
          return;
        }

        allUsers.push({ 
          id: doc.id, 
          ...data 
        });
      });

      setUsers(allUsers);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  };

  const fetchCoupons = async () => {
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

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  const activeUsers = users.filter(user => !user.isDisabled).length;
  const disabledUsers = users.filter(user => user.isDisabled).length;
  const totalCreditBalance = users.reduce((sum, user) => sum + (user.creditBalance || 0), 0);
  const activeCoupons = coupons.filter(c => c.isActive).length;
  const totalCouponUsage = coupons.reduce((sum, c) => sum + (c.usedCount || 0), 0);

  return (
    <div className={styles.container}>
      <Head>
        <title>Admin Dashboard</title>
        <meta name="description" content="Admin dashboard overview" />
      </Head>

      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>Admin Dashboard</h1>
          <div className={styles.userInfo}>
            <Link href="/user-management" className={styles.navLink}>
              Users
            </Link>
            <Link href="/coupon-management" className={styles.navLink}>
              Coupons
            </Link>
            <Link href="/email-management" className={styles.navLink}>
              Email
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
          <div className={styles.statCard}>
            <h3>Total Coupons</h3>
            <p className={styles.statNumber}>{coupons.length}</p>
          </div>
          <div className={styles.statCard}>
            <h3>Active Coupons</h3>
            <p className={styles.statNumber}>{activeCoupons}</p>
          </div>
          <div className={styles.statCard}>
            <h3>Coupon Usage</h3>
            <p className={styles.statNumber}>{totalCouponUsage}</p>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Quick Actions</h2>
          <div className={styles.quickActions}>
            <Link href="/user-management" className={styles.actionCard}>
              <h3>Manage Users</h3>
              <p>View, edit, and manage user accounts</p>
              <div className={styles.statHighlight}>{users.length} users</div>
            </Link>

            <Link href="/coupon-management" className={styles.actionCard}>
              <h3>Manage Coupons</h3>
              <p>Create, edit, and track coupon usage</p>
              <div className={styles.statHighlight}>{coupons.length} coupons</div>
            </Link>

            <Link href="/email-management" className={styles.actionCard}>
              <h3>Send Emails</h3>
              <p>Send custom emails to selected users</p>
              <div className={styles.statHighlight}>{users.length} users</div>
            </Link>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Recent Activity Summary</h2>
          <div className={styles.activityGrid}>
            <div className={styles.activityCard}>
              <h4>User Statistics</h4>
              <ul>
                <li>Total Users: {users.length}</li>
                <li>Active: {activeUsers}</li>
                <li>Disabled: {disabledUsers}</li>
                <li>Total Credits: {totalCreditBalance.toFixed(2)}</li>
              </ul>
            </div>

            <div className={styles.activityCard}>
              <h4>Coupon Statistics</h4>
              <ul>
                <li>Total Coupons: {coupons.length}</li>
                <li>Active: {activeCoupons}</li>
                <li>Inactive: {coupons.length - activeCoupons}</li>
                <li>Total Usage: {totalCouponUsage}</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}