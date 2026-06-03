import "../styles/globals.css";
import { useEffect, useState, createContext } from "react";
import Header from "../components/Header";
import Head from "next/head";

export const ThemeContext = createContext({ theme: "dark", toggle: () => {} });

export default function App({ Component, pageProps }) {
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    const t = localStorage.getItem("theme") || "dark";
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.warn("SW registration failed:", err));
    }
  }, []);

  const toggle = () => {
    const t = theme === "dark" ? "light" : "dark";
    setTheme(t);
    localStorage.setItem("theme", t);
    document.documentElement.setAttribute("data-theme", t);
  };

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
      </Head>
      <ThemeContext.Provider value={{ theme, toggle }}>
        <Header />
        <Component {...pageProps} />
      </ThemeContext.Provider>
    </>
  );
}
