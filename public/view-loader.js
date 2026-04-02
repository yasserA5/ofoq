function safeParse(v, fallback = null) {
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

async function getItemByIdWithFallback(collectionName, storageKey) {
  const rawId = getQueryParam('id');
  if (!rawId) return null;

  const localData = safeParse(localStorage.getItem(storageKey), []);
  if (Array.isArray(localData)) {
    const localItem = localData.find(i => String(i?.id) === String(rawId));
    if (localItem) return localItem;
  }

  try {
    if (
      !window.fs ||
      !window.fs.db ||
      !window.fs.collection ||
      !window.fs.getDocs ||
      !window.fs.query ||
      !window.fs.where
    ) {
      return null;
    }

    const col = window.fs.collection(window.fs.db, collectionName);
    const q = window.fs.query(col, window.fs.where('id', '==', rawId));
    const snap = await window.fs.getDocs(q);

    if (!snap.empty) {
      const docSnap = snap.docs[0];
      const item = { docId: docSnap.id, ...docSnap.data() };

      const updated = Array.isArray(localData) ? localData : [];
      const index = updated.findIndex(x => String(x?.id) === String(item.id));

      if (index >= 0) updated[index] = item;
      else updated.unshift(item);

      localStorage.setItem(storageKey, JSON.stringify(updated));
      return item;
    }
  } catch (err) {
    console.error(`Failed to load ${collectionName}:`, err);
  }

  return null;
}