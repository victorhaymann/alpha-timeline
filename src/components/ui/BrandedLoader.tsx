import tnfLogo from "@/assets/tnf-loading-logo.png";

export function BrandedLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
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
