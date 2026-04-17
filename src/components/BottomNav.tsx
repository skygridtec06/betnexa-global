import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Wallet, Ticket, History, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";

const navItems = [
  { name: "Home", icon: Home, path: "/", requiresAuth: false },
  { name: "Finance", icon: Wallet, path: "/finance", requiresAuth: true },
  { name: "My Bets", icon: Ticket, path: "/my-bets", requiresAuth: true },
  { name: "History", icon: History, path: "/history", requiresAuth: true },
  { name: "Profile", icon: User, path: "/profile", requiresAuth: true },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn } = useUser();

  const handleNavClick = (path: string, requiresAuth: boolean) => {
    if (requiresAuth && !isLoggedIn) {
      navigate("/signup");
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/50 bg-background/95 backdrop-blur-md">
      <div className="flex items-center justify-around px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={(e) => {
                if (item.requiresAuth && !isLoggedIn) {
                  e.preventDefault();
                  navigate("/signup");
                }
              }}
              className={cn(
                "flex flex-col items-center gap-1 py-3 px-2 text-xs font-medium transition-colors",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground",
                item.requiresAuth && !isLoggedIn && "opacity-50"
              )}
              title={item.requiresAuth && !isLoggedIn ? "Sign up to access this feature" : ""}
            >
              <Icon className="h-6 w-6" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
