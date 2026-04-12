import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { MatchCard, type Match } from "@/components/MatchCard";
import { FinishedMatchCard } from "@/components/FinishedMatchCard";
import { BettingSlip, type BetSlipItem } from "@/components/BettingSlip";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { TrendingUp, Search } from "lucide-react";
import { useBetAutoCalculation } from "@/hooks/useBetAutoCalculation";
import { useOdds } from "@/context/OddsContext";

type MatchView = "upcoming" | "live" | "ended";

const getMarketFromType = (type: string): string => {
  if (['home', 'draw', 'away'].includes(type)) return '1X2';
  if (type.startsWith('btts')) return 'BTTS';
  if (['over15', 'under15', 'over25', 'under25'].includes(type)) return 'O/U';
  if (type.startsWith('dc')) return 'DC';
  if (type.startsWith('htft')) return 'HT/FT';
  if (type.startsWith('cs')) return 'CS';
  return '1X2';
};

// Helper function to sort games by upcoming kickoff time (closest first)
const sortGamesByKickoffTime = (games: any[]) => {
  return [...games].sort((a, b) => {
    try {
      const timeA = new Date(a.time).getTime();
      const timeB = new Date(b.time).getTime();
      return timeA - timeB; // Earlier times first (upcoming)
    } catch (e) {
      return 0; // If time parsing fails, maintain order
    }
  });
};

const sortEndedGames = (games: any[]) => {
  return [...games].sort((a, b) => {
    try {
      const timeA = new Date(a.time).getTime();
      const timeB = new Date(b.time).getTime();
      return timeB - timeA;
    } catch (e) {
      return 0;
    }
  });
};

const isFutureKickoff = (time: string) => {
  const kickoffMs = new Date(time).getTime();
  if (Number.isNaN(kickoffMs)) return false;
  // Show games until 3 hours after kickoff (covers full match duration)
  const threeHoursMs = 3 * 60 * 60 * 1000;
  return kickoffMs + threeHoursMs > Date.now();
};

const Index = () => {
  const [betSlip, setBetSlip] = useState<BetSlipItem[]>(() => {
    try {
      const raw = localStorage.getItem('betSlipItems');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [selectedOdds, setSelectedOdds] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem('selectedOddsMap');
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  });
  const [showAllFinished, setShowAllFinished] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeView, setActiveView] = useState<MatchView>("upcoming");
  const { games: apiGames } = useOdds();;

  // Persist bet slip selections so they remain even if match cards move/disappear.
  useEffect(() => {
    localStorage.setItem('betSlipItems', JSON.stringify(betSlip));
  }, [betSlip]);

  useEffect(() => {
    localStorage.setItem('selectedOddsMap', JSON.stringify(selectedOdds));
  }, [selectedOdds]);

  // Enable auto bet calculation
  useBetAutoCalculation();

  // Show all games including finished ones
  const games = apiGames;

  const filteredGames = searchQuery.trim()
    ? games.filter((g) => {
        const q = searchQuery.toLowerCase();
        return (
          g.homeTeam?.toLowerCase().includes(q) ||
          g.awayTeam?.toLowerCase().includes(q) ||
          g.league?.toLowerCase().includes(q)
        );
      })
    : games;

  const upcomingGames = sortGamesByKickoffTime(
    filteredGames.filter((g) => g.status === "upcoming" && isFutureKickoff(g.time))
  );
  const liveGames = filteredGames.filter((g) => g.status === "live");
  const endedGames = sortEndedGames(filteredGames.filter((g) => g.status === "finished"));

  const handleSelectOdd = (matchId: string, type: string, odds: number, match: Match) => {
    const key = `${matchId}-${type}`;
    if (selectedOdds[matchId] === key) {
      setSelectedOdds((prev) => { const next = { ...prev }; delete next[matchId]; return next; });
      setBetSlip((prev) => prev.filter((i) => i.matchId !== matchId));
    } else {
      setSelectedOdds((prev) => ({ ...prev, [matchId]: key }));
      const market = getMarketFromType(type);
      setBetSlip((prev) => [
        ...prev.filter((i) => i.matchId !== matchId),
        { matchId, match: `${match.homeTeam} vs ${match.awayTeam}`, type, market, odds },
      ]);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />

      {/* Search Bar */}
      <section className="container mx-auto px-4 pt-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search teams or leagues..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg bg-secondary border border-border pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-lg leading-none"
            >
              ×
            </button>
          )}
        </div>
      </section>

      {/* Matches - Organized by Status */}
      <section className="container mx-auto px-4 py-4">
        <div className="mb-6 flex flex-wrap gap-2">
          <Button
            variant={activeView === "upcoming" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveView("upcoming")}
            className="min-w-[92px]"
          >
            Upcoming
          </Button>
          <Button
            variant={activeView === "live" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveView("live")}
            className="min-w-[92px]"
          >
            LIVE
          </Button>
          <Button
            variant={activeView === "ended" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveView("ended")}
            className="min-w-[92px]"
          >
            ENDED
          </Button>
        </div>

        {activeView === "upcoming" && upcomingGames.length > 0 && (
          <div className="mb-10">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold uppercase tracking-wider text-foreground">
                <TrendingUp className="mr-2 inline h-5 w-5 text-primary" />
                Upcoming Matches
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {upcomingGames.map((game) => {
                const match: Match = {
                  id: game.id,
                  league: game.league,
                  homeTeam: game.homeTeam,
                  awayTeam: game.awayTeam,
                  homeOdds: game.homeOdds,
                  drawOdds: game.drawOdds,
                  awayOdds: game.awayOdds,
                  time: game.time,
                  markets: game.markets,
                };
                return (
                  <MatchCard
                    key={game.id}
                    match={match}
                    onSelectOdd={(id, type, odds) => handleSelectOdd(id, type, odds, match)}
                    selectedOdd={selectedOdds[game.id] || null}
                  />
                );
              })}
            </div>
          </div>
        )}

        {activeView === "live" && liveGames.length > 0 && (
          <div className="mb-10">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold uppercase tracking-wider text-foreground">
                <span className="inline-block h-3 w-3 rounded-full bg-live mr-2 animate-pulse" />
                LIVE Matches
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {liveGames.map((game) => {
                const match: Match = {
                  id: game.id,
                  league: game.league,
                  homeTeam: game.homeTeam,
                  awayTeam: game.awayTeam,
                  homeOdds: game.homeOdds,
                  drawOdds: game.drawOdds,
                  awayOdds: game.awayOdds,
                  time: game.time,
                  markets: game.markets,
                };
                return (
                  <MatchCard
                    key={game.id}
                    match={match}
                    onSelectOdd={(id, type, odds) => handleSelectOdd(id, type, odds, match)}
                    selectedOdd={selectedOdds[game.id] || null}
                  />
                );
              })}
            </div>
          </div>
        )}

        {activeView === "ended" && endedGames.length > 0 && (
          <div className="mb-10">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold uppercase tracking-wider text-foreground">
                <span className="text-gray-500 mr-2">✓</span>
                Ended Matches
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {endedGames
                .slice(0, showAllFinished ? undefined : 6)
                .map((game) => (
                  <FinishedMatchCard
                    key={game.id}
                    match={{
                      id: game.id,
                      league: game.league,
                      homeTeam: game.homeTeam,
                      awayTeam: game.awayTeam,
                      time: game.time,
                      homeScore: game.homeScore,
                      awayScore: game.awayScore,
                    }}
                  />
                ))}
            </div>
            {endedGames.length > 6 && !showAllFinished && (
              <Button
                onClick={() => setShowAllFinished(true)}
                className="mt-4 w-full"
                variant="outline"
              >
                Show More Matches
              </Button>
            )}
            {showAllFinished && endedGames.length > 6 && (
              <Button
                onClick={() => setShowAllFinished(false)}
                className="mt-4 w-full"
                variant="outline"
              >
                Show Less
              </Button>
            )}
          </div>
        )}

        {((activeView === "upcoming" && upcomingGames.length === 0) ||
          (activeView === "live" && liveGames.length === 0) ||
          (activeView === "ended" && endedGames.length === 0)) && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {searchQuery ? `No matches found for "${searchQuery}"` : `No ${activeView} matches available right now.`}
            </p>
          </div>
        )}
      </section>

      <BettingSlip
        items={betSlip}
        onRemove={(id) => {
          setBetSlip((prev) => prev.filter((i) => i.matchId !== id));
          setSelectedOdds((prev) => { const next = { ...prev }; delete next[id]; return next; });
        }}
        onClear={() => { setBetSlip([]); setSelectedOdds({}); }}
      />

      <BottomNav />
    </div>
  );
};

export default Index;
