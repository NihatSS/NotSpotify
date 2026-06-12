import { keys, read, write, toast, uid } from "./storage.js";

const signup = document.getElementById("signupForm");
const login = document.getElementById("loginForm");

signup?.addEventListener("submit", (event) => {
  event.preventDefault();
  const users = read(keys.users, []);
  const email = document.getElementById("signupEmail").value.trim().toLowerCase();
  if (users.some((user) => user.email === email)) {
    toast("Email already exists");
    return;
  }
  const user = {
    id: uid("user"),
    name: document.getElementById("signupName").value.trim(),
    email,
    password: document.getElementById("signupPassword").value,
    type: document.getElementById("accountType").value
  };
  write(keys.users, [...users, user]);
  write(keys.session, { id: user.id, name: user.name, email: user.email, type: user.type });
  toast("Account created");
  setTimeout(() => location.href = user.type === "artist" ? "artist-dashboard.html" : "index.html", 600);
});

login?.addEventListener("submit", (event) => {
  event.preventDefault();
  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  const password = document.getElementById("loginPassword").value;
  const user = read(keys.users, []).find((item) => item.email === email && item.password === password);
  if (!user) {
    toast("Invalid login details");
    return;
  }
  write(keys.session, { id: user.id, name: user.name, email: user.email, type: user.type });
  toast("Logged in");
  setTimeout(() => location.href = user.type === "artist" ? "artist-dashboard.html" : "index.html", 500);
});
