import { useEffect, useRef, useState } from "react";
import { db, storage } from "../lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";

function dmIdFor(u1, u2) {
  return [u1, u2].sort().join("_");
}

export default function DMRoom({ user, otherUid }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const bottomRef = useRef();
  const [blocked, setBlocked] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const fileInputRef = useRef();

  useEffect(() => {
    (async () => {
      const blockedByOther = (await getDoc(doc(db, "users", otherUid, "blocks", user.uid))).exists();
      const iBlocked = (await getDoc(doc(db, "users", user.uid, "blocks", otherUid))).exists();
      setBlocked(blockedByOther || iBlocked);

      const id = dmIdFor(user.uid, otherUid);
      const q = query(collection(db, "dms", id, "messages"), orderBy("ts"));
      const unsub = onSnapshot(q, (snap) => {
        setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      });
      return () => unsub();
    })();
  }, [user.uid, otherUid]);

  const send = async (e) => {
    e?.preventDefault?.();
    if (!text) return;
    if (blocked) return alert("Cannot send message: blocked or you blocked the user.");
    const id = dmIdFor(user.uid, otherUid);
    await setDoc(doc(db, "dms", id), { participants: [user.uid, otherUid], updatedAt: serverTimestamp() }, { merge: true });
    await addDoc(collection(db, "dms", id, "messages"), {
      uid: user.uid,
      text,
      ts: serverTimestamp(),
    });

    try {
      await addDoc(collection(db, "users", otherUid, "notifications"), {
        title: "New message",
        body: `${user.displayName || user.email || "Someone"} sent you a message.",
        createdAt: serverTimestamp(),
        read: false,
        link: `/dm/${user.uid}`,
      });
    } catch (e) {
      console.warn("Notification failed", e);
    }

    setText("");
  };

  const uploadAndSendFile = async (file) => {
    if (!file) return;
    if (blocked) return alert("Cannot send file: blocked or you blocked the user.");
    const id = dmIdFor(user.uid, otherUid);
    const filePath = `dmFiles/${id}/${Date.now()}_${file.name}`;
    const sRef = storageRef(storage, filePath);
    const uploadTask = uploadBytesResumable(sRef, file);

    setUploadProgress(0);

    uploadTask.on("state_changed",
      (snapshot) => {
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        setUploadProgress(pct);
      },
      (error) => {
        console.error("Upload failed", error);
        setUploadProgress(null);
        alert("Upload failed: " + error.message);
      },
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        await setDoc(doc(db, "dms", id), { participants: [user.uid, otherUid], updatedAt: serverTimestamp() }, { merge: true });
        await addDoc(collection(db, "dms", id, "messages"), {
          uid: user.uid,
          text: "",
          file: {
            name: file.name,
            url,
            contentType: file.type,
            size: file.size,
            path: filePath,
          },
          ts: serverTimestamp(),
        });

        try {
          await addDoc(collection(db, "users", otherUid, "notifications"), {
            title: "New file",
            body: `${user.displayName || user.email || "Someone"} sent you a file: ${file.name}",
            createdAt: serverTimestamp(),
            read: false,
            link: `/dm/${user.uid}`,
          });
        } catch (e) {
          console.warn("Notification failed", e);
        }

        setUploadProgress(null);
      }
    );
  };

  const onFileSelected = (e) => {
    const f = e.target.files?.[0];
    if (f) uploadAndSendFile(f);
    e.target.value = null;
  };

  return (
    <div className="card">
      {blocked && <div style={{ color: "var(--danger)" }}>Blocked — messaging disabled.</div>}

      <div style={{ maxHeight: 360, overflow: "auto", marginBottom: 8 }}>
        {messages.map((m) => (
          <div key={m.id} style={{ padding: 6 }}>
            <div className="small" style={{ color: "var(--muted)" }}><strong>{m.uid === user.uid ? "You" : "Them"}</strong> · <span className="small">{new Date(m.ts?.toDate?.() || Date.now()).toLocaleString()}</span></div>
            {m.text && <div style={{ marginTop: 4 }}>{m.text}</div>}
            {m.file && (
              <div style={{ marginTop: 6 }}>
                {m.file.contentType?.startsWith?.("image/") ? (
                  <img src={m.file.url} alt={m.file.name} style={{ maxWidth: "100%", borderRadius: 8 }} />
                ) : (
                  <a href={m.file.url} target="_blank" rel="noreferrer" className="small">{m.file.name} ({Math.round((m.file.size||0)/1024)} KB)</a>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {uploadProgress !== null && <div className="small" style={{ marginBottom: 8 }}>Uploading: {uploadProgress}%</div>}

      <form onSubmit={send} style={{ display: "flex", gap: 8 }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message..." style={{ flex: 1 }} />
        <input ref={fileInputRef} type="file" onChange={onFileSelected} style={{ display: "none" }} />
        <button type="button" onClick={() => fileInputRef.current?.click()} className="ghost">Attach</button>
        <button type="submit" disabled={blocked}>Send</button>
      </form>
    </div>
  );
}
