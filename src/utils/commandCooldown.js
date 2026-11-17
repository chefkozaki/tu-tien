const COMMAND_COOLDOWN_MS = 10_000;
const DUEL_COOLDOWN_MS = 60_000;
const cooldowns = new Map();
const duelCooldowns = new Map();

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

function acquireDuelCooldown(userId, now = Date.now()) {
  const expiresAt = duelCooldowns.get(userId);
  if (expiresAt && expiresAt > now) {
    return { type: 'duel', remaining: expiresAt - now };
  }

  const commandCooldownRemaining = acquireCommandCooldown(userId, now);
  if (commandCooldownRemaining > 0) {
    return { type: 'command', remaining: commandCooldownRemaining };
  }

  const nextExpiresAt = now + DUEL_COOLDOWN_MS;
  duelCooldowns.set(userId, nextExpiresAt);

  const timeout = setTimeout(() => {
    if (duelCooldowns.get(userId) === nextExpiresAt) {
      duelCooldowns.delete(userId);
    }
  }, DUEL_COOLDOWN_MS);
  timeout.unref?.();

  return { type: null, remaining: 0 };
}

module.exports = { acquireCommandCooldown, acquireDuelCooldown };
