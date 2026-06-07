const admin = require("firebase-admin");
const serviceAccount = require("./firebase-service-account.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function run() {
  try {
    const snap = await db.collection("reports")
      .where("type", "in", ["post", "group"])
      .orderBy("createdAt", "desc")
      .get();
      
    console.log(`Found ${snap.size} reports.`);
    snap.forEach(doc => {
      console.log(doc.id, doc.data().type, doc.data().status);
    });
  } catch (e) {
    console.error("Query failed:", e);
  }
}

run();
