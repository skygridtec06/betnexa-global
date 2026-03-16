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
        {/* Live Matches Section */}
        {filteredGames.filter(g => g.status === 'live').length > 0 && (
          <div className="mb-10">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold uppercase tracking-wider text-foreground">
                <span className="inline-block h-3 w-3 rounded-full bg-live mr-2 animate-pulse" />
                🔴 Live Matches
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredGames.filter(g => g.status === 'live').map((game) => {
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

        {/* Upcoming Matches Section */}
        {filteredGames.filter(g => g.status === 'upcoming').length > 0 && (
          <div className="mb-10">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold uppercase tracking-wider text-foreground">
                <TrendingUp className="mr-2 inline h-5 w-5 text-primary" />
                Upcoming Matches
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sortGamesByKickoffTime(filteredGames.filter(g => g.status === 'upcoming')).map((game) => {
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

        {/* Finished Matches Section */}
        {filteredGames.filter(g => g.status === 'finished').length > 0 && (
          <div className="mb-10">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold uppercase tracking-wider text-foreground">
                <span className="text-gray-500 mr-2">✓</span>
                Finished Matches
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {filteredGames
                .filter(g => g.status === 'finished')
                .slice(0, showAllFinished ? undefined : 2)
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
            {filteredGames.filter(g => g.status === 'finished').length > 2 && !showAllFinished && (
              <Button
                onClick={() => setShowAllFinished(true)}
                className="mt-4 w-full"
                variant="outline"
              >
                Show More Matches
              </Button>
            )}
            {showAllFinished && filteredGames.filter(g => g.status === 'finished').length > 2 && (
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

        {filteredGames.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {searchQuery ? `No matches found for "${searchQuery}"` : "No matches available. Check back soon!"}
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
