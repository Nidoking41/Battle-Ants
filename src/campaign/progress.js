// Campaign progress, saved in localStorage.
//
// This is the first persistence in the project, so keep the contract small:
// one versioned key, one plain object, and every read or write wrapped so a
// blocked or full store (private windows, cleared site data) degrades to
// "nothing unlocked yet" instead of an error.

const KEY = 'battleAnts.campaign.v1';

const DEFAULT = { highestUnlocked: 1, completed: [] };

export function loadProgress() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw);
    return {
      highestUnlocked: Number.isInteger(parsed.highestUnlocked) && parsed.highestUnlocked >= 1 ? parsed.highestUnlocked : 1,
      completed: Array.isArray(parsed.completed) ? parsed.completed.filter(Number.isInteger) : []
    };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveProgress(progress) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // Storage unavailable - progress simply will not survive a reload.
  }
}

/** Record a win. Unlocks the next level. Safe to call repeatedly. */
export function markLevelComplete(levelId) {
  const p = loadProgress();
  const completed = p.completed.includes(levelId) ? p.completed : [...p.completed, levelId];
  const next = { highestUnlocked: Math.max(p.highestUnlocked, levelId + 1), completed };
  saveProgress(next);
  return next;
}

export function isUnlocked(levelId, progress = loadProgress()) {
  return levelId <= progress.highestUnlocked;
}

export function isCompleted(levelId, progress = loadProgress()) {
  return progress.completed.includes(levelId);
}

export function resetProgress() {
  saveProgress({ ...DEFAULT });
}
