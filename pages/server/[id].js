import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import ChatRoom from "../../components/ChatRoom";
import VoiceRoom from "../../components/VoiceRoom";
import { doc, getDoc } from "firebase/firestore";

export default function ServerPage() {
  const router = useRouter();
  const { id } = router.query;
  const [user, setUser] = useState(null);
  const [server, setServer] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return router.push("/");
      setUser(u);
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const docRef = doc(db, "servers", id);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return;
      setServer({ id: snap.id, ...snap.data() });
    })();
  }, [id]);

  if (!server) return <div className="container">Loading server...</div>;

  return (
    <div className="container">
      <h2>{server.name}</h2>
      <div style={{ display: "flex", gap: 20, flexDirection: "column" }}>
        <div>
          <h3>Text Chat</h3>
          <ChatRoom serverId={id} user={user} />
        </div>
        <div>
          <h3>Voice Room (separate)</h3>
          <VoiceRoom serverId={id} user={user} />
        </div>
      </div>
    </div>
  );
}
