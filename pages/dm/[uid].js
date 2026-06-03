import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import DMRoom from "../../components/DMRoom";
import { doc, getDoc } from "firebase/firestore";

export default function DMPage() {
  const router = useRouter();
  const { uid: otherUid } = router.query;
  const [user, setUser] = useState(null);
  const [otherUser, setOtherUser] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return router.push("/");
      setUser(u);
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!otherUid) return;
    (async () => {
      const snap = await getDoc(doc(db, "users", otherUid));
      if (!snap.exists()) return setOtherUser({ uid: otherUid });
      setOtherUser({ uid: otherUid, ...snap.data() });
    })();
  }, [otherUid]);

  if (!user || !otherUser) return <div className="container">Loading...</div>;

  return (
    <div className="container">
      <h3>DM with {otherUser.username || otherUser.displayName || otherUser.uid}</h3>
      <DMRoom user={user} otherUid={otherUid} />
    </div>
  );
}
