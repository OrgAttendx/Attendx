import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/enhanced-button";
import LocationCapture from "@/components/attendance/LocationCapture";
import { useToast } from "@/hooks/use-toast";

export const StartSessionLocationModal = ({
  open,
  onOpenChange,
  classToStart,
  onProceed,
  startingSession,
}) => {
  const { toast } = useToast();
  const [sessionLocation, setSessionLocation] = useState(null);
  const [diameterMeters, setDiameterMeters] = useState(500);
  const [highAccuracyAlertOpen, setHighAccuracyAlertOpen] = useState(false);

  const getValidDiameter = (val) => {
    const num = Number(val);
    if (isNaN(num) || num <= 0) return 500;
    return Math.min(10000, Math.max(10, Math.round(num)));
  };

  const handleLocationCaptured = (locationData) => {
    setSessionLocation(locationData);
    if (locationData && locationData.accuracy >= 250) {
      setHighAccuracyAlertOpen(true);
    }
  };

  const handleProceed = (useLocation) => {
    const currentDiameter = getValidDiameter(diameterMeters);
    const calculatedRadius = Math.max(5, Math.round(currentDiameter / 2));

    if (useLocation) {
      if (!sessionLocation) {
        toast({
          title: "Location Required ⚠️",
          description:
            "Please capture your location first, or click 'Start Without Location' (Code-Only Mode) so students can mark attendance using only the code.",
          variant: "destructive",
        });
        return;
      }

      if (sessionLocation.accuracy >= 250) {
        setHighAccuracyAlertOpen(true);
        toast({
          title: `Location Accuracy Too Low (±${Math.round(sessionLocation.accuracy)}m) ⚠️`,
          description:
            "GPS accuracy is too low for geofencing. We suggest starting WITHOUT location (Code-Only Mode) — students will only need the 6-digit code to mark attendance and won't need to capture location!",
          variant: "destructive",
        });
        return;
      }
    }

    onProceed({
      useLocation,
      sessionLocation,
      currentDiameter,
      calculatedRadius,
    });
  };

  const handleClose = (isOpen) => {
    if (!isOpen) {
      setSessionLocation(null);
      setDiameterMeters(500);
      setHighAccuracyAlertOpen(false);
    }
    onOpenChange(isOpen);
  };

  return (
    <>
      {/* High GPS Accuracy Warning Alert */}
      <AlertDialog
        open={highAccuracyAlertOpen}
        onOpenChange={setHighAccuracyAlertOpen}
      >
        <AlertDialogContent className="w-[calc(100vw-2rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <span>⚠️</span> High Location Uncertainty (±
              {sessionLocation?.accuracy
                ? Math.round(sessionLocation.accuracy)
                : "?"}
              m)
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-xs sm:text-sm">
              <p>
                Your browser/device returned a low-accuracy GPS fix (radius ±
                {sessionLocation?.accuracy
                  ? Math.round(sessionLocation.accuracy)
                  : "?"}
                m).
              </p>
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 p-2.5 text-amber-800 dark:text-amber-300 font-medium">
                💡 <strong>Suggested Action:</strong> Use <strong>Code-Only Mode</strong> (Start Without Location). Students will only need to enter the 6-digit code!
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            <AlertDialogCancel className="w-full sm:w-auto">
              Dismiss
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setHighAccuracyAlertOpen(false);
                handleProceed(false);
              }}
              className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            >
              Start Without Location (Code-Only)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Location Capture Dialog */}
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[90vh] max-w-lg gap-0 p-0 sm:w-[480px]">
          <div className="flex h-full max-h-[90vh] flex-col overflow-hidden">
            <DialogHeader className="px-4 pb-2 pt-4 sm:px-6 sm:pt-6">
              <DialogTitle>Start Attendance Session</DialogTitle>
              <DialogDescription>
                Choose how to track attendance for{" "}
                <strong>{classToStart?.class_name}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-4 pb-6 pt-2 sm:px-6">
              <div className="space-y-4 pb-4">
                {/* GPS Tips Banner */}
                <div className="flex gap-2.5 rounded-xl border border-amber-400/50 bg-amber-50 dark:bg-amber-950/30 p-3">
                  <span className="text-lg leading-none shrink-0">📡</span>
                  <div className="text-xs text-amber-800 dark:text-amber-300 space-y-1">
                    <p className="font-semibold">For accurate location capture:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-amber-700 dark:text-amber-400">
                      <li>Turn <strong>Wi-Fi ON</strong> (no need to connect to any network)</li>
                      <li>Turn <strong>Battery Saver OFF</strong> for full GPS performance</li>
                    </ul>
                  </div>
                </div>

                <h3 className="font-medium">Location-Based Attendance</h3>
                <p className="text-sm text-muted-foreground">
                  Enable location verification to ensure students are physically
                  present in the classroom.
                </p>

                <div className="max-h-[360px] overflow-y-auto pr-1 sm:max-h-none">
                  <LocationCapture
                    onLocationCaptured={handleLocationCaptured}
                  />
                </div>

                {sessionLocation && (
                  <div className="space-y-3 rounded-xl border border-border/60 bg-muted/30 p-3.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="diameter" className="font-semibold text-foreground">
                        Allowed Classroom Zone (Diameter)
                      </Label>
                      <span className="text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-400 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                        Radius: {Math.round(getValidDiameter(diameterMeters) / 2)}m
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {[100, 200, 500, 1000].map((d) => (
                        <Button
                          key={d}
                          type="button"
                          size="sm"
                          variant={getValidDiameter(diameterMeters) === d ? "default" : "outline"}
                          onClick={() => setDiameterMeters(d)}
                          className="min-w-[65px] font-medium"
                        >
                          {d}m
                        </Button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-xs text-muted-foreground font-medium">
                        Custom Diameter (Keypad):
                      </span>
                      <Input
                        id="diameter"
                        type="number"
                        min="10"
                        max="10000"
                        step="10"
                        value={diameterMeters}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") {
                            setDiameterMeters("");
                          } else {
                            const parsed = parseInt(val, 10);
                            if (!isNaN(parsed)) {
                              setDiameterMeters(Math.min(10000, Math.max(1, parsed)));
                            }
                          }
                        }}
                        onBlur={() => {
                          setDiameterMeters(getValidDiameter(diameterMeters));
                        }}
                        className="w-28 text-sm font-semibold"
                        placeholder="e.g. 500"
                      />
                      <span className="text-xs font-medium text-muted-foreground">
                        meters
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground pt-1">
                      Students must be within the <strong>{getValidDiameter(diameterMeters)}m diameter zone</strong> (up to {Math.round(getValidDiameter(diameterMeters) / 2)}m from your center location).
                      GPS accuracy (±
                      {sessionLocation.accuracy
                        ? Math.round(sessionLocation.accuracy)
                        : "?"}
                      m) is automatically accounted for.
                    </p>

                    {sessionLocation.accuracy > 500 && (
                      <div className="rounded-xl border border-amber-400/80 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-1.5 text-xs text-amber-900 dark:text-amber-200">
                        <p className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                          <span>💡 Recommendation: Code-Only Mode</span>
                        </p>
                        <p>
                          GPS accuracy is currently low (±{Math.round(sessionLocation.accuracy)}m). We recommend clicking <strong>"Start Without Location"</strong> below — students can then mark attendance instantly using only the 6-digit code without needing location verification!
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 flex flex-col gap-2 border-t border-border bg-background px-4 py-4 sm:flex-row sm:justify-end sm:gap-3 sm:px-6">
              <Button
                variant={sessionLocation && sessionLocation.accuracy > 500 ? "default" : "outline"}
                className="w-full sm:w-auto font-medium"
                onClick={() => handleProceed(false)}
                disabled={startingSession}
              >
                Start Without Location (Code-Only)
              </Button>
              <Button
                variant={sessionLocation && sessionLocation.accuracy > 500 ? "outline" : "default"}
                className="w-full sm:w-auto font-medium"
                onClick={() => handleProceed(true)}
                disabled={!sessionLocation || sessionLocation.accuracy > 500 || startingSession}
              >
                {startingSession ? "Starting..." : "Start with Location"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default StartSessionLocationModal;
