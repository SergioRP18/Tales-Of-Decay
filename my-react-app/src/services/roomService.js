// src/services/roomService.js
import { getFirestore, doc, setDoc, updateDoc, arrayUnion, getDoc } from "firebase/firestore";
import { auth } from "./firebaseConfig";

// ========= Helpers de debug (bots) =========
const BOT_PREFIX = "BOT_";

function makeBot(i, roomCode) {
  const id = `${BOT_PREFIX}${String(i).padStart(2, "0")}_${roomCode}`;
  return {
    uid: id,
    username: `Bot ${i}`,
    isBot: true,
    joinedAt: Date.now(),
  };
}

export async function seedBots(roomCode, count = 7) {
  const db = getFirestore();
  const roomRef = doc(db, "rooms", roomCode);
  const snap = await getDoc(roomRef);
  const room = snap.data() || {};
  const players = Array.isArray(room.players) ? room.players : [];

  const existing = new Set(players.map((p) => p.uid));
  const bots = [];
  for (let i = 1; i <= count; i++) {
    const bot = makeBot(i, roomCode);
    if (!existing.has(bot.uid)) bots.push(bot);
  }
  if (bots.length === 0) return { added: 0 };

  await updateDoc(roomRef, { players: [...players, ...bots] });
  return { added: bots.length };
}

export async function removeBots(roomCode) {
  const db = getFirestore();
  const roomRef = doc(db, "rooms", roomCode);
  const snap = await getDoc(roomRef);
  const room = snap.data() || {};
  const players = Array.isArray(room.players) ? room.players : [];
  const filtered = players.filter((p) => !p.isBot);
  await updateDoc(roomRef, { players: filtered });
  return { removed: players.length - filtered.length };
}

async function seedBotsIfFlag(roomCode) {
  try {
    const inDev = import.meta?.env?.DEV;
    const params = new URLSearchParams(window.location.search);
    const urlCount = parseInt(params.get("bots"), 10);
    const localFlag = localStorage.getItem("debugBots"); // e.g. "7"

    if (!inDev && !urlCount && !localFlag) return { added: 0 };

    const count = Number.isFinite(urlCount) ? urlCount : parseInt(localFlag || "7", 10);
    if (!Number.isFinite(count) || count <= 0) return { added: 0 };

    return await seedBots(roomCode, count);
  } catch (e) {
    console.warn("[seedBotsIfFlag] error", e);
    return { added: 0, error: String(e) };
  }
}
// ===========================================

function generateRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function createRoom(hostUsername) {
  const db = getFirestore();
  let roomCode = generateRoomCode();

  let exists = true;
  while (exists) {
    const roomSnap = await getDoc(doc(db, "rooms", roomCode));
    if (!roomSnap.exists()) exists = false;
    else roomCode = generateRoomCode();
  }

  const hostPlayer = {
    uid: auth.currentUser.uid,
    username: hostUsername,
    joinedAt: Date.now(),
    isHost: true,
  };

  await setDoc(doc(db, "rooms", roomCode), {
    players: [hostPlayer],
    status: "waiting",
    createdAt: Date.now(),
    currentChapter: "chapter_01",
    state: "LOBBY",
  });

  // Si estás en DEV y pasas ?bots=7 o seteas localStorage.debugBots="7", siembra bots
  await seedBotsIfFlag(roomCode);

  return roomCode;
}

export async function joinRoom(roomCode, username) {
  const db = getFirestore();
  const roomRef = doc(db, "rooms", roomCode);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) throw new Error("La sala no existe");

  const player = { uid: auth.currentUser.uid, username, joinedAt: Date.now() };
  await updateDoc(roomRef, { players: arrayUnion(player) });
}

// Helpers consola en DEV
if (import.meta?.env?.DEV) {
  // eslint-disable-next-line no-undef
  window.__seedBots = seedBots;
  // eslint-disable-next-line no-undef
  window.__removeBots = removeBots;
}
