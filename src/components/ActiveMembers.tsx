import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Users, LogIn, LogOut, Dot, RefreshCw } from "lucide-react";
import { usePresence } from "@/context/PresenceContext";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatTimeInEAT } from "@/lib/timezoneFormatter";

interface UserPresence {
  id: string;
  user_id: string;
  session_id: string;
  last_activity: string;
  login_time: string;
  status: 'online' | 'idle' | 'offline';
  users?: {
    id: string;
    username: string;
    phone_number: string;
    email: string;
    total_bets: number;
    total_winnings: number;
    account_balance: number;
  };
}

export function ActiveMembers() {
  const { activeUsers, activeCount } = usePresence();
  const [isOpen, setIsOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'username'>('recent');
  const [refreshing, setRefreshing] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL || 'https://server-tau-puce.vercel.app';

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const response = await fetch(`${apiUrl}/api/presence/active`, {
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      console.log('✅ Active members refreshed:', data);
    } catch (error) {
      console.error('❌ Error refreshing members:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const sortedUsers = [...activeUsers].sort((a, b) => {
    if (sortBy === 'recent') {
      return new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime();
    } else {
      return (a.users?.username || '').localeCompare(b.users?.username || '');
    }
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <div className="gradient-card rounded-xl border border-border/50 p-5 card-glow cursor-pointer hover:border-primary/50 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Active Members</p>
              <p className="mt-1 font-display text-2xl font-bold text-primary">{activeCount}</p>
            </div>
            <div className="relative">
              <Users className="h-8 w-8 text-primary opacity-30" />
              <Dot className="absolute top-0 right-0 h-4 w-4 text-green-500 animate-pulse" />
            </div>
          </div>
        </div>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-96 overflow-hidden flex flex-col bg-card border-border">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Active Members Online
              </DialogTitle>
              <DialogDescription className="mt-1">
                {activeCount} user{activeCount !== 1 ? 's' : ''} currently on the platform
              </DialogDescription>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleRefresh}
              disabled={refreshing}
              className="gap-1"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </DialogHeader>

        {/* Sort Options */}
        <div className="flex gap-2 mb-4 border-b border-border pb-3">
          <Button
            size="sm"
            variant={sortBy === 'recent' ? 'default' : 'outline'}
            onClick={() => setSortBy('recent')}
            className="text-xs"
          >
            Most Recent
          </Button>
          <Button
            size="sm"
            variant={sortBy === 'username' ? 'default' : 'outline'}
            onClick={() => setSortBy('username')}
            className="text-xs"
          >
            Username
          </Button>
        </div>

        {/* Active Users List */}
        <ScrollArea className="flex-1 pr-4">
          {sortedUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No active members currently</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedUsers.map((presence: UserPresence) => {
                const user = presence.users;
                const timeSinceLogin = new Date(presence.login_time).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                });
                const lastActivityTime = new Date(presence.last_activity).getTime();
                const nowTime = new Date().getTime();
                const secondsAgo = Math.round((nowTime - lastActivityTime) / 1000);

                return (
                  <div key={presence.session_id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border hover:bg-secondary/70 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Dot className="h-3 w-3 text-green-500 animate-pulse flex-shrink-0" />
                        <p className="font-semibold text-sm text-foreground truncate">
                          {user?.username || 'Unknown'}
                        </p>
                        <Badge variant="outline" className="text-xs ml-auto flex-shrink-0">
                          Online
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <p>📧 {user?.email || 'N/A'}</p>
                        <p>📱 {user?.phone_number || 'N/A'}</p>
                        <p>🎯 Bets: {user?.total_bets || 0}</p>
                        <p>💰 Winnings: KSH {user?.total_winnings?.toLocaleString() || 0}</p>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground/70">
                        <p>
                          📍 Logged in: {timeSinceLogin} 
                          {secondsAgo > 0 && ` • Active ${secondsAgo}s ago`}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer Stats */}
        <div className="mt-4 pt-3 border-t border-border text-xs text-muted-foreground">
          <div className="grid grid-cols-3 gap-2">
            <div className="flex items-center gap-1">
              <LogIn className="h-3 w-3 text-green-500" />
              <span>All users reporting live</span>
            </div>
            <div className="flex items-center gap-1">
              <RefreshCw className="h-3 w-3 text-blue-500" />
              <span>Updates every 1.5s</span>
            </div>
            <div className="flex items-center gap-1">
              <Dot className="h-3 w-3 text-primary animate-pulse" />
              <span>Real-time tracking</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
