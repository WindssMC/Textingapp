import { useEffect, useState } from "react";
import { auth } from "../lib/firebase";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/router";

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) router.push("/dashboard");
    });
  }, [router]);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signOutNow = async () => {
    await signOut(auth);
  };

  return (
    <div className="container" style={{ paddingTop: 80 }}>
      <h1>Chat Website</h1>
      {!user ? (
        <>
          <p>Sign in with Google to continue.</p>
          <button onClick={signInWithGoogle}>Sign in with Google</button>
        </>
      ) : (
        <>
          <p>Signed in as {user.email}</p>
          <button onClick={() => router.push("/dashboard")}>Go to dashboard</button>
          <button onClick={signOutNow}>Sign out</button>
        </>
      )}
    </div>
  );
}
