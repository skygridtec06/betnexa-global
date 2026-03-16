import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, User, Wallet, Bell, Search, ChevronDown, LogOut, Download, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Logo from "@/assets/betnexa official logo .jpeg";
import betnexaAPK from "@/assets/betnexa apk.apk";
import { useBets } from "@/context/BetContext";
import { useUser } from "@/context/UserContext";

const sports = [
  { name: "Football", path: "/", emoji: "⚽" },
  { name: "Basketball", path: "/basketball", emoji: "🏀" },
  { name: "Tennis", path: "/tennis", emoji: "🎾" },
  { name: "Cricket", path: "/cricket", emoji: "🏏" },
  { name: "Boxing", path: "/boxing", emoji: "🥊" },
];

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadNotification, setDownloadNotification] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { balance } = useBets();
  const { isLoggedIn, logout, user } = useUser();
  const compactBalance = new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(balance);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleDownloadAPK = async () => {
    try {
      setIsDownloading(true);
      setDownloadNotification(true);

      // Create a temporary link to download the APK
      const link = document.createElement("a");
      link.href = betnexaAPK;
      link.download = "betnexa.apk";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Hide notification after the download starts
      setTimeout(() => {
        setDownloadNotification(false);
      }, 3000);

      setIsDownloading(false);
    } catch (error) {
      console.error("Error downloading APK:", error);
      setIsDownloading(false);
      alert("Error downloading APK. Please try again.");
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <img src={Logo} alt="BETNEXA Logo" className="h-12 w-12" />
          <span className="font-display text-xl font-bold tracking-wider text-foreground hidden sm:inline">
            BET<span className="text-primary">NEXA</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {sports.map((sport) => (
            <div
              key={sport.name}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors opacity-50 cursor-not-allowed ${
                location.pathname === sport.path
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground"
              }`}
            >
              <span>{sport.emoji}</span>
              {sport.name}
            </div>
          ))}
          <div
            className="ml-1 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium opacity-50 cursor-not-allowed"
            style={{ color: "var(--live)" }}
          >
            <span className="pulse-live inline-block h-2 w-2 rounded-full bg-live" />
            Live
          </div>
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="hidden items-center gap-2 md:flex">
            <Button variant="ghost" size="icon" disabled className="opacity-50 cursor-not-allowed pointer-events-none">
              <Search className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="relative opacity-50 cursor-not-allowed pointer-events-none" disabled>
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-live" />
            </Button>
            {isLoggedIn && (
              <Link to="/finance">
                <Button size="sm" className="h-8 px-2.5 text-xs bg-yellow-400 text-black hover:bg-yellow-300 font-semibold whitespace-nowrap">
                  <PlusCircle className="mr-1 h-3.5 w-3.5" />
                  Deposit
                </Button>
              </Link>
            )}
            {isLoggedIn && (
              <div className="flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1.5 max-w-[160px]">
                <Wallet className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-xs font-bold text-foreground whitespace-nowrap truncate">KSH {balance.toLocaleString()}</span>
              </div>
            )}
            {isLoggedIn && user?.isAdmin && (
              <Link to="/muleiadmin">
                <Button variant="outline" size="sm" className="text-orange-500 border-orange-500 hover:bg-orange-500/10">
                  🔐 Admin
                </Button>
              </Link>
            )}
            {isLoggedIn && (
              <Button variant="destructive" size="sm" onClick={handleLogout}>
                <LogOut className="mr-1 h-4 w-4" />
                Logout
              </Button>
            )}
          </div>
          <div className="flex items-center gap-1.5 md:hidden min-w-0">
            {isLoggedIn && (
              <Link to="/finance">
                <Button size="sm" className="h-7 px-2 text-[11px] bg-yellow-400 text-black hover:bg-yellow-300 font-semibold whitespace-nowrap">
                  <PlusCircle className="mr-1 h-3 w-3" />
                  Deposit
                </Button>
              </Link>
            )}
            {isLoggedIn && (
              <div className="flex items-center gap-1 rounded-lg bg-secondary px-2 py-1 max-w-[120px] min-w-0">
                <Wallet className="h-3 w-3 text-primary shrink-0" />
                <span className="text-[11px] font-bold text-foreground whitespace-nowrap truncate">KSH {compactBalance}</span>
              </div>
            )}
            <button
              className="text-foreground"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="animate-fade-up border-t border-border bg-background px-4 py-4 md:hidden">
          <div className="flex flex-col gap-2">
            {sports.map((sport) => (
              <div
                key={sport.name}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm opacity-50 cursor-not-allowed"
              >
                <span>{sport.emoji}</span>
                {sport.name}
              </div>
            ))}
            {isLoggedIn && user?.isAdmin && (
              <Link to="/muleiadmin" onClick={() => setMenuOpen(false)}>
                <Button variant="outline" size="sm" className="w-full text-orange-500 border-orange-500 hover:bg-orange-500/10">
                  🔐 Admin Panel
                </Button>
              </Link>
            )}
            {/* Download APK Button */}
            <button
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-primary hover:bg-secondary w-full font-medium transition-colors"
              onClick={() => {
                handleDownloadAPK();
                setMenuOpen(false);
              }}
              disabled={isDownloading}
            >
              <Download className="h-4 w-4" />
              {isDownloading ? "Downloading APK..." : "Download APK"}
            </button>
            {isLoggedIn && (
              <button
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-secondary w-full"
                onClick={() => {
                  handleLogout();
                  setMenuOpen(false);
                }}
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            )}
          </div>
        </div>
      )}

      {/* Download Notification Toast */}
      {downloadNotification && (
        <div className="fixed bottom-24 left-4 right-4 animate-fade-up bg-primary text-primary-foreground rounded-lg px-4 py-3 shadow-lg flex items-center gap-2 z-50">
          <Download className="h-4 w-4 animate-pulse" />
          <span className="text-sm font-medium">Download in progress... Please wait</span>
        </div>
      )}
    </header>
  );
}
