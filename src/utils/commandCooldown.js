const COMMAND_COOLDOWN_MS = 10_000;
const cooldowns = new Map();

function acquireCommandCooldown(userId, now = Date.now()) {
  const expiresAt = cooldowns.get(userId);
  if (expiresAt && expiresAt > now) {
    return expiresAt - now;
  }

  const nextExpiresAt = now + COMMAND_COOLDOWN_MS;
  cooldowns.set(userId, nextExpiresAt);

  const timeout = setTimeout(() => {
    if (cooldowns.get(userId) === nextExpiresAt) {
      cooldowns.delete(userId);
    }
  }, COMMAND_COOLDOWN_MS);
  timeout.unref?.();

  return 0;
}

module.exports = { acquireCommandCooldown };
