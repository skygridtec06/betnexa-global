import { formatKickoffTimeEAT } from "@/lib/timeFormatter";
import { Card } from "@/components/ui/card";

interface FinishedMatch {
  id: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  time: string;
  homeScore?: number;
  awayScore?: number;
}

interface FinishedMatchCardProps {
  match: FinishedMatch;
}

export function FinishedMatchCard({ match }: FinishedMatchCardProps) {
  const matchDate = new Date(match.time);
  const dateStr = matchDate.toLocaleDateString("en-KE", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeStr = matchDate.toLocaleTimeString("en-KE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <Card className="gradient-card rounded-lg border border-border/50 p-4 transition-all hover:border-primary/20 card-glow">
      <div className="flex flex-col gap-3">
        {/* League name */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{match.league}</span>
          <span className="text-xs font-medium text-muted-foreground">FT</span>
        </div>

        {/* Teams and Score */}
        <div className="flex items-center gap-3">
          {/* Home Team */}
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground leading-tight">{match.homeTeam}</p>
          </div>

          {/* Score */}
          <div className="text-center px-3">
            <p className="text-lg font-bold text-primary">{match.homeScore ?? 0}</p>
            <p className="text-xs text-muted-foreground">-</p>
            <p className="text-lg font-bold text-primary">{match.awayScore ?? 0}</p>
          </div>

          {/* Away Team */}
          <div className="flex-1 text-right">
            <p className="text-sm font-semibold text-foreground leading-tight">{match.awayTeam}</p>
          </div>
        </div>

        {/* Date and Time */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{dateStr}</span>
          <span>{timeStr}</span>
        </div>
      </div>
    </Card>
  );
}
