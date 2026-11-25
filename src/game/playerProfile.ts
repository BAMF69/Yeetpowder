import { playerProfile, type PlayerProfile } from "../net/profile";
const KEY = "yeetpowder.playerProfile";
export function localProfile(): PlayerProfile { try { return playerProfile(JSON.parse(localStorage.getItem(KEY) ?? "null")); } catch { return playerProfile(); } }
export function saveProfile(profile: PlayerProfile): void { localStorage.setItem(KEY, JSON.stringify(playerProfile(profile))); }
