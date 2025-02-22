import { db } from "../../lib/firebase/admin"; // Use Firebase Admin SDK
import admin from "firebase-admin";

// API Endpoint: POST /api/signup
export async function POST(req: Request) {
    try {
      const { email } = await req.json();
  
      // ✅ Input validation
      if (!email || !email.includes("@")) {
        return new Response(JSON.stringify({ message: "Invalid email address." }), { status: 400 });
      }
  
      const docRef = db.collection("beta_signups").doc(email);
  
      // ✅ Check if the email already exists in Firestore
      const docSnapshot = await docRef.get();
      if (docSnapshot.exists) {
        return new Response(JSON.stringify({ message: "This email is already registered." }), { status: 409 });
      }
  
      // ✅ Store email with a timestamp
      await docRef.set({
        email,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
  
      return new Response(JSON.stringify({ message: "✅ Thank you for signing up!" }), { status: 200 });
    } catch (error) {
      console.error("❌ Error saving email to Firestore:", error);
      return new Response(JSON.stringify({ message: "Failed to save email." }), { status: 500 });
    }
  }