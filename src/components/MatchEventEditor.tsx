import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Edit2, Save, X, Clock, CheckCircle, AlertCircle, Zap } from "lucide-react";
import { formatTimeInEAT } from "@/lib/timezoneFormatter";

interface MatchEvent {
  id: string;
  event_type: "kickoff" | "halftime" | "resume" | "score_update" | "end";
  scheduled_at: string;
  executed_at: string | null;
  event_data: Record<string, any> | null;
  is_active: boolean;
}

interface MatchEventEditorProps {
  gameId: string;
  gameName: string;
  kickoffTime: string;
  onClose: () => void;
}

export function MatchEventEditor({ gameId, gameName, kickoffTime, onClose }: MatchEventEditorProps) {
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<MatchEvent | null>(null);
  const [formData, setFormData] = useState({
    eventType: "score_update" as MatchEvent["event_type"],
    minute: 45,
    homeScore: 0,
    awayScore: 0,
    timeOffset: 46, // minutes after kickoff
  });

  // Load events on mount
  useEffect(() => {
    loadEvents();
  }, [gameId]);

  const getAdminPhone = () => {
    return (
      localStorage.getItem("adminPhone") ||
      localStorage.getItem("userPhone") ||
      localStorage.getItem("phone") ||
      ""
    );
  };

  const loadEvents = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const adminPhone = getAdminPhone();
      const response = await fetch(
        `/api/admin/match-events/${gameId}?phone=${encodeURIComponent(adminPhone)}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      } else {
        const data = await response.json().catch(() => ({}));
        setErrorMessage(data?.error || "Failed to load match events");
      }
    } catch (error) {
      console.error("Error loading events:", error);
      setErrorMessage("Network error while loading match events");
    } finally {
      setLoading(false);
    }
  };

  const handleAddEvent = async () => {
    try {
      setSubmitting(true);
      setErrorMessage(null);
      const adminPhone = getAdminPhone();
      if (!adminPhone) {
        setErrorMessage("Admin phone is missing. Please log in again.");
        return;
      }

      const kickoffDate = new Date(kickoffTime);
      const eventTime = new Date(kickoffDate.getTime() + formData.timeOffset * 60 * 1000);

      const eventData: any = {
        eventType: formData.eventType,
        scheduledAt: eventTime.toISOString(),
        eventData: null,
      };

      if (formData.eventType === "score_update") {
        eventData.eventData = {
          minute: formData.minute,
          homeScore: formData.homeScore,
          awayScore: formData.awayScore,
        };
      }

      const response = await fetch("/api/admin/match-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: adminPhone,
          gameId,
          events: [eventData],
        }),
      });

      if (response.ok) {
        await loadEvents();
        setShowAddDialog(false);
        setFormData({
          eventType: "score_update",
          minute: 45,
          homeScore: 0,
          awayScore: 0,
          timeOffset: 46,
        });
      } else {
        const data = await response.json().catch(() => ({}));
        setErrorMessage(data?.error || "Failed to add event");
      }
    } catch (error) {
      console.error("Error adding event:", error);
      setErrorMessage("Network error while adding event");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      const adminPhone = getAdminPhone();
      const response = await fetch(`/api/admin/match-events/${eventId}?phone=${encodeURIComponent(adminPhone)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        await loadEvents();
      } else {
        const data = await response.json().catch(() => ({}));
        setErrorMessage(data?.error || "Failed to delete event");
      }
    } catch (error) {
      console.error("Error deleting event:", error);
      setErrorMessage("Network error while deleting event");
    }
  };

  const getEventLabel = (eventType: string): string => {
    const labels: Record<string, string> = {
      kickoff: "Kickoff",
      halftime: "Halftime",
      resume: "Resume 2nd Half",
      score_update: "Score Update",
      end: "End Match",
    };
    return labels[eventType] || eventType;
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "kickoff":
        return "🎯";
      case "halftime":
        return "⏱️";
      case "resume":
        return "▶️";
      case "score_update":
        return "⚽";
      case "end":
        return "🏁";
      default:
        return "📌";
    }
  };

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
            Match Events: {gameName}
          </h3>
          <p className="text-xs text-muted-foreground">Configure automated events for this match</p>
        </div>
        <Button
          variant="hero"
          size="sm"
          onClick={() => setShowAddDialog(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Event
        </Button>
      </div>

      {loading ? (
        <Card className="border-primary/30 bg-card/50 p-8 text-center">
          <p className="text-muted-foreground">Loading events...</p>
        </Card>
      ) : events.length === 0 ? (
        <Card className="border-primary/30 bg-card/50 p-8 text-center">
          <AlertCircle className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No events configured yet. Add events to automate this match.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <Card key={event.id} className="border-primary/20 bg-card/50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-lg">{getEventIcon(event.event_type)}</span>
                  <div>
                    <p className="font-semibold">{getEventLabel(event.event_type)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatTimeInEAT(event.scheduled_at)}
                    </p>
                    {event.event_data && (
                      <p className="text-xs text-primary">
                        Min {event.event_data.minute}: {event.event_data.homeScore}-{event.event_data.awayScore}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {event.executed_at ? (
                    <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Executed
                    </Badge>
                  ) : event.is_active ? (
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                      <Clock className="mr-1 h-3 w-3" />
                      Pending
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-gray-500/10 text-gray-400 border-gray-500/30">
                      Inactive
                    </Badge>
                  )}
                  {!event.executed_at && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteEvent(event.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {errorMessage && (
        <Card className="border-red-500/40 bg-red-500/10 p-3">
          <p className="text-sm text-red-300">{errorMessage}</p>
        </Card>
      )}

      {/* Add Event Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-background border-primary/30">
          <DialogHeader>
            <DialogTitle>Add Match Event</DialogTitle>
            <DialogDescription>Configure an automated event for this match</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Event Type */}
            <div>
              <label className="text-sm font-medium">Event Type</label>
              <select
                value={formData.eventType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    eventType: e.target.value as MatchEvent["event_type"],
                  })
                }
                className="mt-1 w-full rounded border border-primary/30 bg-background p-2 text-sm text-foreground"
              >
                <option value="kickoff">Kickoff</option>
                <option value="halftime">Halftime</option>
                <option value="resume">Resume 2nd Half</option>
                <option value="score_update">Score Update</option>
                <option value="end">End Match</option>
              </select>
            </div>

            {/* Time Offset */}
            <div>
              <label className="text-sm font-medium">Minutes After Kickoff</label>
              <Input
                type="number"
                min="0"
                max="120"
                value={formData.timeOffset}
                onChange={(e) =>
                  setFormData({ ...formData, timeOffset: parseInt(e.target.value) || 0 })
                }
                className="mt-1 bg-background/50 border-primary/30"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Event will trigger at{" "}
                {new Date(
                  new Date(kickoffTime).getTime() + formData.timeOffset * 60 * 1000
                ).toLocaleTimeString()}
              </p>
            </div>

            {/* Score Update Fields */}
            {formData.eventType === "score_update" && (
              <div className="space-y-3 border-t border-primary/20 pt-4">
                <p className="text-xs font-medium text-muted-foreground">Score Details</p>

                <div>
                  <label className="text-sm font-medium">Match Minute</label>
                  <Input
                    type="number"
                    min="0"
                    max="120"
                    value={formData.minute}
                    onChange={(e) =>
                      setFormData({ ...formData, minute: parseInt(e.target.value) || 0 })
                    }
                    className="mt-1 bg-background/50 border-primary/30"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Home Score</label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.homeScore}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          homeScore: parseInt(e.target.value) || 0,
                        })
                      }
                      className="mt-1 bg-background/50 border-primary/30"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Away Score</label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.awayScore}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          awayScore: parseInt(e.target.value) || 0,
                        })
                      }
                      className="mt-1 bg-background/50 border-primary/30"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 border-t border-primary/20 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowAddDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="hero"
                onClick={handleAddEvent}
                disabled={submitting}
                className="flex-1"
              >
                <Plus className="mr-2 h-4 w-4" />
                {submitting ? "Adding..." : "Add Event"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
