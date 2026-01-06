"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Wine, MessageCircle, Camera, Star } from "lucide-react";
import Button from "@/components/ui/Button";
import Link from "next/link";

export default function HomePage() {
  const { user, loading, checkingRedirect } = useAuth();
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Wait for BOTH auth loading AND redirect check to complete before redirecting
    if (!loading && !checkingRedirect && user) {
      router.push("/cellar");
    }
  }, [user, loading, checkingRedirect, router]);

  // Trigger animations after component mounts
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Show loading state while checking auth OR processing OAuth redirect
  if (loading || checkingRedirect) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-wine-600">
        <div className="animate-pulse">
          <Wine className="w-16 h-16 text-white" />
        </div>
      </div>
    );
  }

  const features = [
    {
      icon: Wine,
      title: "Track Your Collection",
      description:
        "Keep detailed records of every bottle - vintages, regions, tasting notes, and more.",
    },
    {
      icon: MessageCircle,
      title: "AI Sommelier",
      description:
        "Get expert advice on food pairings, serving temperatures, and wine recommendations.",
    },
    {
      icon: Camera,
      title: "Photo Labels",
      description:
        "Snap photos of wine labels to easily identify and remember your favorites.",
    },
    {
      icon: Star,
      title: "Rate & Review",
      description:
        "Rate wines and add personal tasting notes to build your wine knowledge.",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-wine-600 via-wine-700 to-wine-800">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/wine-pattern.svg')] opacity-5" />
        <div className="relative max-w-7xl mx-auto px-4 py-16 sm:py-24">
          <div className="text-center">
            <div
              className={`inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-sm rounded-full mb-6 transition-all duration-700 ${
                isVisible ? "opacity-100 scale-100" : "opacity-0 scale-75"
              }`}
            >
              <Wine className="w-10 h-10 text-white" />
            </div>
            <h1
              className={`text-4xl sm:text-5xl font-bold text-white mb-4 font-[var(--font-playfair)] transition-all duration-700 delay-100 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              Aretae Sommelier
            </h1>
            <p
              className={`text-xl text-wine-100 mb-8 max-w-2xl mx-auto transition-all duration-700 delay-200 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              Your personal wine cellar manager with AI-powered sommelier advice.
              Track, rate, and discover wines like never before.
            </p>
            <div
              className={`flex flex-col sm:flex-row gap-4 justify-center transition-all duration-700 delay-300 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              <Link href="/signup">
                <Button size="lg" className="w-full sm:w-auto !bg-white !text-wine-800 hover:!bg-gray-100 font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all">
                  Get Started Free
                </Button>
              </Link>
              <Link href="/signin">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto !border-2 !border-white !text-white hover:!bg-white/10 font-semibold"
                >
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-white py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Everything You Need
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              From cellar management to AI-powered recommendations, we&apos;ve got you
              covered.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className={`text-center p-6 rounded-2xl bg-gray-50 hover:bg-wine-50 hover:shadow-lg transition-all duration-300 card-hover ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
                style={{ transitionDelay: `${400 + index * 100}ms` }}
              >
                <div className="inline-flex items-center justify-center w-14 h-14 bg-wine-100 rounded-full mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-7 h-7 text-wine-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-wine-50 py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
            Ready to Start Your Wine Journey?
          </h2>
          <p className="text-gray-600 mb-8">
            Join wine enthusiasts who are already managing their collections with
            Aretae Sommelier.
          </p>
          <Link href="/signup">
            <Button size="lg">Create Your Free Account</Button>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-wine-800 text-wine-200 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Wine className="w-5 h-5" />
            <span className="font-semibold text-white">Aretae Sommelier</span>
          </div>
          <p className="text-sm">
            An hommage to Pär Per. Built with love for wine enthusiasts.
          </p>
        </div>
      </footer>
    </div>
  );
}
