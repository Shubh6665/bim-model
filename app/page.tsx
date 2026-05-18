import { Navbar } from "./components/ui/navbar";
import { HeroSection } from "./components/dashboard/hero-section";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
    </div>
  );
}
