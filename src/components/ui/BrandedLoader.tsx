import { useState, useEffect } from "react";
import tnfLogo from "@/assets/tnf-loading-logo.png";

interface BrandedLoaderProps {
  isLoading?: boolean;
  children?: React.ReactNode;
}

export function BrandedLoader({ isLoading = true, children }: BrandedLoaderProps) {
  const [showLoader, setShowLoader] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      // Start fade out animation
      setFadeOut(true);
      // Remove loader after animation completes
      const timer = setTimeout(() => {
        setShowLoader(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  if (!showLoader && children) {
    return <div className="animate-fade-in">{children}</div>;
  }

  if (!showLoader) return null;

  return (
    <div 
      className={`min-h-screen flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="relative">
        {/* Pulsing glow effect */}
        <div className="absolute inset-0 animate-pulse opacity-30 blur-2xl">
          <img 
            src={tnfLogo} 
            alt="" 
            className="w-32 h-32 object-contain"
          />
        </div>
        
        {/* Main logo with subtle animation */}
        <img 
          src={tnfLogo} 
          alt="TNF" 
          className="w-32 h-32 object-contain animate-fade-in"
        />
      </div>
      
      {/* Loading indicator */}
      <div className="mt-8 flex gap-1">
        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}

// Wrapper component for smooth loading transitions
export function LoadingTransition({ 
  loading, 
  children 
}: { 
  loading: boolean; 
  children: React.ReactNode;
}) {
  // Initialize based on initial loading state to prevent infinite loading when already loaded
  const [showContent, setShowContent] = useState(!loading);
  const [fadeOutLoader, setFadeOutLoader] = useState(!loading);

  useEffect(() => {
    if (!loading) {
      setFadeOutLoader(true);
      const timer = setTimeout(() => {
        setShowContent(true);
      }, 400);
      return () => clearTimeout(timer);
    } else {
      setShowContent(false);
      setFadeOutLoader(false);
    }
  }, [loading]);

  return (
    <>
      {!showContent && (
        <div 
          className={`fixed inset-0 z-50 min-h-screen flex flex-col items-center justify-center bg-background transition-opacity duration-400 ${
            fadeOutLoader ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <div className="relative">
            <div className="absolute inset-0 animate-pulse opacity-30 blur-2xl">
              <img src={tnfLogo} alt="" className="w-32 h-32 object-contain" />
            </div>
            <img src={tnfLogo} alt="TNF" className="w-32 h-32 object-contain" />
          </div>
          <div className="mt-8 flex gap-1">
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}
      <div className={`transition-opacity duration-300 ${showContent ? 'opacity-100' : 'opacity-0'}`}>
        {children}
      </div>
    </>
  );
}
