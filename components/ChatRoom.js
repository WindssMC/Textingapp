import { useEffect, useState, useRef } from "react";
import { db, storage } from "../lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";

export default function ChatRoom({ serverId, user }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [uploadProgress, setUploadProgress] = useState(null);
  const fileInputRef = useRef();
  const bottomRef = useRef();

  useEffect(() => {
    const q = query(collection(db, "servers", serverId, "textMessages"), orderBy("ts"));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
    return () => unsub();
  }, [serverId]);

  const sendMessage = async (e) => {
    e?.preventDefault?.();
    if (!text) return;
    const userDoc = await getDoc(doc(db, "users", user.uid));
    const username = userDoc.exists() ? userDoc.data().username || user.displayName || "anon" : user.displayName;
    await addDoc(collection(db, "servers", serverId, "textMessages"), {
      uid: user.uid,
      username,
      text,
      ts: serverTimestamp(),
    });
    setText("");
  };

  const uploadAndSendFile = async (file) => {
    if (!file) return;
    const filePath = `chatFiles/${serverId}/${Date.now()}_${file.name}`;
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
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const username = userDoc.exists() ? userDoc.data().username || user.displayName || "anon" : user.displayName;
        await addDoc(collection(db, "servers", serverId, "textMessages"), {
          uid: user.uid,
          username,
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
          const serverDoc = await getDoc(doc(db, "servers", serverId));
          if (serverDoc.exists()) {
            const ownerUid = serverDoc.data().ownerUid;
            if (ownerUid && ownerUid !== user.uid) {
              await addDoc(collection(db, "users", ownerUid, "notifications"), {
                title: "New file in server",
                body: `${username} uploaded ${file.name} in ${serverDoc.data().name}.`,
                createdAt: serverTimestamp(),
                read: false,
                link: `/server/${serverId}`,
              });
            }
          }
        } catch (e) {
          console.warn("Notification creation failed", e);
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
    <div className="card" style={{ display: "flex", flexDirection: "column", height: 420 }}>
      <div className="chat-main" style={{ overflow: "auto", flex: 1 }}>
        {messages.map((m) => (
          <div key={m.id} style={{ padding: 6 }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}><strong>{m.username}</strong> · <span className="small">{new Date(m.ts?.toDate?.() || Date.now()).toLocaleString()}</span></div>
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

      <div className="chat-input" style={{ paddingTop: 8 }}>
        {uploadProgress !== null && (
          <div className="small" style={{ marginBottom: 8 }}>Uploading: {uploadProgress}%</div>
        )}
        <form onSubmit={sendMessage} style={{ display: "flex", gap: 8 }}>
          <input style={{ flex: 1 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Message..." />
          <input ref={fileInputRef} type="file" onChange={onFileSelected} style={{ display: "none" }} />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="ghost">Attach</button>
          <button type="submit">Send</button>
        </form>
      </div>
    </div>
  );
}
