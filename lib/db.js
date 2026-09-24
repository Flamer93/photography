import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/* ------------------------------------------------------------ galleries -- */

export const galleriesCol = () => collection(db, "galleries");
export const photosCol = (galleryId) =>
  collection(db, "galleries", galleryId, "photos");

function mapDocs(snap) {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listPublishedGalleries(max = 50) {
  const snap = await getDocs(
    query(
      galleriesCol(),
      where("published", "==", true),
      orderBy("dateOf", "desc"),
      limit(max)
    )
  );
  return mapDocs(snap);
}

export async function listAllGalleries() {
  const snap = await getDocs(query(galleriesCol(), orderBy("dateOf", "desc")));
  return mapDocs(snap);
}

export async function getGalleryBySlug(slug) {
  // The published filter is not optional: the security rules only permit a
  // public query whose results are guaranteed to be published galleries.
  const snap = await getDocs(
    query(
      galleriesCol(),
      where("slug", "==", slug),
      where("published", "==", true),
      limit(1)
    )
  );
  const [gallery] = mapDocs(snap);
  return gallery || null;
}

export async function getGallery(id) {
  const snap = await getDoc(doc(db, "galleries", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createGallery(data) {
  return addDoc(galleriesCol(), {
    ...data,
    photoCount: 0,
    coverUrl: "",
    createdAt: serverTimestamp(),
  });
}

export async function updateGallery(id, patch) {
  return updateDoc(doc(db, "galleries", id), patch);
}

export async function deleteGallery(id) {
  return deleteDoc(doc(db, "galleries", id));
}

/* --------------------------------------------------------------- photos -- */

export async function listPhotos(galleryId) {
  const snap = await getDocs(
    query(photosCol(galleryId), orderBy("createdAt", "asc"))
  );
  return mapDocs(snap);
}

export async function addPhoto(galleryId, data) {
  return addDoc(photosCol(galleryId), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export async function updatePhoto(galleryId, photoId, patch) {
  return updateDoc(doc(db, "galleries", galleryId, "photos", photoId), patch);
}

export async function deletePhoto(galleryId, photoId) {
  return deleteDoc(doc(db, "galleries", galleryId, "photos", photoId));
}

// Clears a whole gallery. Batched because a game can run to several hundred
// photos and one round trip each is slow enough to look broken. 450 leaves
// room under Firestore’s 500-operation batch limit.
export async function deletePhotos(galleryId, photoIds) {
  const CHUNK = 450;
  for (let i = 0; i < photoIds.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const id of photoIds.slice(i, i + CHUNK)) {
      batch.delete(doc(db, "galleries", galleryId, "photos", id));
    }
    await batch.commit();
  }
}

/* --------------------------------------------------------------- orders -- */

export const ordersCol = () => collection(db, "orders");

export async function createOrder(data) {
  return addDoc(ordersCol(), {
    ...data,
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

export async function listOrdersForBuyer(uid) {
  const snap = await getDocs(
    query(ordersCol(), where("buyerUid", "==", uid), orderBy("createdAt", "desc"))
  );
  return mapDocs(snap);
}

export async function listAllOrders(max = 200) {
  const snap = await getDocs(
    query(ordersCol(), orderBy("createdAt", "desc"), limit(max))
  );
  return mapDocs(snap);
}

export async function setOrderStatus(orderId, status) {
  return updateDoc(doc(db, "orders", orderId), {
    status,
    ...(status === "paid" ? { paidAt: serverTimestamp() } : {}),
  });
}

// Records the outcome of a delivery-email attempt. Kept separate from
// setOrderStatus because payment truth and email delivery are independent --
// a failed email should never make a paid order look unpaid.
export async function recordDelivery(orderId, { sent, error }) {
  return updateDoc(doc(db, "orders", orderId), {
    filesSentAt: sent ? serverTimestamp() : null,
    deliveryError: sent ? null : error || "Could not send the files email.",
  });
}

export async function deleteOrder(orderId) {
  return deleteDoc(doc(db, "orders", orderId));
}

/* ----------------------------------------------------------- deliveries -- */

// A download gallery for a larger order. Keyed by the order id, which doubles
// as the access secret -- see the note in firestore.rules. Deliberately holds
// no buyer email: the page only needs the files and a first name.
export async function saveDeliveryGallery(orderId, data) {
  return setDoc(doc(db, "deliveries", orderId), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export async function getDeliveryGallery(orderId) {
  const snap = await getDoc(doc(db, "deliveries", orderId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function deleteDeliveryGallery(orderId) {
  return deleteDoc(doc(db, "deliveries", orderId));
}

/* ------------------------------------------------------------ enquiries -- */

export const enquiriesCol = () => collection(db, "enquiries");

export async function createEnquiry(data) {
  return addDoc(enquiriesCol(), {
    ...data,
    handled: false,
    createdAt: serverTimestamp(),
  });
}

export async function listEnquiries(max = 200) {
  const snap = await getDocs(
    query(enquiriesCol(), orderBy("createdAt", "desc"), limit(max))
  );
  return mapDocs(snap);
}

export async function setEnquiryHandled(enquiryId, handled) {
  return updateDoc(doc(db, "enquiries", enquiryId), { handled });
}

export async function deleteEnquiry(enquiryId) {
  return deleteDoc(doc(db, "enquiries", enquiryId));
}
