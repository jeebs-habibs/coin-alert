"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";

export default function BetaSignup() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const lastSignup = localStorage.getItem("lastSignupTime");
    if (lastSignup && Date.now() - Number(lastSignup) < 30 * 60 * 1000) {
      setMessage("You have already signed up recently. Try again later.");
    }
  }, []);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
  
    // Basic validation before sending request
    if (!email.includes("@")) {
      setMessage("⚠️ Please enter a valid email address.");
      return;
    }
  
    try {
      setIsSubmitting(true);
  
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });
  
      const data = await response.json(); // Parse the JSON response
  
      if (response.ok) {
        // ✅ Success case
        localStorage.setItem("lastSignupTime", Date.now().toString());
        setMessage("✅ Thank you for signing up!");
        setEmail(""); // Clear input
      } else {
        // ⚠️ Error or duplicate email
        setMessage(`⚠️ ${data.message || "Signup failed. Try again."}`);
      }
    } catch (error) {
      console.error("Signup Error:", error);
      setMessage("❌ Error signing up. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };
  

  return (
    <div className="beta-container">
      {/* 🔹 Navbar */}
      <nav className="navbar">
        <div className="logo">SIREN</div>
        <ul>
          <li><a href="#about">About</a></li>
          <li><a href="#roadmap">Roadmap</a></li>
          <li><a href="#demo">Demo</a></li>
        </ul>
      </nav>

      {/* 🔹 Hero Section */}
      <section className="hero">
        <Image 
          src="/sirenSmaller.png" 
          alt="Siren Logo" 
          className="sirenLogo"
          width={100}  // Adjust width as needed
          height={100} // Adjust height as needed
          priority // Ensures it loads quickly
        />        
        <h1 className="title">Beta Sign Up</h1>
        <form className="signup-form" onSubmit={handleSignup}>
          <input
            type="email"
            placeholder="Enter email address..."
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="email-input"
            required
          />
          <button type="submit" className={`signup-button ${isSubmitting || message == "You have already signed up recently. Try again later." ? "disabled" : ""}`} disabled={isSubmitting || message == "You have already signed up recently. Try again later."}>
            {isSubmitting ? "Submitting..." : "Sign Up"}
          </button>
        </form>
        {message && <p className="message">{message}</p>}
      </section>

      {/* 🔹 About Section */}
      <section id="about" className="content-section">
        <h2>About Siren</h2>
        <hr />
        <p>
          Siren is an innovative platform designed to keep you ahead of the market.
          With real-time alerts and intelligent insights, you never miss an important opportunity.
        </p>
      </section>

      {/* 🔹 Roadmap Section */}
      <section id="roadmap" className="content-section">
        <h2>Roadmap</h2>
        <hr />
        <ul>
          <li>📌 Q1 2025: Beta Release & Early Access</li>
          <li>📌 Q2 2025: Full Product Launch</li>
          <li>📌 Q3 2025: Advanced Analytics & AI-powered Alerts</li>
          <li>📌 Q4 2025: Community Features & Custom Alerts</li>
        </ul>
      </section>

      {/* 🔹 Demo Section */}
      <section id="demo" className="content-section">
        <h2>Demo</h2>
        <hr />
        <p>
          Watch a preview of Siren in action! Stay tuned for an interactive experience.
        </p>
        {/* <button className="demo-button">Watch Demo</button> */}
      </section>
      <a
        href="https://x.com/siren_notify" // Replace with your actual X profile
        target="_blank"
        rel="noopener noreferrer"
        className="floatingX"
      >
        <Image src="/x-logo/logo.svg" alt="X Logo" width={30} height={30} />
      </a>
    </div>
  );
}
