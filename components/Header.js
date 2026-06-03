import { useContext, useEffect, useState } from "react";
import { ThemeContext } from "../pages/_app";
import { auth } from "../lib/firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import Link from "next/link";
import Notifications from "./Notifications";

export default function Header() {
  const { theme, toggle } = useContext(ThemeContext);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  const doSignOut = async () => {
    await signOut(auth);
    window.location.href = "/";
  };

  return (
    <header className="app-header">
      <div className="container header-row">
        <div className="header-left">
          <Link href="/"><a className="brand">Chat Website</a></Link>
        </div>

        <div className="header-right">
          <Notifications user={user} />
          <button className="ghost small" onClick={toggle} aria-label="Toggle theme">
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          {user && <button className="ghost small" onClick={doSignOut}>Sign out</button>}
        </div>
      </div>
    </header>
  );
}
