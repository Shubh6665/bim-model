"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-white/10 backdrop-blur-md border-b border-white/20"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <span className="text-lg font-semibold text-white">
              BIM Platform
            </span>
          </div>
          {/* Minimal Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              href="#features"
              className="text-white hover:text-white/80 transition-colors text-sm"
            >
              Features
            </Link>
            <Link
              href="#pricing"
              className="text-white hover:text-white/80 transition-colors text-sm"
            >
              Pricing
            </Link>
            <Link
              href="#contact"
              className="text-white hover:text-white/80 transition-colors text-sm"
            >
              Contact
            </Link>
          </div>
          {/* Simple CTA */}
          <div className="flex items-center">
            <button className="px-4 py-2 text-sm font-medium text-white border border-white/30 rounded-md bg-transparent hover:bg-white hover:text-black transition-all duration-200">
              Get Started
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
