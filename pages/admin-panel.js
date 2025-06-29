import { useEffect, useState } from "react";
import { auth } from "../firebase/config";
import { getFirestore, collection, getDocs } from "firebase/firestore";

export default function AdminPanel() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    auth.currentUser?.getIdTokenResult(true).then(async (token) => {
      if (!token.claims.admin) return window.location.href = "/login";

      const db = getFirestore();
      const usersCol = collection(db, "users");
      const snapshot = await getDocs(usersCol);

      const allUsers = [];
      for (const doc of snapshot.docs) {
        const data = doc.data();
        allUsers.push({ id: doc.id, ...data });
      }

      setUsers(allUsers);
    });
  }, []);

  return (
    <div>
      <h1>Admin Dashboard</h1>
      {users.map((user) => (
        <div key={user.id} style={{ border: "1px solid gray", padding: "10px", margin: "10px" }}>
          <h3>User ID: {user.id}</h3>
          <pre>{JSON.stringify(user, null, 2)}</pre>
        </div>
      ))}
    </div>
  );
}
