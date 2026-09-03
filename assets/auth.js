import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

// Apps Script를 웹 앱으로 배포한 뒤 .../exec URL을 여기에 붙여넣으세요.
export const MEMBER_API = '';

const firebaseConfig = {
  apiKey: "AIzaSyDmMQTIqpwB3NfsomVwEThhkSFUYuHxQ4Y",
  authDomain: "senior-compass-768f6.firebaseapp.com",
  projectId: "senior-compass-768f6",
  storageBucket: "senior-compass-768f6.firebasestorage.app",
  messagingSenderId: "489772075163",
  appId: "1:489772075163:web:297ab190729a760f599e3e",
  measurementId: "G-GW31JDCJ6T"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export let currentUser = null;
const authStyle = document.createElement('style');
authStyle.textContent = `
  [data-auth-ui]{position:relative;display:inline-flex;align-items:center}
  .auth-link{padding:9px 13px;border:1px solid rgba(255,255,255,.45);border-radius:8px;background:transparent;color:#fff;font:700 14px inherit;text-decoration:none;cursor:pointer}
  .auth-menu{position:absolute;z-index:20;right:0;top:calc(100% + 8px);min-width:220px;padding:12px;border:1px solid #DCE4E8;border-radius:10px;background:#fff;color:#22303A;box-shadow:0 12px 28px rgba(27,74,112,.18)}
  .auth-menu strong{display:block;overflow-wrap:anywhere;font-size:13px}.auth-menu button{width:100%;margin-top:10px;padding:8px;border:0;border-radius:7px;background:#2D6FA3;color:#fff;font:700 13px inherit;cursor:pointer}
`;
document.head.appendChild(authStyle);
export const authReady = new Promise(resolve => {
  onAuthStateChanged(auth, user => {
    currentUser = user;
    window.currentUser = user;
    updateAuthUI();
    resolve(user);
  });
});

export function safeReturnUrl(value) {
  if (!value) return 'index.html';
  try {
    const target = new URL(value, window.location.origin);
    const basePath = window.location.pathname.replace(/\/[^/]*$/, '/');
    if (target.origin === window.location.origin && target.pathname.startsWith(basePath)) {
      const relativePath = target.pathname.slice(basePath.length) || 'index.html';
      return relativePath + target.search + target.hash;
    }
  } catch (_) { /* 안전하지 않은 return URL은 무시 */ }
  return 'index.html';
}

export async function requireMemberOrRedirect(returnUrl = window.location.href) {
  await authReady;
  if (currentUser) return true;
  window.location.href = 'signup.html?return=' + encodeURIComponent(safeReturnUrl(returnUrl));
  return false;
}

export async function getIdToken() {
  await authReady;
  return currentUser ? currentUser.getIdToken() : null;
}

function addText(parent, tag, value, className) {
  const element = document.createElement(tag);
  element.textContent = value;
  if (className) element.className = className;
  parent.appendChild(element);
  return element;
}

export function updateAuthUI() {
  document.querySelectorAll('[data-auth-ui]').forEach(root => {
    root.replaceChildren();
    if (!currentUser) {
      const login = document.createElement('a');
      login.href = 'login.html?return=' + encodeURIComponent(safeReturnUrl(window.location.href));
      login.textContent = '🔐 로그인';
      login.className = 'auth-link';
      root.appendChild(login);
      const signup = document.createElement('a');
      signup.href = 'signup.html?return=' + encodeURIComponent(safeReturnUrl(window.location.href));
      signup.textContent = '회원가입';
      signup.className = 'auth-link';
      root.appendChild(signup);
      return;
    }

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'auth-link auth-toggle';
    toggle.textContent = '👤 마이페이지';
    const menu = document.createElement('div');
    menu.className = 'auth-menu';
    menu.hidden = true;
    addText(menu, 'strong', currentUser.email || '회원');
    const logout = document.createElement('button');
    logout.type = 'button';
    logout.textContent = '로그아웃';
    logout.addEventListener('click', async () => {
      await signOut(auth);
      menu.hidden = true;
    });
    menu.appendChild(logout);
    toggle.addEventListener('click', () => { menu.hidden = !menu.hidden; });
    root.append(toggle, menu);
  });
}

window.requireMemberOrRedirect = requireMemberOrRedirect;
window.getIdToken = getIdToken;
window.updateAuthUI = updateAuthUI;
window.MEMBER_API = MEMBER_API;
