import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut, deleteUser } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore, doc, deleteDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

// Apps Script를 웹 앱으로 배포한 뒤 .../exec URL을 여기에 붙여넣으세요.
export const MEMBER_API = 'https://script.google.com/macros/s/AKfycbxYNpUgVLk8GghxijxwlQS7L2WQzirFb1_jzE63WeabtqP-AKiH7FvnSt5SNYbHRIL8/exec';

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
const CLIENT_ADMIN_EMAILS = ['tubasa22@gmail.com'];
// 이 값은 관리자 메뉴의 화면 표시 여부만 결정합니다.
// 실제 권한 검증은 서버(.gs 파일)의 ADMIN_EMAILS가 담당하며,
// 이 배열을 수정해도 서버 권한은 바뀌지 않습니다.

export function isAdminUser() {
  return Boolean(currentUser && CLIENT_ADMIN_EMAILS.includes(currentUser.email));
}

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
    const target = new URL(value, window.location.href);
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

async function deleteAccount() {
  if (!currentUser) return;
  if (!window.confirm('정말 회원 탈퇴하시겠습니까? 저장된 정보가 삭제되며 되돌릴 수 없습니다.')) return;
  const uid = currentUser.uid;
  try {
    if (MEMBER_API) {
      try {
        const idToken = await currentUser.getIdToken();
        await fetch(MEMBER_API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'sendFarewell', idToken }) });
      } catch (_) {
        // 탈퇴 안내 메일 발송 실패는 탈퇴 처리 자체를 막지 않는다.
      }
    }
    await deleteDoc(doc(db, 'users', uid));
    await deleteUser(currentUser);
    window.location.href = 'index.html';
  } catch (error) {
    if (error.code === 'auth/requires-recent-login') {
      alert('보안을 위해 다시 로그인한 후 탈퇴를 진행해주세요.');
      await signOut(auth);
      window.location.href = 'login.html?return=' + encodeURIComponent(safeReturnUrl(window.location.href));
    } else {
      alert('회원 탈퇴에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
  }
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
    const deleteAccountBtn = document.createElement('button');
    deleteAccountBtn.type = 'button';
    deleteAccountBtn.textContent = '회원 탈퇴';
    deleteAccountBtn.style.background = '#C0392B';
    deleteAccountBtn.addEventListener('click', deleteAccount);
    menu.appendChild(deleteAccountBtn);
    toggle.addEventListener('click', () => { menu.hidden = !menu.hidden; });
    if (isAdminUser()) {
      const adminLink = document.createElement('a');
      adminLink.href = 'admin.html';
      adminLink.textContent = '🔧 관리자';
      adminLink.className = 'auth-link';
      root.appendChild(adminLink);
    }
    root.append(toggle, menu);
  });
}

window.requireMemberOrRedirect = requireMemberOrRedirect;
window.getIdToken = getIdToken;
window.updateAuthUI = updateAuthUI;
window.MEMBER_API = MEMBER_API;
