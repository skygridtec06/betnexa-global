import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useMatches } from "@/context/MatchContext";
import { useOdds } from "@/context/OddsContext";
import { calculateMatchMinute } from "@/lib/gameTimeCalculator";
import { formatKickoffTimeEAT } from "@/lib/timeFormatter";

export interface MatchMarkets {
  bttsYes?: number;
  bttsNo?: number;
  over25?: number;
  under25?: number;
  over15?: number;
  under15?: number;
  doubleChanceHomeOrDraw?: number;
  doubleChanceAwayOrDraw?: number;
  doubleChanceHomeOrAway?: number;
  htftHomeHome?: number;
  htftDrawDraw?: number;
  htftAwayAway?: number;
  htftDrawHome?: number;
  htftDrawAway?: number;
  [key: string]: number | undefined; // For correct scores (cs00, cs01, cs02, etc.)
}

export interface Match {
  id: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  time: string;
  isLive?: boolean;
  homeScore?: number;
  awayScore?: number;
  minute?: string;
  markets?: MatchMarkets;
}

interface MatchCardProps {
  match: Match;
  onSelectOdd?: (matchId: string, type: string, odds: number) => void;
  selectedOdd?: string | null;
}

export function generateMarketOdds(homeOdds: number, drawOdds: number, awayOdds: number, existingMarkets?: Record<string, number>): MatchMarkets {
  // Helper: return odds if they exist in the DB, otherwise return undefined to trigger generation
  const dbVal = (key: string, ...aliases: string[]): number | undefined => {
    for (const k of [key, ...aliases]) {
      const v = existingMarkets?.[k];
      if (typeof v === 'number' && Number.isFinite(v) && v >= 1.01) return +v.toFixed(2);
    }
    return undefined;
  };

  // Check if we have ANY markets from DB
  const hasDbMarkets = existingMarkets && Object.keys(existingMarkets).length > 0;

  // If DB has markets, use them; otherwise generate from pre-match odds
  if (hasDbMarkets) {
    const markets: MatchMarkets = {
      bttsYes: dbVal('bttsYes', 'btts:yes'),
      bttsNo: dbVal('bttsNo', 'btts:no'),
      over25: dbVal('over25', 'over_under:over_2.5'),
      under25: dbVal('under25', 'over_under:under_2.5'),
      over15: dbVal('over15', 'over_under:over_1.5'),
      under15: dbVal('under15', 'over_under:under_1.5'),
      doubleChanceHomeOrDraw: dbVal('doubleChanceHomeOrDraw', 'double_chance:1X'),
      doubleChanceAwayOrDraw: dbVal('doubleChanceAwayOrDraw', 'double_chance:X2'),
      doubleChanceHomeOrAway: dbVal('doubleChanceHomeOrAway', 'double_chance:12'),
      htftHomeHome: dbVal('htftHomeHome', 'half_time_result:1'),
      htftDrawDraw: dbVal('htftDrawDraw', 'half_time_result:X'),
      htftAwayAway: dbVal('htftAwayAway', 'half_time_result:2'),
      htftDrawHome: dbVal('htftDrawHome'),
      htftDrawAway: dbVal('htftDrawAway'),
    };

    // Correct scores — only include if in DB
    for (let hScore = 0; hScore <= 4; hScore++) {
      for (let aScore = 0; aScore <= 4; aScore++) {
        const key = `cs${hScore}${aScore}`;
        const val = dbVal(key, `correct_score:${hScore}:${aScore}`);
        if (val !== undefined) markets[key] = val;
      }
    }

    return markets;
  }

  // No DB markets - generate from pre-match odds using Poisson model for pre-match (0:0, minute 0)
  const { lambdaH, lambdaA } = fitExpectedGoals(homeOdds, drawOdds, awayOdds);
  const matrix = buildScoreMatrix(lambdaH, lambdaA, 8);

  let homeWin = 0, draw = 0, awayWin = 0, bttsYes = 0, over15 = 0, over25 = 0;
  const exactScores: Record<string, number> = {};

  for (const { addHome, addAway, probability } of matrix) {
    const finalHome = addHome;
    const finalAway = addAway;
    const totalGoals = finalHome + finalAway;

    if (finalHome > finalAway) homeWin += probability;
    else if (finalHome === finalAway) draw += probability;
    else awayWin += probability;

    if (finalHome > 0 && finalAway > 0) bttsYes += probability;
    if (totalGoals > 1.5) over15 += probability;
    if (totalGoals > 2.5) over25 += probability;

    if (finalHome <= 4 && finalAway <= 4) {
      exactScores[`cs${finalHome}${finalAway}`] = (exactScores[`cs${finalHome}${finalAway}`] || 0) + probability;
    }
  }

  const generatedMarkets: MatchMarkets = {
    bttsYes: oddsFromProbability(bttsYes, 1.06),
    bttsNo: oddsFromProbability(1 - bttsYes, 1.06),
    over15: oddsFromProbability(over15, 1.06),
    under15: oddsFromProbability(1 - over15, 1.06),
    over25: oddsFromProbability(over25, 1.06),
    under25: oddsFromProbability(1 - over25, 1.06),
    doubleChanceHomeOrDraw: oddsFromProbability(homeWin + draw, 1.05, 25),
    doubleChanceAwayOrDraw: oddsFromProbability(awayWin + draw, 1.05, 25),
    doubleChanceHomeOrAway: oddsFromProbability(homeWin + awayWin, 1.05, 25),
  };

  // Add correct scores
  for (let h = 0; h <= 4; h++) {
    for (let a = 0; a <= 4; a++) {
      const key = `cs${h}${a}`;
      generatedMarkets[key] = oddsFromProbability(exactScores[key] || 0, 1.08);
    }
  }

  // HT/FT calculations for first half
  const firstHalfFactor = 45 / 90;
  const secondHalfFactor = 45 / 90;
  const firstHalfMatrix = buildScoreMatrix(lambdaH * firstHalfFactor, lambdaA * firstHalfFactor, 6);
  const secondHalfMatrix = buildScoreMatrix(lambdaH * secondHalfFactor, lambdaA * secondHalfFactor, 6);

  let hh = 0, dd = 0, aa = 0;

  for (const firstHalf of firstHalfMatrix) {
    const halftimeHome = firstHalf.addHome;
    const halftimeAway = firstHalf.addAway;
    const halftimeProb = firstHalf.probability;
    const halftimeResult = halftimeHome > halftimeAway ? 'H' : halftimeHome === halftimeAway ? 'D' : 'A';

    for (const secondHalf of secondHalfMatrix) {
      const fullTimeHome = halftimeHome + secondHalf.addHome;
      const fullTimeAway = halftimeAway + secondHalf.addAway;
      const probability = halftimeProb * secondHalf.probability;
      const fullTimeResult = fullTimeHome > fullTimeAway ? 'H' : fullTimeHome === fullTimeAway ? 'D' : 'A';

      if (halftimeResult === 'H' && fullTimeResult === 'H') hh += probability;
      if (halftimeResult === 'D' && fullTimeResult === 'D') dd += probability;
      if (halftimeResult === 'A' && fullTimeResult === 'A') aa += probability;
    }
  }

  generatedMarkets.htftHomeHome = oddsFromProbability(hh, 1.08);
  generatedMarkets.htftDrawDraw = oddsFromProbability(dd, 1.08);
  generatedMarkets.htftAwayAway = oddsFromProbability(aa, 1.08);

  return generatedMarkets;
}

// ── In-play Poisson odds model ────────────────────────────────────────────────
// Computes real-time 1X2 odds given pre-match odds + current score + minute.

function poissonPMF(k: number, lambda: number): number {
  if (k < 0 || lambda < 0) return 0;
  if (lambda === 0) return k === 0 ? 1 : 0;
  // Log-space for numerical stability
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 2; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

function fitExpectedGoals(preHome: number, preDraw: number, preAway: number) {
  const rH = 1 / Math.max(preHome, 1.01);
  const rD = 1 / Math.max(preDraw, 1.01);
  const rA = 1 / Math.max(preAway, 1.01);
  const tot = rH + rD + rA;
  const pH = rH / tot;
  const pD = rD / tot;
  const pA = rA / tot;

  const ratio = Math.sqrt(Math.max(pH / Math.max(pA, 0.01), 0.01));

  let lo = 0.3;
  let hi = 9.0;
  for (let iter = 0; iter < 35; iter++) {
    const totalGoals = (lo + hi) / 2;
    const lambdaH = totalGoals * ratio / (1 + ratio);
    const lambdaA = totalGoals / (1 + ratio);
    let drawProb = 0;
    for (let k = 0; k <= 9; k++) {
      drawProb += poissonPMF(k, lambdaH) * poissonPMF(k, lambdaA);
    }
    if (drawProb > pD) lo = totalGoals;
    else hi = totalGoals;
  }

  const totalGoals = (lo + hi) / 2;
  return {
    lambdaH: totalGoals * ratio / (1 + ratio),
    lambdaA: totalGoals / (1 + ratio),
  };
}

function buildScoreMatrix(lambdaH: number, lambdaA: number, maxGoals = 8) {
  const matrix: Array<{ addHome: number; addAway: number; probability: number }> = [];
  for (let addHome = 0; addHome <= maxGoals; addHome++) {
    const pmfH = poissonPMF(addHome, lambdaH);
    if (pmfH < 1e-9) continue;
    for (let addAway = 0; addAway <= maxGoals; addAway++) {
      const pmfA = poissonPMF(addAway, lambdaA);
      if (pmfA < 1e-9) continue;
      matrix.push({ addHome, addAway, probability: pmfH * pmfA });
    }
  }
  return matrix;
}

function oddsFromProbability(probability: number, margin = 1.05, maxOdds = 150) {
  if (!Number.isFinite(probability) || probability <= 0) return undefined;
  return Math.min(Math.max(+((margin / probability).toFixed(2)), 1.01), maxOdds);
}

function computeLiveMarketOdds(
  preHome: number,
  preDraw: number,
  preAway: number,
  homeScore: number,
  awayScore: number,
  minute: number
): MatchMarkets & { home?: number; draw?: number; away?: number } {
  const minuteCapped = Math.min(Math.max(minute, 0), 90);
  const { lambdaH, lambdaA } = fitExpectedGoals(preHome, preDraw, preAway);
  const fullTimeRemainingFactor = Math.max((90 - minuteCapped) / 90, 0.005);
  const remainingMatrix = buildScoreMatrix(lambdaH * fullTimeRemainingFactor, lambdaA * fullTimeRemainingFactor);

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let bttsYes = 0;
  let over15 = 0;
  let over25 = 0;

  const exactScores: Record<string, number> = {};

  for (const { addHome, addAway, probability } of remainingMatrix) {
    const finalHome = homeScore + addHome;
    const finalAway = awayScore + addAway;
    const totalGoals = finalHome + finalAway;

    if (finalHome > finalAway) homeWin += probability;
    else if (finalHome === finalAway) draw += probability;
    else awayWin += probability;

    if (finalHome > 0 && finalAway > 0) bttsYes += probability;
    if (totalGoals > 1.5) over15 += probability;
    if (totalGoals > 2.5) over25 += probability;

    if (finalHome <= 4 && finalAway <= 4) {
      exactScores[`cs${finalHome}${finalAway}`] = (exactScores[`cs${finalHome}${finalAway}`] || 0) + probability;
    }
  }

  const result: MatchMarkets & { home?: number; draw?: number; away?: number } = {
    home: oddsFromProbability(homeWin, 1.05, 60),
    draw: oddsFromProbability(draw, 1.05, 60),
    away: oddsFromProbability(awayWin, 1.05, 60),
    bttsYes: oddsFromProbability(bttsYes, 1.06),
    bttsNo: oddsFromProbability(1 - bttsYes, 1.06),
    over15: oddsFromProbability(over15, 1.06),
    under15: oddsFromProbability(1 - over15, 1.06),
    over25: oddsFromProbability(over25, 1.06),
    under25: oddsFromProbability(1 - over25, 1.06),
    doubleChanceHomeOrDraw: oddsFromProbability(homeWin + draw, 1.05, 25),
    doubleChanceAwayOrDraw: oddsFromProbability(awayWin + draw, 1.05, 25),
    doubleChanceHomeOrAway: oddsFromProbability(homeWin + awayWin, 1.05, 25),
  };

  for (let h = 0; h <= 4; h++) {
    for (let a = 0; a <= 4; a++) {
      const key = `cs${h}${a}`;
      result[key] = oddsFromProbability(exactScores[key] || 0, 1.08);
    }
  }

  if (minuteCapped < 45) {
    const firstHalfFactor = Math.max((45 - minuteCapped) / 90, 0.001);
    const secondHalfFactor = 45 / 90;
    const firstHalfMatrix = buildScoreMatrix(lambdaH * firstHalfFactor, lambdaA * firstHalfFactor, 6);
    const secondHalfMatrix = buildScoreMatrix(lambdaH * secondHalfFactor, lambdaA * secondHalfFactor, 6);

    let hh = 0;
    let dd = 0;
    let aa = 0;
    let dh = 0;
    let da = 0;

    for (const firstHalf of firstHalfMatrix) {
      const halftimeHome = homeScore + firstHalf.addHome;
      const halftimeAway = awayScore + firstHalf.addAway;
      const halftimeProb = firstHalf.probability;
      const halftimeResult = halftimeHome > halftimeAway ? 'H' : halftimeHome === halftimeAway ? 'D' : 'A';

      for (const secondHalf of secondHalfMatrix) {
        const fullTimeHome = halftimeHome + secondHalf.addHome;
        const fullTimeAway = halftimeAway + secondHalf.addAway;
        const probability = halftimeProb * secondHalf.probability;
        const fullTimeResult = fullTimeHome > fullTimeAway ? 'H' : fullTimeHome === fullTimeAway ? 'D' : 'A';

        if (halftimeResult === 'H' && fullTimeResult === 'H') hh += probability;
        if (halftimeResult === 'D' && fullTimeResult === 'D') dd += probability;
        if (halftimeResult === 'A' && fullTimeResult === 'A') aa += probability;
        if (halftimeResult === 'D' && fullTimeResult === 'H') dh += probability;
        if (halftimeResult === 'D' && fullTimeResult === 'A') da += probability;
      }
    }

    result.htftHomeHome = oddsFromProbability(hh, 1.08);
    result.htftDrawDraw = oddsFromProbability(dd, 1.08);
    result.htftAwayAway = oddsFromProbability(aa, 1.08);
    result.htftDrawHome = oddsFromProbability(dh, 1.08);
    result.htftDrawAway = oddsFromProbability(da, 1.08);
  }

  return result;
}

function computeLiveOdds(
  preHome: number, preDraw: number, preAway: number,
  homeScore: number, awayScore: number, minute: number
): { home: number; draw: number; away: number } {
  const markets = computeLiveMarketOdds(preHome, preDraw, preAway, homeScore, awayScore, minute);
  return {
    home: markets.home ?? preHome,
    draw: markets.draw ?? preDraw,
    away: markets.away ?? preAway,
  };
}

type MarketTab = "1X2" | "BTTS" | "O/U" | "DC" | "HT/FT" | "CS";

export function MatchCard({ match, onSelectOdd, selectedOdd }: MatchCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<MarketTab>("1X2");
  const [liveStatus, setLiveStatus] = useState<{ isLive: boolean; minute: number; seconds: number; status: string }>({
    isLive: match.isLive || false,
    minute: match.minute ? parseInt(match.minute) : 0,
    seconds: 0,
    status: "upcoming",
  });

  const { matches } = useMatches();
  const { getGame } = useOdds();

  // Get game from OddsContext if available, otherwise use match prop
  const gameFromContext = getGame(match.id);
  const displayGame = gameFromContext || match;

  // Update live status from context directly (no interval needed, context updates trigger re-render)
  useEffect(() => {
    if (gameFromContext && gameFromContext.id === match.id) {
      setLiveStatus(prev => {
        const next = {
          isLive: gameFromContext.status === "live",
          minute: gameFromContext.minute || 0,
          seconds: gameFromContext.seconds || 0,
          status: gameFromContext.status,
        };
        // Only update if values actually changed
        if (prev.isLive === next.isLive && prev.minute === next.minute && prev.seconds === next.seconds && prev.status === next.status) {
          return prev;
        }
        return next;
      });
    }
  }, [gameFromContext?.minute, gameFromContext?.seconds, gameFromContext?.status, match.id]);

  const preMatchMarkets = useMemo(
    () => generateMarketOdds(displayGame.homeOdds, displayGame.drawOdds, displayGame.awayOdds, displayGame.markets),
    [displayGame.homeOdds, displayGame.drawOdds, displayGame.awayOdds, displayGame.markets]
  );

  const liveMinuteValue = (displayGame.minute ?? 0) + ((displayGame.seconds ?? liveStatus.seconds ?? 0) / 60);

  const computedLiveMarkets = useMemo(() => {
    if (displayGame.status !== 'live') return undefined;
    return computeLiveMarketOdds(
      displayGame.homeOdds,
      displayGame.drawOdds,
      displayGame.awayOdds,
      displayGame.homeScore ?? 0,
      displayGame.awayScore ?? 0,
      liveMinuteValue
    );
  }, [
    displayGame.status,
    displayGame.homeOdds,
    displayGame.drawOdds,
    displayGame.awayOdds,
    displayGame.homeScore,
    displayGame.awayScore,
    liveMinuteValue,
  ]);

  const getMarketOdd = (key: string, aliases: string[] = [], fallback?: number): number | undefined => {
    const keys = [key, ...aliases];

    // IMPORTANT: Always try to get from database first, but ALWAYS fall back to generated odds
    
    // Try each key in database
    for (const k of keys) {
      const v = displayGame.markets?.[k];
      if (typeof v === "number" && Number.isFinite(v) && v >= 1.01) {
        return v;
      }
    }
    
    // If not found in database, use the fallback (generated/precomputed odds)
    // This ensures users always see an odd, even if the database is missing that market type
    return fallback;
  };

  // Real-time in-play 1X2 odds — recalculates every second as minute advances.
  // Prefers real API live odds (liveHome/liveDraw/liveAway from markets) when available,
  // falls back to Poisson model using pre-match odds + current score + time remaining.
  const effectiveOdds = useMemo(() => {
    if (displayGame.status !== 'live') {
      return { home: displayGame.homeOdds, draw: displayGame.drawOdds, away: displayGame.awayOdds };
    }
    const mk = displayGame.markets;
    if (mk?.liveHome && (mk.liveHome as number) > 1.01) {
      return {
        home: mk.liveHome as number,
        draw: (mk.liveDraw as number) ?? displayGame.drawOdds,
        away: (mk.liveAway as number) ?? displayGame.awayOdds,
      };
    }
    return {
      home: computedLiveMarkets?.home ?? displayGame.homeOdds,
      draw: computedLiveMarkets?.draw ?? displayGame.drawOdds,
      away: computedLiveMarkets?.away ?? displayGame.awayOdds,
    };
  }, [
    displayGame.status,
    displayGame.homeOdds, displayGame.drawOdds, displayGame.awayOdds,
    displayGame.homeScore, displayGame.awayScore,
    displayGame.markets,
    computedLiveMarkets,
  ]);

  const handleSelect = (type: string, odds: number) => {
    onSelectOdd?.(match.id, type, odds);
  };

  const OddBtn = ({ label, value, type }: { label: string; value?: number; type: string }) => {
    const isUnavailable = typeof value !== "number" || !Number.isFinite(value) || value < 1.01;
    const isDisabled = displayGame.status === "finished" || (displayGame.status === "live" && isUnavailable);
    return (
    <button
      onClick={() => !isDisabled && typeof value === "number" && handleSelect(type, value)}
      disabled={isDisabled}
      className={`odds-btn text-center ${selectedOdd === `${match.id}-${type}` ? "selected" : ""} ${
        isDisabled ? "opacity-50 cursor-not-allowed" : ""
      }`}
    >
      <span className="block text-[10px] text-muted-foreground">{label}</span>
      <span className="block font-mono text-sm font-bold">{typeof value === "number" ? value.toFixed(2) : "--"}</span>
    </button>
  );
  };

  const tabs: MarketTab[] = ["1X2", "BTTS", "O/U", "DC", "HT/FT", "CS"];

  return (
    <div className="gradient-card rounded-xl border border-border/50 p-4 transition-all hover:border-primary/20 card-glow">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{match.league}</span>
        {liveStatus.isLive ? (
          displayGame.isHalftime ? (
            <Badge variant="live">
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-yellow-500" />
              HALFTIME
            </Badge>
          ) : (
            <Badge variant="live">
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-live" />
              {String(Math.floor(liveStatus.minute)).padStart(2, "0")}:{String(Math.floor(liveStatus.seconds)).padStart(2, "0")}'
            </Badge>
          )
        ) : displayGame.status === "finished" ? (
          <Badge variant="secondary">
            FT
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">{formatKickoffTimeEAT(displayGame.time)}</span>
        )}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">{displayGame.homeTeam}</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{displayGame.awayTeam}</p>
        </div>
        {(liveStatus.isLive || displayGame.status === "finished") && (
          <div className="text-right">
            <p className="text-lg font-bold text-primary">{displayGame.homeScore || 0}</p>
            <p className="text-lg font-bold text-primary">{displayGame.awayScore || 0}</p>
          </div>
        )}
      </div>

      {/* 1X2 always visible */}
      {match.drawOdds > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          <OddBtn label="1" value={effectiveOdds.home} type="home" />
          <OddBtn label="X" value={effectiveOdds.draw} type="draw" />
          <OddBtn label="2" value={effectiveOdds.away} type="away" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <OddBtn label="1" value={effectiveOdds.home} type="home" />
          <OddBtn label="2" value={effectiveOdds.away} type="away" />
        </div>
      )}

      {displayGame.status === "live" && (
        <div className="mt-2 rounded-lg border border-green-500/30 bg-green-500/10 p-2 text-center">
          <p className="text-xs font-semibold text-green-600">🟢 Live Betting Open</p>
        </div>
      )}

      {displayGame.status === "finished" && (
        <div className="mt-2 rounded-lg border border-gray-500/30 bg-gray-500/10 p-2 text-center">
          <p className="text-xs font-semibold text-gray-600">⏹️ Betting Closed - Match Finished</p>
        </div>
      )}

      {/* More markets toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-3 flex w-full items-center justify-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
      >
        {expanded ? "Less markets" : `+${tabs.length - 1} more markets`}
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {expanded && (
        <div className="mt-3 animate-fade-up">
          {/* Market tabs */}
          <div className="mb-3 flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap rounded-md px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                  activeTab === tab
                    ? "bg-primary/20 text-primary border border-primary/40"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Market content */}
          {activeTab === "1X2" && (
            match.drawOdds > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                <OddBtn label="1" value={effectiveOdds.home} type="home" />
                <OddBtn label="X" value={effectiveOdds.draw} type="draw" />
                <OddBtn label="2" value={effectiveOdds.away} type="away" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <OddBtn label="1" value={effectiveOdds.home} type="home" />
                <OddBtn label="2" value={effectiveOdds.away} type="away" />
              </div>
            )
          )}

          {activeTab === "BTTS" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {displayGame.status === "live" ? (
                (() => {
                  const homeScore = displayGame.homeScore || 0;
                  const awayScore = displayGame.awayScore || 0;
                  const homeHasScored = homeScore > 0;
                  const awayHasScored = awayScore > 0;
                  
                  if (homeHasScored && awayHasScored) {
                    // Both have scored - BTTS Yes is settled
                    return <div className="col-span-2 text-center text-xs text-muted-foreground py-2">Both teams have scored</div>;
                  } else {
                    // Neither has scored yet
                    return (
                      <>
                        <OddBtn label="Yes" value={getMarketOdd("bttsYes", ["btts:yes"], preMatchMarkets.bttsYes)} type="btts-yes" />
                        <OddBtn label="No" value={getMarketOdd("bttsNo", ["btts:no"], preMatchMarkets.bttsNo)} type="btts-no" />
                      </>
                    );
                  }
                })()
              ) : (
                <>
                  <OddBtn label="Yes" value={getMarketOdd("bttsYes", ["btts:yes"], preMatchMarkets.bttsYes)} type="btts-yes" />
                  <OddBtn label="No" value={getMarketOdd("bttsNo", ["btts:no"], preMatchMarkets.bttsNo)} type="btts-no" />
                </>
              )}
            </div>
          )}

          {activeTab === "O/U" && (
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground font-medium">Over/Under 1.5</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {displayGame.status !== "live" || (displayGame.homeScore || 0) + (displayGame.awayScore || 0) <= 1 ? (
                  <>
                    <OddBtn label="Over 1.5" value={getMarketOdd("over15", ["over_under:over_1.5"], preMatchMarkets.over15)} type="over15" />
                    <OddBtn label="Under 1.5" value={getMarketOdd("under15", ["over_under:under_1.5"], preMatchMarkets.under15)} type="under15" />
                  </>
                ) : (displayGame.homeScore || 0) + (displayGame.awayScore || 0) > 1 ? (
                  <div className="col-span-2 text-center text-xs text-muted-foreground py-2">
                    Over 1.5 already settled
                  </div>
                ) : (
                  <>
                    <OddBtn label="Over 1.5" value={getMarketOdd("over15", ["over_under:over_1.5"], preMatchMarkets.over15)} type="over15" />
                    <OddBtn label="Under 1.5" value={getMarketOdd("under15", ["over_under:under_1.5"], preMatchMarkets.under15)} type="under15" />
                  </>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground font-medium mt-2">Over/Under 2.5</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {displayGame.status !== "live" || (displayGame.homeScore || 0) + (displayGame.awayScore || 0) <= 2 ? (
                  <>
                    <OddBtn label="Over 2.5" value={getMarketOdd("over25", ["over_under:over_2.5"], preMatchMarkets.over25)} type="over25" />
                    <OddBtn label="Under 2.5" value={getMarketOdd("under25", ["over_under:under_2.5"], preMatchMarkets.under25)} type="under25" />
                  </>
                ) : (displayGame.homeScore || 0) + (displayGame.awayScore || 0) > 2 ? (
                  <div className="col-span-2 text-center text-xs text-muted-foreground py-2">
                    Over 2.5 already settled
                  </div>
                ) : (
                  <>
                    <OddBtn label="Over 2.5" value={getMarketOdd("over25", ["over_under:over_2.5"], preMatchMarkets.over25)} type="over25" />
                    <OddBtn label="Under 2.5" value={getMarketOdd("under25", ["over_under:under_2.5"], preMatchMarkets.under25)} type="under25" />
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === "DC" && (
            <div className="grid grid-cols-3 gap-2">
              <OddBtn label="1X" value={getMarketOdd("doubleChanceHomeOrDraw", ["double_chance:1X"], preMatchMarkets.doubleChanceHomeOrDraw)} type="dc-1x" />
              <OddBtn label="X2" value={getMarketOdd("doubleChanceAwayOrDraw", ["double_chance:X2"], preMatchMarkets.doubleChanceAwayOrDraw)} type="dc-x2" />
              <OddBtn label="12" value={getMarketOdd("doubleChanceHomeOrAway", ["double_chance:12"], preMatchMarkets.doubleChanceHomeOrAway)} type="dc-12" />
            </div>
          )}

          {activeTab === "HT/FT" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <OddBtn label="H/H" value={getMarketOdd("htftHomeHome", ["half_time_result:1"], preMatchMarkets.htftHomeHome)} type="htft-hh" />
              <OddBtn label="D/D" value={getMarketOdd("htftDrawDraw", ["half_time_result:X"], preMatchMarkets.htftDrawDraw)} type="htft-dd" />
              <OddBtn label="A/A" value={getMarketOdd("htftAwayAway", ["half_time_result:2"], preMatchMarkets.htftAwayAway)} type="htft-aa" />
              <OddBtn label="D/H" value={getMarketOdd("htftDrawHome", [], preMatchMarkets.htftDrawHome)} type="htft-dh" />
              <OddBtn label="D/A" value={getMarketOdd("htftDrawAway", [], preMatchMarkets.htftDrawAway)} type="htft-da" />
            </div>
          )}

          {activeTab === "CS" && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[0, 1, 2, 3, 4].flatMap((home) =>
                [0, 1, 2, 3, 4].map((away) => {
                  const currentHome = displayGame.homeScore || 0;
                  const currentAway = displayGame.awayScore || 0;
                  
                  // Only show correct scores that are >= current score (possible futures)
                  const isPossible = home >= currentHome && away >= currentAway;
                  
                  if (!isPossible && displayGame.status === "live") {
                    return null; // Don't render impossible scores during live matches
                  }
                  
                  const key = `cs${home}${away}`;
                  const isOther = home === 4 && away === 4;
                  const scoreMarket = getMarketOdd(key, [`correct_score:${home}:${away}`], preMatchMarkets[key]);

                  if (displayGame.status === "live" && scoreMarket === undefined) {
                    return null;
                  }

                  return (
                    <OddBtn 
                      key={key}
                      label={isOther ? "OTHER" : `${home}:${away}`} 
                      value={scoreMarket} 
                      type={isOther ? "cs-other" : `cs-${home}${away}`} 
                    />
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
