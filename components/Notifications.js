import { useEffect, useState, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { collection, query, orderBy, onSnapshot, doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/router";

export default function Notifications({ user: propUser }) {
  const [user, setUser] = useState(propUser || null);
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const containerRef = useRef();

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "notifications"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    const onClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  const unread = notifications.filter(n => !n.read).length;

  const openNotification = async (n) => {
    try {
      await setDoc(doc(db, "users", user.uid, "notifications", n.id), { read: true }, { merge: true });
    } catch (e) {
      console.warn("Couldn't mark notification read", e);
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  const markAllRead = async () => {
    const promises = notifications.filter(n => !n.read).map(n =>
      setDoc(doc(db, "users", user.uid, "notifications", n.id), { read: true }, { merge: true })
    );
    await Promise.all(promises);
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button className="ghost" onClick={() => setOpen((v) => !v)} aria-label="Notifications">
        🔔 {unread > 0 && <span className="badge" style={{ marginLeft: 6 }}>{unread}</span>}
      </button>

      {open && (
        <div className="card" style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 320, zIndex: 40 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong>Notifications</strong>
            <button className="ghost small" onClick={markAllRead}>Mark all read</button>
          </div>
          <div style={{ maxHeight: 360, overflow: "auto", marginTop: 8 }}>
            {notifications.length === 0 && <div className="small">No notifications</div>}
            {notifications.map(n => (
              <div key={n.id} style={{ padding: 8, borderBottom: "1px solid rgba(255,255,255,0.02)", cursor: "pointer" }}
                   onClick={() => openNotification(n)}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{n.title}</div>
                    <div className="small" style={{ marginTop: 4 }}>{n.body}</div>
                  </div>
                  {!n.read && <div className="badge">new</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
