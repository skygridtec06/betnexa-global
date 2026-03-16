import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import heroImage from "@/assets/hero-stadium.svg";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MatchCard, type Match, generateMarketOdds } from "@/components/MatchCard";
import { FinishedMatchCard } from "@/components/FinishedMatchCard";
import { BettingSlip, type BetSlipItem } from "@/components/BettingSlip";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { PromoBanner } from "@/components/PromoBanner";
import { Zap, LogIn, UserPlus, TrendingUp, Trophy, Star } from "lucide-react";
import { useBetAutoCalculation } from "@/hooks/useBetAutoCalculation";
import { useOdds } from "@/context/OddsContext";
import { useUser } from "@/context/UserContext";

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
  const { games: apiGames } = useOdds();;
  const { isLoggedIn } = useUser();

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

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-background via-secondary to-background">
        <div className="absolute inset-0">
          <img src={heroImage} alt="Stadium" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        </div>
        <div className="container relative z-10 mx-auto px-4 py-20 md:py-32">
          <div className="max-w-2xl">
            <Badge variant="gold" className="mb-4">
              <Trophy className="mr-1 h-3 w-3" /> #1 Sportsbook Platform
            </Badge>
            <h1 className="mb-4 font-display text-4xl font-bold uppercase leading-tight tracking-wider text-foreground md:text-6xl">
              Bet <span className="text-glow text-primary">Smarter</span>,<br />
              Win <span className="text-glow text-primary">Bigger</span>
            </h1>
            <p className="mb-8 max-w-lg text-lg text-muted-foreground">
              Experience the thrill of live sports betting with the best odds, instant payouts, and real-time match tracking.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="hero" size="lg">
                <Zap className="mr-1 h-4 w-4" /> Start Betting
              </Button>
              {!isLoggedIn && (
                <>
                  <Link to="/login">
                    <Button variant="glow" size="lg">
                      <LogIn className="mr-1 h-4 w-4" /> Login
                    </Button>
                  </Link>
                  <Link to="/signup">
                    <Button variant="outline" size="lg">
                      <UserPlus className="mr-1 h-4 w-4" /> Sign Up
                    </Button>
                  </Link>
                </>
              )}
            </div>
            <div className="mt-8 flex gap-6">
              {[
                { label: "Active Users", value: "6M+" },
                { label: "Bets Placed", value: "14M+" },
                { label: "Payout Rate", value: "98.5%" },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="font-display text-xl font-bold text-primary">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <PromoBanner />

      {/* Matches - Organized by Status */}
      <section className="container mx-auto px-4 py-10">
        {/* Live Matches Section */}
        {games.filter(g => g.status === 'live').length > 0 && (
          <div className="mb-10">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold uppercase tracking-wider text-foreground">
                <span className="inline-block h-3 w-3 rounded-full bg-live mr-2 animate-pulse" />
                🔴 Live Matches
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {games.filter(g => g.status === 'live').map((game) => {
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
        {games.filter(g => g.status === 'upcoming').length > 0 && (
          <div className="mb-10">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold uppercase tracking-wider text-foreground">
                <TrendingUp className="mr-2 inline h-5 w-5 text-primary" />
                Upcoming Matches
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sortGamesByKickoffTime(games.filter(g => g.status === 'upcoming')).map((game) => {
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
        {games.filter(g => g.status === 'finished').length > 0 && (
          <div className="mb-10">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold uppercase tracking-wider text-foreground">
                <span className="text-gray-500 mr-2">✓</span>
                Finished Matches
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {games
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
            {games.filter(g => g.status === 'finished').length > 2 && !showAllFinished && (
              <Button
                onClick={() => setShowAllFinished(true)}
                className="mt-4 w-full"
                variant="outline"
              >
                Show More Matches
              </Button>
            )}
            {showAllFinished && games.filter(g => g.status === 'finished').length > 2 && (
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

        {games.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No matches available. Check back soon!</p>
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
