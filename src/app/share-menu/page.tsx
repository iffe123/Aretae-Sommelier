"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Wine } from "@/types/wine";
import {
  ArrowLeft,
  Share2,
  Download,
  Copy,
  Check,
  Edit3,
  Wine as WineIcon,
  MapPin,
  Grape,
} from "lucide-react";
import html2canvas from "html2canvas";

export default function ShareMenuPage() {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [wines, setWines] = useState<Wine[]>([]);
  const [title, setTitle] = useState("Kvällens viner");
  const [greeting, setGreeting] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingGreeting, setIsEditingGreeting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showShareSuccess, setShowShareSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load wines from sessionStorage
    const stored = sessionStorage.getItem("menuWines");
    if (stored) {
      try {
        const parsedWines = JSON.parse(stored);
        setWines(parsedWines);
      } catch (e) {
        console.error("Failed to parse menu wines:", e);
        router.push("/cellar");
      }
    } else {
      router.push("/cellar");
    }
  }, [router]);

  // Helper function to convert SVG to data URL for html2canvas compatibility
  const svgToDataURL = (svg: SVGElement): string => {
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    return URL.createObjectURL(svgBlob);
  };

  // Helper function to convert dataURL to Blob
  const dataURLToBlob = (dataURL: string): Blob => {
    const byteString = atob(dataURL.split(",")[1]);
    const mimeString = dataURL.split(",")[0].split(":")[1].split(";")[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  };

  const generateImage = async (): Promise<Blob | null> => {
    if (!menuRef.current) {
      setError("Kunde inte hitta menyn. Försök ladda om sidan.");
      return null;
    }

    setIsGenerating(true);
    setError(null);

    // Store URLs created for cleanup
    const createdUrls: string[] = [];

    try {
      // Wait for next frame to ensure DOM is fully rendered
      await new Promise((resolve) => requestAnimationFrame(resolve));
      // Additional small delay for any async rendering
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Detect mobile for reduced scale to avoid memory issues
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const scale = isMobile ? 1.5 : 2;

      // Store reference before async operation
      const element = menuRef.current;
      if (!element) {
        throw new Error("Menu element became unavailable");
      }

      const canvas = await html2canvas(element, {
        backgroundColor: "#1f2937",
        scale: scale,
        useCORS: true,
        allowTaint: true,
        logging: process.env.NODE_ENV === "development",
        foreignObjectRendering: false,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        removeContainer: true,
        imageTimeout: 15000,
        onclone: (_clonedDoc: Document, clonedElement: HTMLElement) => {
          try {
            // Convert SVGs to img elements for better compatibility
            const svgs = clonedElement.querySelectorAll("svg");
            svgs.forEach((svg) => {
              try {
                // Get the computed dimensions
                const rect = svg.getBoundingClientRect();
                const width = rect.width || 24;
                const height = rect.height || 24;

                // Set explicit dimensions on SVG for serialization
                svg.setAttribute("width", String(width));
                svg.setAttribute("height", String(height));

                // Create data URL from SVG
                const url = svgToDataURL(svg);
                createdUrls.push(url);

                // Create img element to replace SVG
                const img = document.createElement("img");
                img.src = url;
                img.width = width;
                img.height = height;
                img.style.cssText = svg.style.cssText;
                img.className = svg.className.baseVal || "";

                // Replace SVG with img
                if (svg.parentNode) {
                  svg.parentNode.replaceChild(img, svg);
                }
              } catch (svgError) {
                // If conversion fails, just hide the SVG
                console.warn("SVG conversion failed, hiding:", svgError);
                svg.style.visibility = "hidden";
              }
            });
          } catch (e) {
            console.warn("onclone error (ignored):", e);
          }
        },
      });

      // Convert canvas to blob with fallback
      let blob: Blob | null = null;

      // Try toBlob first (preferred method)
      try {
        blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(
            (result) => resolve(result),
            "image/png",
            1.0
          );
        });
      } catch (toBlobError) {
        console.warn("toBlob failed, trying dataURL fallback:", toBlobError);
      }

      // Fallback to dataURL if toBlob failed or returned null
      if (!blob) {
        try {
          const dataURL = canvas.toDataURL("image/png");
          blob = dataURLToBlob(dataURL);
        } catch (dataURLError) {
          console.error("dataURL fallback failed:", dataURLError);
          throw new Error("Could not convert canvas to image");
        }
      }

      return blob;
    } catch (error) {
      console.error("Failed to generate image:", error);
      if (error instanceof Error) {
        console.error("Error details:", error.message, error.stack);
      }
      setError("Kunde inte skapa bilden. Försök igen.");
      return null;
    } finally {
      // Cleanup created URLs
      createdUrls.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // Ignore cleanup errors
        }
      });
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    try {
      const blob = await generateImage();
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.toLowerCase().replace(/\s+/g, "-")}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
      setError("Nedladdningen misslyckades. Försök igen.");
    }
  };

  const handleShare = async () => {
    try {
      const blob = await generateImage();
      if (!blob) return;

      const file = new File([blob], `${title}.png`, { type: "image/png" });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: title,
            text: greeting || "Se vilka viner vi serverar ikväll!",
            files: [file],
          });
          setShowShareSuccess(true);
          setTimeout(() => setShowShareSuccess(false), 2000);
        } catch (shareError) {
          // User cancelled or share failed, try fallback
          if ((shareError as Error).name !== "AbortError") {
            handleDownload();
          }
        }
      } else {
        // Fallback to download
        handleDownload();
      }
    } catch (err) {
      console.error("Share failed:", err);
      setError("Delningen misslyckades. Försök igen.");
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      const blob = await generateImage();
      if (!blob) return;

      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            "image/png": blob,
          }),
        ]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (clipboardError) {
        console.error("Failed to copy to clipboard:", clipboardError);
        // Fallback to download
        setError("Kunde inte kopiera till urklipp. Laddar ner istället...");
        setTimeout(() => setError(null), 2000);
        handleDownload();
      }
    } catch (err) {
      console.error("Copy failed:", err);
      setError("Kopieringen misslyckades. Försök igen.");
    }
  };

  if (wines.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse">
          <WineIcon className="w-12 h-12 text-wine-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Tillbaka</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyToClipboard}
                disabled={isGenerating}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
                title="Kopiera bild"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-green-600" />
                ) : (
                  <Copy className="w-5 h-5 text-gray-600" />
                )}
              </button>
              <button
                onClick={handleDownload}
                disabled={isGenerating}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
                title="Ladda ner bild"
              >
                <Download className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={handleShare}
                disabled={isGenerating}
                className="flex items-center gap-2 bg-wine-600 hover:bg-wine-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                <Share2 className="w-4 h-4" />
                {isGenerating ? "Skapar..." : "Dela"}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Success Toast */}
      {showShareSuccess && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in">
          Delat!
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div
          className="fixed top-20 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in cursor-pointer"
          onClick={() => setError(null)}
        >
          {error}
        </div>
      )}

      {/* Preview Area */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-center text-gray-500 mb-4">
          Förhandsvisning av din middagsmeny
        </p>

        {/* Menu Card - This is what gets captured */}
        <div
          ref={menuRef}
          className="bg-gradient-to-br from-gray-900 via-gray-800 to-wine-900 rounded-2xl p-8 shadow-2xl"
        >
          {/* Decorative top border */}
          <div className="flex justify-center mb-6">
            <div className="flex items-center gap-4">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-wine-400" />
              <WineIcon className="w-8 h-8 text-wine-400" />
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-wine-400" />
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            {isEditingTitle ? (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => e.key === "Enter" && setIsEditingTitle(false)}
                autoFocus
                className="bg-transparent text-3xl md:text-4xl font-serif text-wine-200 text-center w-full outline-none border-b border-wine-400 pb-2"
              />
            ) : (
              <h1
                className="text-3xl md:text-4xl font-serif text-wine-200 cursor-pointer hover:text-wine-100 transition-colors group flex items-center justify-center gap-2"
                onClick={() => setIsEditingTitle(true)}
              >
                {title}
                <Edit3 className="w-4 h-4 opacity-0 group-hover:opacity-50 transition-opacity" />
              </h1>
            )}
          </div>

          {/* Greeting */}
          <div className="text-center mb-10">
            {isEditingGreeting ? (
              <textarea
                value={greeting}
                onChange={(e) => setGreeting(e.target.value)}
                onBlur={() => setIsEditingGreeting(false)}
                placeholder="Lägg till en personlig hälsning..."
                autoFocus
                rows={2}
                className="bg-transparent text-gray-300 text-center w-full outline-none border-b border-gray-600 pb-2 resize-none"
              />
            ) : (
              <p
                className="text-gray-400 italic cursor-pointer hover:text-gray-300 transition-colors group flex items-center justify-center gap-2"
                onClick={() => setIsEditingGreeting(true)}
              >
                {greeting || "Tryck för att lägga till hälsning..."}
                <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
              </p>
            )}
          </div>

          {/* Wine List */}
          <div className="space-y-6">
            {wines.map((wine, index) => (
              <div
                key={wine.id}
                className="border-b border-gray-700 pb-6 last:border-b-0 last:pb-0"
              >
                {/* Wine Header */}
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-white">
                      {wine.name}
                    </h3>
                    <p className="text-wine-300">{wine.winery}</p>
                  </div>
                  <span className="text-2xl font-light text-wine-200">
                    {wine.vintage}
                  </span>
                </div>

                {/* Wine Details */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-400">
                  {wine.grapeVariety && (
                    <span className="flex items-center gap-1">
                      <Grape className="w-3.5 h-3.5 text-wine-400" />
                      {wine.grapeVariety}
                    </span>
                  )}
                  {wine.region && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-wine-400" />
                      {wine.region}, {wine.country}
                    </span>
                  )}
                </div>

                {/* Wine number indicator */}
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-gray-500 uppercase tracking-wider">
                    Vin {index + 1}
                  </span>
                  <div className="flex-1 h-px bg-gray-700" />
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-10 pt-6 border-t border-gray-700 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-widest">
              Skapad med Aretae Sommelier
            </p>
          </div>
        </div>

        {/* Tips */}
        <div className="mt-8 bg-white rounded-lg p-4 border border-gray-200">
          <h3 className="font-medium text-gray-900 mb-2">Tips</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>- Tryck på titeln eller hälsningen för att redigera</li>
            <li>- Använd &quot;Dela&quot;-knappen för att skicka via SMS, WhatsApp etc.</li>
            <li>- Ladda ner som bild för att spara eller skriva ut</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
