const transactionQueues = new WeakMap();

async function withTransaction(db, callback) {
  const previous = transactionQueues.get(db) || Promise.resolve();
  let release;
  const current = new Promise(resolve => {
    release = resolve;
  });
  const queued = previous.then(() => current);
  transactionQueues.set(db, queued);

  await previous;
  try {
    const tx = await db.transaction('write');
    return await callback(tx);
  } finally {
    release();
    if (transactionQueues.get(db) === queued) {
      transactionQueues.delete(db);
    }
  }
}

module.exports = { withTransaction };
