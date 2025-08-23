import { LoginForm } from "@/app/components/login-form";
import { Suspense } from "react";

export function HeroSection() {
  return (
    <section className="min-h-screen relative flex items-center pt-16">
      {/* Full Background Image */}
      <div className="absolute inset-0">
        <img src="/bim-hero.png" alt="Modern Architecture BIM Visualization" className="w-full h-full object-cover" />
        {/* Left to Right Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-black/60 to-black/90"></div>
      </div>

      {/* Content Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left Side - Content */}
          <div className="space-y-8 text-white">
            <div className="space-y-6">
              <div className="inline-block">
                <span className="bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium">
                  Next-Gen BIM Platform
                </span>
              </div>

              <h1 className="text-5xl lg:text-7xl font-light leading-tight tracking-tight">
                Design
                <span className="block font-bold">Tomorrow</span>
              </h1>

              <p className="text-xl text-white/90 font-light leading-relaxed max-w-lg">
                Where architectural vision meets cutting-edge technology. Create, visualize, and build with precision.
              </p>
            </div>

            <div className="flex items-center space-x-6">
              <button className="inline-flex items-center px-8 py-3 text-base font-medium text-black bg-white rounded-md hover:bg-white/90 transition-colors">
                Start Creating
                <svg className="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <div className="text-white/80">
                <div className="text-sm font-light">Trusted by</div>
                <div className="text-lg font-semibold">500+ Architects</div>
              </div>
            </div>
          </div>

          {/* Right Side - Login Form Overlay */}
          <div className="flex justify-center lg:justify-end">
            <div className="w-full max-w-md">
              <Suspense fallback={<div className="w-full max-w-md h-[540px] bg-white/70 rounded-2xl shadow-2xl" />}> 
                <LoginForm />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

