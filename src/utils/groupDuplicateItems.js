function groupDuplicateItems(items, identityFields) {
  const groups = new Map();

  for (const item of items) {
    const identity = JSON.stringify(identityFields.map(field => item[field] ?? null));
    let group = groups.get(identity);

    if (!group) {
      group = { item, items: [] };
      groups.set(identity, group);
    }

    group.items.push(item);
  }

  return [...groups.values()];
}

module.exports = { groupDuplicateItems };
