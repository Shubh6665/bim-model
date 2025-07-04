import { Navbar } from "./components/navbar";
import { HeroSection } from "./components/hero-section";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <HeroSection />
    </div>
  );
}
