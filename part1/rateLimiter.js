const users = {};

const MAX_REQUESTS = 5;
const WINDOW_MS = 60 * 1000;

function allow(userId) {
  const now = Date.now();

  if (!users[userId]) {
    users[userId] = {
      windowStart: now,
      acceptedInWindow: 0,
      rejectedTotal: 0,
    };
  }

  const user = users[userId];

  if (now - user.windowStart >= WINDOW_MS) {
    user.windowStart = now;
    user.acceptedInWindow = 0;
  }

  if (user.acceptedInWindow < MAX_REQUESTS) {
    user.acceptedInWindow++;
    return {
      allowed: true,
      acceptedInWindow: user.acceptedInWindow,
      rejectedTotal: user.rejectedTotal,
    };
  }

  user.rejectedTotal++;
  return {
    allowed: false,
    acceptedInWindow: user.acceptedInWindow,
    rejectedTotal: user.rejectedTotal,
  };
}

function getAllStats() {
  const now = Date.now();
  const result = {};

  for (const userId in users) {
    const user = users[userId];
    const acceptedInWindow =
      now - user.windowStart >= WINDOW_MS ? 0 : user.acceptedInWindow;

    result[userId] = {
      accepted_in_window: acceptedInWindow,
      rejected_total: user.rejectedTotal,
    };
  }

  return result;
}

module.exports = { allow, getAllStats };