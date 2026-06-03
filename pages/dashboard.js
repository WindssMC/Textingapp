import { useEffect, useState } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import { useRouter } from "next/router";

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");
  const [hasUsername, setHasUsername] = useState(false);
  const [servers, setServers] = useState([]);
  const [searchName, setSearchName] = useState("");
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [friends, setFriends] = useState([]);
  const [blocks, setBlocks] = useState([]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.push("/");
        return;
      }
      setUser(u);
      const userDoc = await getDoc(doc(db, "users", u.uid));
      if (userDoc.exists() && userDoc.data().username) {
        setHasUsername(true);
      } else {
        setHasUsername(false);
      }

      const qIn = query(collection(db, "friendRequests"), where("toUid", "==", u.uid), where("status", "==", "pending"));
      const qOut = query(collection(db, "friendRequests"), where("fromUid", "==", u.uid), where("status", "==", "pending"));
      const unsubIn = onSnapshot(qIn, (s) => setIncoming(s.docs.map(d => ({ id: d.id, ...d.data() }))));
      const unsubOut = onSnapshot(qOut, (s) => setOutgoing(s.docs.map(d => ({ id: d.id, ...d.data() }))));

      const qFriends = collection(db, "users", u.uid, "friends");
      const unsubFriends = onSnapshot(qFriends, async (snap) => {
        const f = [];
        for (const d of snap.docs) {
          const otherUid = d.id;
          const otherDoc = await getDoc(doc(db, "users", otherUid));
          f.push({ uid: otherUid, ...(otherDoc.exists() ? otherDoc.data() : {}) });
        }
        setFriends(f);
      });

      const qBlocks = collection(db, "users", u.uid, "blocks");
      const unsubBlocks = onSnapshot(qBlocks, (s) => setBlocks(s.docs.map(d => d.id)));

      const qServers = collection(db, "servers");
      const unsubServers = onSnapshot(qServers, (snap) => setServers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));

      return () => {
        unsubIn(); unsubOut(); unsubFriends(); unsubBlocks(); unsubServers();
      };
    });

    return () => unsubAuth();
  }, [router]);

  const pickUsername = async () => {
    if (!username) return alert("Enter a username");
    const unameRef = doc(db, "usernames", username);
    const unameSnap = await getDoc(unameRef);
    if (unameSnap.exists()) return alert("Username taken");
    await setDoc(unameRef, { uid: user.uid });
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      username,
    }, { merge: true });
    setHasUsername(true);
  };

  const sendFriendRequest = async () => {
    if (!searchName) return;
    if (!hasUsername) return alert("Set your username first");
    const unameSnap = await getDoc(doc(db, "usernames", searchName));
    if (!unameSnap.exists()) return alert("No such user");
    const toUid = unameSnap.data().uid;
    if (toUid === user.uid) return alert("Can't add yourself");
    const blockedByTarget = (await getDoc(doc(db, "users", toUid, "blocks", user.uid))).exists();
    const iBlockedTarget = (await getDoc(doc(db, "users", user.uid, "blocks", toUid))).exists();
    if (blockedByTarget) return alert("You are blocked by this user");
    if (iBlockedTarget) return alert("You have blocked this user; unblock to send request");
    if ((await getDoc(doc(db, "users", user.uid, "friends", toUid))).exists()) return alert("Already friends");
    const q = query(collection(db, "friendRequests"),
      where("fromUid", "==", user.uid),
      where("toUid", "==", toUid),
      where("status", "==", "pending"));
    const existing = await getDocs(q);
    if (!existing.empty) return alert("Friend request already sent");
    await addDoc(collection(db, "friendRequests"), {
      fromUid: user.uid,
      toUid,
      status: "pending",
      createdAt: serverTimestamp(),
    });

    await addDoc(collection(db, "users", toUid, "notifications"), {
      title: "Friend request",
      body: `${user.displayName || user.email} sent you a friend request.`,
      createdAt: serverTimestamp(),
      read: false,
      link: "/dashboard",
    });

    setSearchName("");
    alert("Request sent");
  };

  const acceptRequest = async (req) => {
    await setDoc(doc(db, "friendRequests", req.id), { status: "accepted" }, { merge: true });
    await setDoc(doc(db, "users", user.uid, "friends", req.fromUid), { since: serverTimestamp() });
    await setDoc(doc(db, "users", req.fromUid, "friends", user.uid), { since: serverTimestamp() });

    await addDoc(collection(db, "users", req.fromUid, "notifications"), {
      title: "Friend request accepted",
      body: `${user.displayName || user.email} accepted your friend request.`,
      createdAt: serverTimestamp(),
      read: false,
      link: `/dm/${user.uid}`,
    });
  };

  const denyRequest = async (req) => {
    await setDoc(doc(db, "friendRequests", req.id), { status: "denied" }, { merge: true });
  };

  const removeFriend = async (f) => {
    await deleteDoc(doc(db, "users", user.uid, "friends", f.uid));
    await deleteDoc(doc(db, "users", f.uid, "friends", user.uid));
  };

  const blockUser = async (uidToBlock) => {
    if (!confirm("Block this user? This will remove them from your friends.")) return;
    await setDoc(doc(db, "users", user.uid, "blocks", uidToBlock), { blockedAt: serverTimestamp() });
    await deleteDoc(doc(db, "users", user.uid, "friends", uidToBlock));
    await deleteDoc(doc(db, "users", uidToBlock, "friends", user.uid));
    alert("User blocked");
  };

  const unblockUser = async (uidToUnblock) => {
    await deleteDoc(doc(db, "users", user.uid, "blocks", uidToUnblock));
  };

  return (
    <div className="container">
      <h2>Dashboard</h2>

      {!hasUsername && (
        <div className="card" style={{ marginBottom: 12 }}>
          <h3>Choose a username</h3>
          <div className="row">
            <input value={username} onChange={(e) => setUsername(e.target.value.trim())} placeholder="username" />
            <button onClick={pickUsername}>Save</button>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 12 }}>
        <h3>Find users</h3>
        <div className="row">
          <input value={searchName} onChange={(e) => setSearchName(e.target.value)} placeholder="username to add" />
          <button onClick={sendFriendRequest}>Send friend request</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3>Incoming requests</h3>
        <ul className="list">
          {incoming.map((r) => (
            <li key={r.id}>
              <div>
                <strong>{r.fromUid}</strong>
                <div className="small">from UID</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => acceptRequest(r)}>Accept</button>
                <button className="ghost" onClick={() => denyRequest(r)}>Deny</button>
              </div>
            </li>
          ))}
          {incoming.length === 0 && <li className="small">No incoming requests</li>}
        </ul>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3>Outgoing requests</h3>
        <ul className="list">
          {outgoing.map((r) => (
            <li key={r.id}>
              <div><strong>{r.toUid}</strong><div className="small">to UID</div></div>
              <div className="small">{r.status}</div>
            </li>
          ))}
          {outgoing.length === 0 && <li className="small">No outgoing requests</li>}
        </ul>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3>Friends</h3>
        <ul className="list">
          {friends.map((f) => (
            <li key={f.uid}>
              <div>
                <div><strong>{f.username || f.displayName || f.email || f.uid}</strong></div>
                <div className="small">{f.email}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => router.push(`/dm/${f.uid}`)}>DM</button>
                <button className="ghost" onClick={() => removeFriend(f)}>Remove</button>
                <button className="ghost" onClick={() => blockUser(f.uid)}>Block</button>
              </div>
            </li>
          ))}
          {friends.length === 0 && <li className="small">No friends yet</li>}
        </ul>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3>Blocked users</h3>
        <ul className="list">
          {blocks.map((b) => (
            <li key={b}>
              <div><strong>{b}</strong></div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => unblockUser(b)} className="ghost">Unblock</button>
              </div>
            </li>
          ))}
          {blocks.length === 0 && <li className="small">No blocked users</li>}
        </ul>
      </div>

      <div style={{ marginTop: 16 }}>
        <h3>Servers</h3>
        <ul>
          {servers.map((s) => (
            <li key={s.id}>
              {s.name} <button onClick={() => router.push(`/server/${s.id}`)}>Join</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
