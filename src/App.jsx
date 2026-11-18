import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { db, auth } from "./firebase.js";
import { RABOTI } from "./raboti.js";
import { LOGO_IMG, HERO_IMG } from "./assets.js";
import { Analytics } from "@vercel/analytics/react";
import "./styles.css";

const IC = { "Ключове": "🔑", "Кодиране": "⚙️", "Програмиране": "💻" };
const CATS = Object.keys(IC);
const SVC = [
  { t: "Ключове", d: "Добавяне, клониране и програмиране на ключове, аварийно отключване", i: <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M16 7l3 3M14 9l2 2" /></> },
  { t: "Кодиране", d: "Старт/Стоп, амбиентно осветление, CarPlay и други функции", i: <><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" /></> },
  { t: "Диагностика", d: "Диагностика, живи данни и проверка преди покупка", i: <path d="M3 12h4l2-6 4 12 2-6h6" /> },
];
const jump = (id) => (e) => { e.preventDefault(); const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: "smooth" }); };
const PIN = <><path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>;
const IG = <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.5 6.5h.01" /></>;
const FB = <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />;
// ВАЖНО: тук сложи линковете към твоите профили
const SOCIAL = { ig: "https://www.instagram.com/mkeysplovdiv/", fb: "https://www.facebook.com/profile.php?id=61584523064187" };
const PH = <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />;
const Ic = ({ children }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);

// Зарежда снимка (с коригирана ориентация от телефон), по-надеждно от <img> + FileReader
async function loadImage(file) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch (_) {}
    try { return await createImageBitmap(file); } catch (_) {}
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error("badimg"));
      im.src = url;
    });
  } finally { URL.revokeObjectURL(url); }
}

// Смалява снимката (до ~1100px), докато се събере в документ на базата данни
async function shrink(file) {
  const im = await loadImage(file);
  const w = im.width || im.naturalWidth, h = im.height || im.naturalHeight;
  let max = 1100, q = 0.8;
  for (let i = 0; i < 6; i++) {
    const s = Math.min(1, max / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
    c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
    const out = c.toDataURL("image/jpeg", q);
    if (out.length < 800000) return out;
    max = Math.round(max * 0.8); q = Math.max(0.5, q - 0.05);
  }
  throw new Error("big");
}

function Lightbox({ x, onClose }) {
  useEffect(() => {
    const k = (ev) => { if (ev.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <div className="lb" onClick={onClose} role="dialog" aria-modal="true" aria-label={x.title}>
      <figure onClick={(ev) => ev.stopPropagation()}>
        <img src={x.photo} alt={x.title} />
        <figcaption><b>{x.car || x.title}</b>{x.car && <span>{x.title}</span>}{x.text && norm(x.text) !== norm(x.title) && <p>{x.text}</p>}</figcaption>
      </figure>
      <button className="lbx" onClick={onClose} aria-label="Затвори">✕</button>
    </div>
  );
}

const norm = (s) => (s || "").replace(/[.\s]+$/, "").toLowerCase();

function Card({ x, onDelete, onOpen }) {
  const Ph = onOpen && x.photo ? "button" : "div";
  const props = Ph === "button" ? { type: "button", onClick: onOpen, "aria-label": "Увеличи снимката: " + x.title } : {};
  return (
    <article className="card">
      <Ph className="ph" {...props}>
        <span aria-hidden="true">{IC[x.category] || "🚗"}</span>
        {x.photo && <img src={x.photo} alt={x.title} loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
      </Ph>
      <div className="body">
        <span className="cat" data-c={x.category}>{x.category}</span>
        <h3>{x.car || x.title}</h3>
        {x.car && <p className="what">{x.title}</p>}
        {onDelete && <button className="del" onClick={onDelete}>🗑 Изтрий</button>}
      </div>
    </article>
  );
}

function Social() {
  return (
    <div className="social">
      <a className="soc" href={SOCIAL.ig} target="_blank" rel="noopener noreferrer" aria-label="Instagram"><Ic>{IG}</Ic></a>
      <a className="soc" href={SOCIAL.fb} target="_blank" rel="noopener noreferrer" aria-label="Facebook"><Ic>{FB}</Ic></a>
    </div>
  );
}

function Nav({ page }) {
  const [m, setM] = useState(false), [sc, setSc] = useState(false);
  useEffect(() => { setM(false); }, [page]);
  useEffect(() => {
    const f = () => setSc(window.scrollY > 40);
    f();
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);
  const go = (id) => (e) => { setM(false); jump(id)(e); };
  return (
    <nav className={sc ? "sc" : ""}>
      <div className="wrap navgrid">
        <div className="navl">
          {page === "h" ? <>
            <a className="navlink on" href="#/">Начало</a>
            <a className="navlink" href="#uslugi" onClick={jump("uslugi")}>Услуги</a>
            <a className="navlink" href="#raboti" onClick={jump("raboti")}>Работи</a>
          </> : <a className="navlink on" href="#/">← Начало</a>}
          <a className="navcall" href="tel:0887378844" aria-label="Позвъни"><Ic>{PH}</Ic></a>
        </div>
        <div className="navr">
          <a className="navlink" href="#/kontakti">Контакти</a>
          <Social />
          <a className="navbtn" href="tel:0887378844"><Ic>{PH}</Ic>0887 378 844</a>
          <button type="button" className="burger" aria-label="Меню" aria-expanded={m} onClick={() => setM(!m)}><span /><span /><span /></button>
        </div>
      </div>
      <a className="badge" href="#/" aria-label="MKeysPlovdiv - начало">
        <img src={LOGO_IMG} alt="MKeysPlovdiv" />
      </a>
      {m && (
        <div className="menu">
          <a href="#/" onClick={() => setM(false)}>Начало</a>
          {page === "h" && <>
            <a href="#uslugi" onClick={go("uslugi")}>Услуги</a>
            <a href="#raboti" onClick={go("raboti")}>Работи</a>
          </>}
          <a href="#/kontakti" onClick={() => setM(false)}>Контакти</a>
          <a href="tel:0887378844">0887 378 844</a>
          <Social />
        </div>
      )}
    </nav>
  );
}

function Home({ items }) {
  const [cat, setCat] = useState("all");
  const [open, setOpen] = useState(null);
  const all = [...items, ...RABOTI];
  const cats = ["all", ...new Set(all.map((x) => x.category))];
  const list = all.filter((x) => cat === "all" || x.category === cat);
  return (
    <>
      <header className="hero">
        <img className="hero-bg" src={HERO_IMG} alt="" />
        <div className="wrap">
          <h1>MKeys Plovdiv</h1>
          <p className="lead">Ключове, кодиране и програмиране на автомобили.</p>
          <p className="where"><Ic>{PIN}</Ic>гр. Пловдив</p>
          <div className="cta">
            <a className="btn p" href="tel:0887378844">Позвъни</a>
            <a className="btn g" href="#raboti" onClick={jump("raboti")}>Виж работите</a>
          </div>
          <Social />
        </div>
      </header>

      <section id="uslugi" className="svcs"><div className="wrap">
        <div className="sgrid">
          {SVC.map((s) => (
            <a key={s.t} className="svc" href="#raboti" onClick={jump("raboti")}>
              <Ic>{s.i}</Ic>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </a>
          ))}
        </div>
      </div></section>

      <section id="raboti" className="works"><div className="wrap">
        <h2>Последни работи</h2>
        <p className="sub">Неща, които съм направил за себе си и за познати.</p>
        <div className="tags">{cats.map((c) => <button key={c} className={c === cat ? "on" : ""} onClick={() => setCat(c)}>{c === "all" ? "Всички" : c}</button>)}</div>
        <div className="grid" id="list">{list.map((x) => <Card key={x.id} x={x} onOpen={() => setOpen(x)} />)}</div>
      </div></section>

      <div className="cband"><div className="wrap">
        <div>
          <h2>Имаш въпрос?</h2>
          <p className="sub">Обади се или пиши на имейл, в Instagram или Facebook.</p>
        </div>
        <div className="cb-r">
          <a className="cb-tel" href="tel:0887378844">0887 378 844</a>
          <Social />
          <a className="btn g" href="#/kontakti">Всички контакти</a>
        </div>
      </div></div>
      {open && <Lightbox x={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function Contacts() {
  return (
    <>
      <header className="hero small"><div className="wrap">
        <h1>Нека поговорим</h1>
        <p className="lead">За въпроси и разговор по темите от сайта можеш да ме намериш тук.</p>
      </div></header>
      <section><div className="wrap"><ul className="clist">
        <li><span>Име</span><b>Николай Петров</b></li>
        <li><span>Телефон</span><a href="tel:0887378844">0887 378 844</a></li>
        <li><span>Имейл</span><a href="mailto:n.petrov1905@gmail.com">n.petrov1905@gmail.com</a></li>
        <li><span>Град</span><b>гр. Пловдив</b></li>
        <li><span>Instagram</span><a href={SOCIAL.ig} target="_blank" rel="noopener noreferrer">Instagram ↗</a></li>
        <li><span>Facebook</span><a href={SOCIAL.fb} target="_blank" rel="noopener noreferrer">Facebook ↗</a></li>
      </ul></div></section>
    </>
  );
}

function Admin({ user, items }) {
  const [e, setE] = useState(""), [p, setP] = useState(""), [msg, setMsg] = useState("");
  const [f, setF] = useState({ category: CATS[0], title: "", car: "", text: "" });
  const [file, setFile] = useState(null), [busy, setBusy] = useState(false);
  const set = (k) => (ev) => setF({ ...f, [k]: ev.target.value });
  const login = async () => {
    try { await signInWithEmailAndPassword(auth, e.trim(), p); setMsg(""); } catch (err) {
      const m = {
        "auth/invalid-api-key": "Грешен apiKey в src/config.js (още е ТУК или е грешно копиран)",
        "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "Грешен apiKey в src/config.js",
        "auth/configuration-not-found": "В Firebase не е включен Authentication (Get started)",
        "auth/operation-not-allowed": "В Firebase не е включен Email/Password метод за вход",
        "auth/invalid-credential": "Грешен имейл или парола",
        "auth/invalid-login-credentials": "Грешен имейл или парола",
        "auth/wrong-password": "Грешна парола",
        "auth/user-not-found": "Няма такъв потребител в този Firebase проект",
        "auth/invalid-email": "Невалиден имейл",
        "auth/too-many-requests": "Твърде много опити, изчакай малко",
        "auth/network-request-failed": "Няма връзка с Firebase"
      };
      console.error(err);
      setMsg((m[err.code] || "Грешка") + " [" + (err.code || err.message) + "]");
    }
  };
  const add = async () => {
    if (!f.title.trim()) return setMsg("Напиши заглавие");
    setBusy(true);
    try {
      const photo = file ? await shrink(file) : "";
      if (photo.length > 900000) throw new Error("big");
      await addDoc(collection(db, "raboti"), { ...f, photo, createdAt: serverTimestamp() });
      setF({ ...f, title: "", car: "", text: "" }); setFile(null); setMsg("Публикувано ✓");
    } catch (err) {
      console.error(err);
      setMsg(err.message === "big" ? "Снимката е твърде голяма" : err.message === "badimg" ? "Снимката не може да се отвори. Ако е от iPhone, може да е HEIC с име .jpg - изпрати я през Viber и свали оттам" : "Грешка [" + (err.code || err.message) + "]");
    }
    setBusy(false);
  };
  return (
    <section className="adm"><div className="wrap">
      {!user ? (
        <div className="md">
          <h3>Вход</h3>
          <input placeholder="Имейл" value={e} onChange={(x) => setE(x.target.value)} />
          <input type="password" placeholder="Парола" value={p} onChange={(x) => setP(x.target.value)} />
          <button className="ok" onClick={login}>Влез</button>
          <div className="msg">{msg}</div>
        </div>
      ) : (
        <>
          <div className="md">
            <h3>Нова работа</h3>
            <select value={f.category} onChange={set("category")}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
            <input placeholder="Заглавие" value={f.title} onChange={set("title")} />
            <input placeholder="Кола (напр. BMW F30 · 2015)" value={f.car} onChange={set("car")} />
            <textarea rows="3" placeholder="Описание" value={f.text} onChange={set("text")} />
            <input key={items.length} type="file" accept="image/*" onChange={(x) => setFile(x.target.files[0])} />
            <button className="ok" disabled={busy} onClick={add}>{busy ? "Качва се…" : "Публикувай"}</button>
            <button onClick={() => signOut(auth)}>Изход</button>
            <div className="msg">{msg}</div>
          </div>
          <div className="grid">{items.map((x) => <Card key={x.id} x={x} onDelete={() => window.confirm("Да изтрия ли?") && deleteDoc(doc(db, "raboti", x.id))} />)}</div>
        </>
      )}
    </div></section>
  );
}

export default function App() {
  const [h, setH] = useState(window.location.hash), [items, setItems] = useState([]), [user, setUser] = useState(null);
  useEffect(() => {
    const f = () => setH(window.location.hash);
    window.addEventListener("hashchange", f);
    const u1 = onSnapshot(query(collection(db, "raboti"), orderBy("createdAt", "desc")),
      (s) => setItems(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {});
    const u2 = onAuthStateChanged(auth, setUser);
    return () => { window.removeEventListener("hashchange", f); u1(); u2(); };
  }, []);
  const page = h.startsWith("#/kontakti") ? "k" : h.startsWith("#/admin") ? "a" : "h";
  useEffect(() => { window.scrollTo(0, 0); }, [page]);
  return (
    <>
      <Nav page={page} />
      {page === "h" && <Home items={items} />}
      {page === "k" && <Contacts />}
      {page === "a" && <Admin user={user} items={items} />}
      <footer>© 2026 MKeysPlovdiv · Лично портфолио{page === "h" ? ", без платени услуги. Всичко е направено със съгласието на собственика на автомобила." : "."}</footer>
      <Analytics />
    </>
  );
}
