// en.js — the app's English. Keys are grouped by screen; values are strings,
// plural objects ({ one, other }) or lists. Spanish lives in es.js with the
// same keys (tests/i18n.test.js checks they match).

const en = {};

en.app = {
  "storageBlocked": "Storage is blocked (private mode?). Your data is kept in memory only and will be lost when you close this tab.",
  "title": "MOSKE — Triathlon Training Tracker",
  "description": "MOSKE — a gamified, offline-first triathlon training tracker.",
  "noscript": "MOSKE needs JavaScript enabled."
};

en.nav = {
  "home": "Home",
  "shop": "Shop",
  "ranks": "Ranks",
  "chat": "Chat",
  "profile": "Profile",
  "views": "Views",
  "notifications": "Notifications",
  "accountLevel": "Account level",
  "openProfile": "Open profile",
  "addSession": "Add a session",
  "chatUnread": {
    "one": "Chat, {n} unread",
    "other": "Chat, {n} unread"
  },
  "accountLevelFull": "Account level {level}, {toNext} XP to the next level"
};

en.sport = {
  "run": "Run",
  "bike": "Bike",
  "swim": "Swim",
  "gym": "Gym",
  "brick": "Brick",
  "mobility": "Mobility",
  "other": "Other",
  "cycling": "Cycling",
  "running": "Running",
  "swimming": "Swimming"
};

en.intensity = {
  "easy": "Easy",
  "steady": "Steady",
  "moderate": "Moderate",
  "threshold": "Threshold",
  "vo2": "VO₂",
  "quality": "Quality",
  "race": "Race",
  "work": "Work"
};

en.date = {
  "daysShort": [
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
    "Sun"
  ],
  "days": [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday"
  ],
  "dayLetters": [
    "M",
    "T",
    "W",
    "T",
    "F",
    "S",
    "S"
  ],
  "months": [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ],
  "shortLabel": "{day} {date} {month}",
  "today": "Today",
  "yesterday": "Yesterday",
  "tomorrow": "Tomorrow",
  "now": "now",
  "minAgo": "{n}m",
  "hourAgo": "{n}h"
};

en.ui = {
  "packRemove": "Remove {item}",
  "packEmpty": "No items yet",
  "packAddPh": "Add item…",
  "packAddAria": "Add packing item",
  "add": "Add",
  "fuelTitle": "Fuelling reminder",
  "fuelText": "Practice 60–90 g carbs/h",
  "vsPlan": "/ {planned} plan",
  "actual": {
    "distance": "Distance",
    "time": "Time",
    "avgHr": "Avg HR",
    "avgPower": "Avg power",
    "cadence": "Cadence",
    "elevation": "Elevation",
    "calories": "Calories",
    "rpe": "RPE"
  },
  "viewOnStrava": "View on Strava ↗",
  "actualTitle": "Actual",
  "logActual": "Log actual result",
  "fieldAvgHr": "avg HR",
  "zoneTitle": "Heart-rate zone {n}",
  "sessionBlock": "Session",
  "noLevels": "No levels for this sport yet.",
  "zoomLevel": "Zoom level {n}",
  "levelAlt": "{sport} level {n}",
  "unlockMore": "Complete more {sport} sessions to unlock the next scene.",
  "xpToLevel": "{xp} XP to LVL {next}",
  "sportLevels": "Sport levels",
  "powerBar": "{min} min @ {watts} W ({pct}% FTP)",
  "power": "Power",
  "ftpNote": "FTP {ftp} W · scaled to your profile",
  "packing": "Packing",
  "tagRace": "Race",
  "tagTaper": "Taper",
  "tagDeload": "Deload",
  "completed": "Completed",
  "planned": "Planned",
  "next": "Next",
  "shareCard": "Share card",
  "edit": "Edit",
  "duplicate": "Duplicate",
  "delete": "Delete",
  "raceDayBanner": "Race day: {title}. Go get it.",
  "nextEvent": "Next event: {title} · {date}",
  "aiOffer": "Want a plan built around your races and your week?",
  "buildPlan": "Build my plan",
  "questsCleared": "Quests cleared",
  "questsClearedSub": "+{xp} XP today · new ones in {time}",
  "questDone": " (done)",
  "noQuests": "No quests today. Plan a session to unlock some.",
  "dailyQuests": "Daily quests",
  "resetsAtMidnight": "Resets at midnight",
  "resetsIn": "Resets {time}",
  "todayEyebrow": "{weekday} · today",
  "openCalendar": "Open your calendar",
  "calendar": "Calendar",
  "tomorrowLine": "{sport} — {title}",
  "restRecovery": "Rest & recovery day",
  "tomorrow": "Tomorrow",
  "niceWork": "Nice work staying active today.",
  "freshDay": "Fresh day, fresh legs.",
  "thisWeek": "This week",
  "plan": "Plan",
  "vol": "Vol",
  "int": "Int",
  "volume": "Volume",
  "intensity": "Intensity",
  "xBase": "{ratio}× base",
  "calibrating": "calibrating",
  "editGoals": "Edit goals",
  "hoursUnit": "h",
  "insightPerfect": "All weekly goals hit. A perfect week.",
  "insightKm": "You are {n} km away from your weekly distance goal.",
  "insightHours": "You have {n} hours of training left to hit your weekly goal.",
  "insightSessions": {
    "one": "{n} more session this week to hit your goal.",
    "other": "{n} more sessions this week to hit your goal."
  },
  "today": "Today",
  "rest": "Rest",
  "nextUp": "Next up",
  "nextUpLine": "Next up: {title} · {date}",
  "nothingScheduled": "Nothing scheduled. Tap to add a session.",
  "done": "Done",
  "structuredHint": " · structured session, tap for the full set",
  "detailsHint": " · tap for details",
  "moreToday": {
    "one": "+ {n} more session today. See Calendar.",
    "other": "+ {n} more sessions today. See Calendar."
  },
  "restDay": "Rest day",
  "addSession": "Add a session",
  "prevWeek": "Previous week",
  "nextWeek": "Next week",
  "profile": "Profile",
  "zone": {
    "ok": "in the sweet spot",
    "high": "elevated, watch fatigue",
    "danger": "spiking, back off",
    "detraining": "low, room to build",
    "unknown": "building baseline"
  },
  "noRunLastWeek": "No run last week to compare.",
  "runVolume": "Run volume {pct}% vs last week ({last}→{now} km).",
  "trainingLoad": "Training load",
  "acute": "Acute (7d)",
  "chronic": "Chronic (weekly)",
  "acwr": "ACWR",
  "acwrLine": "Acute:chronic ratio is {zone}. Aim for ~0.8–1.3. {runLine}",
  "bodyMetrics": "Body metrics",
  "weight": "Weight",
  "restingHr": "Resting HR",
  "sleep": "Sleep",
  "phKg": "kg",
  "phRhr": "RHR",
  "phSleep": "sleep h",
  "ariaWeight": "Weight kg",
  "ariaRhr": "Resting HR",
  "ariaSleep": "Sleep hours",
  "logToday": "Log today",
  "weeklyVolume": "Weekly volume (last 8 weeks)",
  "weeklyVolumeNote": "Hours of completed training per week.",
  "disciplineBreakdown": "Discipline breakdown",
  "noSplit": "Complete sessions to see your split.",
  "consistency": "Consistency",
  "consistencyLine": "Current {current} · longest {longest} days",
  "heatDone": " · done",
  "badges": "Badges",
  "paceRef": "Pace & zone reference",
  "planPrinciples": "Plan principles",
  "totals": {
    "level": "Level",
    "totalXp": "Total XP",
    "sessions": "Sessions",
    "hours": "Hours",
    "distance": "Distance",
    "bestStreak": "Best streak"
  },
  "daysShort": "{n} d",
  "raceIn": {
    "one": "{title} in {n} day",
    "other": "{title} in {n} days"
  }
};

en.main = {
  "badgeUnlocked": "Badge unlocked",
  "accountLevel": "Account level {level}",
  "questOne": "Quest complete +{xp} XP",
  "questMany": "{n} quests complete +{xp} XP",
  "levelUp": "Level up",
  "levelAlt": "{sport} level {n}",
  "levelAria": "Level {n}",
  "newScenery": " New scenery is on its way.",
  "continue": "Continue",
  "removed": {
    "one": "{message} · {n} session removed",
    "other": "{message} · {n} sessions removed"
  },
  "signOutConfirm": "Sign out? Your data stays in the cloud and on this device.",
  "stravaConnectFailed": "Strava connect failed",
  "stravaSync": "Strava sync: {link} linked, {insert} added",
  "syncFailed": "Sync failed",
  "stravaDisconnected": "Strava disconnected",
  "disconnectFailed": "Disconnect failed",
  "deleteRoutine": "Delete the routine “{name}”? Sessions you already did stay.",
  "nothingToClear": "Nothing to clear. There are no upcoming planned sessions.",
  "clearConfirm": {
    "one": "Clear {n} upcoming planned session from today onward?\n\nCompleted and Strava-verified sessions are kept.",
    "other": "Clear {n} upcoming planned sessions from today onward?\n\nCompleted and Strava-verified sessions are kept."
  },
  "futureCleared": "Future workouts cleared",
  "planEmpty": "Your plan is already empty. Generate a new one below.",
  "resetConfirm": {
    "one": "Reset your training plan?\n\nThis removes {n} planned session, past and upcoming. Your completed and Strava-verified history, XP, levels and badges are kept.",
    "other": "Reset your training plan?\n\nThis removes all {n} planned sessions, past and upcoming. Your completed and Strava-verified history, XP, levels and badges are kept."
  },
  "planReset": "Training plan reset. Build a new one with AI training plan",
  "duplicated": "Session duplicated",
  "deleteConfirm": "Delete this session?",
  "deleted": "Session deleted",
  "metricsLogged": "Logged today’s metrics",
  "noTomorrow": "No session tomorrow to attach the item to.",
  "settings": "Settings",
  "sound": "Sound effects",
  "reduceMotion": "Reduce motion",
  "units": "Units",
  "metric": "Metric (km)",
  "imperial": "Imperial (mi)",
  "weekStarts": "Week starts on",
  "monday": "Monday",
  "sunday": "Sunday",
  "language": "Language",
  "backup": "Backup",
  "backupSignedIn": "Signed in. Your data syncs across devices automatically. Export and import still work for an extra offline backup.",
  "backupLocal": "Data is stored <b>per device in this browser</b> (localStorage). It does <b>not</b> sync between your phone and laptop. Sign in above, or use export and import to move it.",
  "export": "Export",
  "import": "Import",
  "calendarFile": "Calendar file",
  "install": "Install app",
  "trainingPlan": "Training plan",
  "ftp": "Bike FTP (watts)",
  "plannedCount": {
    "one": "{n} planned session on your calendar ({upcoming} from today onward).",
    "other": "{n} planned sessions on your calendar ({upcoming} from today onward)."
  },
  "aiPlan": "AI training plan",
  "clearFuture": "Clear future",
  "resetPlan": "Reset training plan",
  "clearNote": "Clearing wipes upcoming sessions only; resetting wipes the whole plan, past and upcoming. Completed and Strava-verified sessions are always kept, so your XP, levels and badges are safe.",
  "routines": "Routines",
  "noRoutines": "No routines yet. Open a gym session and tap “Save as routine”.",
  "packingPresets": "Packing presets",
  "presetPh": "item, item, …",
  "dangerZone": "Danger zone",
  "reseed": "Reset & reseed plan",
  "done": "Done",
  "reseedConfirm": "Reset everything and reload the original plan? Your logged progress will be lost.",
  "reseeded": "Backup exported, plan reseeded",
  "imported": "Data imported",
  "importFailed": "Import failed: that file isn’t a MOSKE backup.",
  "exported": "Backup exported",
  "calExported": "Calendar exported",
  "goalsAria": "Edit weekly goals",
  "goalsTitle": "Weekly goals",
  "goalSessions": "Planned sessions",
  "goalKm": "Distance / volume (km)",
  "goalHours": "Training hours",
  "saveGoals": "Save goals",
  "goalsUpdated": "Goals updated",
  "newRecord": "New record · {name}: {prs}",
  "newRecordHead": "New record · {name}",
  "levelsAria": "{sport} levels",
  "levels": "Levels",
  "artwork": "Level artwork",
  "stravaAuto": "Strava: {link} linked · {insert} imported",
  "signedIn": "Signed in",
  "yourAccount": "your account",
  "signOut": "Sign out",
  "signInSync": "Sign in to sync",
  "connectStrava": "Connect Strava",
  "syncNow": "Sync now",
  "disconnect": "Disconnect",
  "poweredByStrava": "Powered by Strava",
  "account": "Account",
  "syncPrompt": "Sign in to sync across your phone and laptop.",
  "signIn": "Sign in",
  "dismiss": "Dismiss",
  "strava": {
    "connected": "Strava connected",
    "denied": "Strava connection cancelled",
    "error": "Strava connection failed",
    "auth_failed": "Connect failed. Sign in first."
  },
  "welcome": {
    "aria": "Welcome to MOSKE",
    "coachAlt": "Your coach",
    "coachT": "Meet your coach",
    "coachB": "Sessions complete when Strava verifies them. That is what earns XP, clears daily quests and keeps your streak alive.",
    "plusT": "Make it yours",
    "plusB": "Tap the + button to add a session on any day, with intervals, exercises and a packing list.",
    "installT": "Add to Home Screen",
    "installB": "Install MOSKE for a full-screen app that works offline at the gym. Sign in to sync across devices.",
    "skip": "Skip",
    "next": "Next",
    "start": "Start training"
  }
};

en.lang = {
  "label": "Language",
  "en": "English",
  "es": "Spanish"
};

en.pg = {
  "athlete": "Athlete",
  "sceneAlt": "{sport} level {n} scene",
  "charAlt": "{sport} level {n} character",
  "sportGroup": "Sport",
  "levelN": "Level {n}",
  "levelSeeAll": "Level {n}: see every level",
  "toLevel": "{pct}% to level {n}",
  "xpLine": "{into} / {span} XP · {toNext} to LVL {next}",
  "openProfile": "Open profile",
  "ageNew": "New",
  "ageDays": "{n} d",
  "ageMonths": "{n} mo",
  "ageYears": "{n} y",
  "calTitle": {
    "one": "{date} · {n} session",
    "other": "{date} · {n} sessions"
  },
  "act1": "1 activity",
  "act2": "2 activities",
  "act3": "3+ activities",
  "fromStrava": "Imported from Strava",
  "activitySummary": "Activity summary",
  "strainCalibrating": "Calibrating",
  "strainBelow": "Below target",
  "strainAbove": "Above target",
  "strainOn": "On target",
  "strain": "Strain performance",
  "cupAria": {
    "earned": "{name}: earned",
    "locked": "{name}: locked"
  },
  "trophies": "Trophy cabinet",
  "trophyTap": "Tap a trophy to see how to earn it.",
  "earned": "Earned",
  "locked": "Locked",
  "status": {
    "Calibrating": "Calibrating",
    "Detraining": "Detraining",
    "Maintaining": "Maintaining",
    "Productive": "Productive",
    "Peaking": "Peaking",
    "Fatigued": "Fatigued"
  },
  "cardioLoad": "Cardio load",
  "accountSync": "Account & sync",
  "signedIn": "Signed in",
  "syncing": "Syncing across devices",
  "allSettings": "All settings",
  "noCompleted": "No completed sessions yet.",
  "activityHistory": "Activity history",
  "backToFitness": "Back to fitness",
  "activity": "Activity",
  "history": "History",
  "questXp": "{xp} quest XP",
  "level": "Level",
  "workouts": "Workouts",
  "streak": "Streak",
  "accountAge": "Account age",
  "hours": "Hours",
  "overallLevel": "Overall level",
  "fitnessDash": "Fitness dashboard",
  "fitness": "Fitness",
  "changePhoto": "Change profile photo",
  "athleteProfile": "Athlete profile",
  "loadingAthlete": "Loading athlete data…",
  "theirLevels": "Their levels by sport",
  "athleteFailed": "Couldn’t load this athlete. Check your connection.",
  "swipeHint": "Swipe or use the arrow keys for their other sports",
  "cardioFoot": "{from} – {to} · band = your safe-load zone",
  "cardioBreakdown": "Cardio status breakdown",
  "daysN": "{n}d",
  "xpGear": "+{n} XP from gear and gels (your levels only)"
};

en.coach = {
  "zone": {
    "1": "Zone 1: barely working, nose-breathing easy.",
    "2": "Zone 2: you should be able to chat the whole way.",
    "3": "Zone 3: steady and honest, a few words at a time.",
    "4": "Zone 4: threshold. Hard but controlled, no surging.",
    "5": "Zone 5: short and sharp. Full recovery between reps."
  },
  "intensity": {
    "easy": "Keep it genuinely easy. Easy days make the hard days work.",
    "steady": "Settle into a rhythm you could hold for hours.",
    "moderate": "Comfortably hard. Stay smooth, stay relaxed.",
    "threshold": "Sit right on the edge: hard, but never ragged.",
    "quality": "Quality over quantity. Nail every rep, then stop.",
    "vo2": "Big efforts, full recoveries. Start the first rep a touch easy.",
    "race": "Race day. Trust the training and pace the first third."
  },
  "opener": {
    "run": "Run day.",
    "bike": "Time on the bike.",
    "swim": "Into the pool.",
    "gym": "Gym session.",
    "brick": "Brick day: bike, then straight into the run.",
    "mobility": "Mobility work.",
    "other": "Session on the board."
  },
  "raceCue": {
    "run": "Start slower than feels right, settle by the second third, then empty the tank in the last.",
    "bike": "Ride your own numbers, not anyone else’s wheel. Eat early, drink often.",
    "swim": "Find clear water, long strokes, sight every six. Calm is fast.",
    "brick": "Swim calm, ride smart, run proud. Eat early on the bike, it pays you back on the run.",
    "gym": "Warm up properly, open with a lift you know you own, then go for it.",
    "other": "Pace the first third, fuel early, finish strong."
  },
  "raceOpeners": [
    "Race day: {race}.",
    "It’s here. {race}.",
    "{race}. This is what you trained for."
  ],
  "raceClosers": [
    "Every session you logged is in your legs today.",
    "Nothing new today: same breakfast, same kit, same you.",
    "Smile at the hard parts. You earned the right to be here."
  ],
  "race": "Race",
  "raceDone": "{race}: done. Whatever the clock says, you showed up and finished. Proud of you.",
  "raceEve": "{race} is tomorrow. Lay out your kit, eat what you know, sleep early. The hard work is already done.",
  "verified": "Verified on Strava. That one counts. Recover well.",
  "markedDone": "Marked done. Link it on Strava to make it count.",
  "mainSet": "{opener} Main set: {main}.",
  "allCleared": "All quests cleared. Rest up, same time tomorrow.",
  "inARow": "{n} days in a row. Keep stacking them.",
  "sessionVerified": "Session verified. Check what is left on the board.",
  "restDay": "Rest day. Recovery is training too.",
  "streakOn": "Streak on {n}. One verified session keeps it alive.",
  "default": "Quests complete when Strava verifies your session.",
  "moment": {
    "accepted": "Quest accepted. I will see you out there.",
    "questDone": "Quest complete: {text}.",
    "sportLevel": "{label} level {level}. New ground unlocked.",
    "accountLevel": "Account level {level}. You are building something.",
    "stravaNudge": "Connect Strava. Verified sessions are what earn XP and quests."
  }
};

en.badge = {
  "first-workout": {
    "name": "First Steps",
    "desc": "Complete your very first session"
  },
  "streak-3": {
    "name": "On a Roll",
    "desc": "Reach a 3-day streak"
  },
  "streak-7": {
    "name": "Week Warrior",
    "desc": "Reach a 7-day streak"
  },
  "streak-14": {
    "name": "Fortnight Beast",
    "desc": "Reach a 14-day streak"
  },
  "level-5": {
    "name": "Rising Star",
    "desc": "Reach level 5"
  },
  "level-10": {
    "name": "Double Digits",
    "desc": "Reach level 10"
  },
  "workouts-50": {
    "name": "Half Century",
    "desc": "Complete 50 sessions"
  },
  "hours-12": {
    "name": "Time Served",
    "desc": "Train 12+ hours in total"
  },
  "bike-100": {
    "name": "Century Rider",
    "desc": "Ride 100 km in total"
  },
  "bike-500": {
    "name": "Long Hauler",
    "desc": "Ride 500 km in total"
  },
  "run-100": {
    "name": "Road Runner",
    "desc": "Run 100 km in total"
  },
  "swim-25": {
    "name": "Fish",
    "desc": "Swim 25 km in total"
  },
  "brick": {
    "name": "Bricklayer",
    "desc": "Complete a brick session"
  },
  "triple": {
    "name": "Triple Threat",
    "desc": "Run, bike and swim on the same day"
  },
  "all-rounder": {
    "name": "All-Rounder",
    "desc": "Complete a run, bike, swim and gym session"
  },
  "long-run-30": {
    "name": "Marathon Ready",
    "desc": "Complete a single run of 30 km or more"
  },
  "bike-week-200": {
    "name": "Big Bike Week",
    "desc": "Ride 200 km of bike in a single week"
  }
};

en.quest = {
  "plan-done": "Finish today's planned session",
  "min-45": "Train 45+ minutes today",
  "two-disc": "Two disciplines in one day",
  "streak": "Keep the streak alive",
  "km-10": "Cover 10 km today",
  "brick": "Nail the brick session",
  "pack-bag": "Pack tomorrow's bag",
  "rest-day": "Rest day: take it, it counts"
};

en.scene = {
  "coach": "Coach"
};

en.ex = {
  "back-squat": {
    "name": "Back Squat",
    "cues": [
      "Brace your core before you descend",
      "Knees track over toes, sit between the hips",
      "Drive the floor away — full depth"
    ]
  },
  "romanian-deadlift": {
    "name": "Romanian Deadlift",
    "cues": [
      "Hinge at the hips, soft knees",
      "Bar stays close, shins vertical",
      "Feel the hamstring stretch, flat back"
    ]
  },
  "trap-bar-deadlift": {
    "name": "Trap Bar Deadlift",
    "cues": [
      "Chest up, push the floor away",
      "Neutral spine, lats engaged",
      "Stand tall, squeeze glutes at the top"
    ]
  },
  "bulgarian-split-squat": {
    "name": "Bulgarian Split Squat",
    "cues": [
      "Most weight through the front heel",
      "Drop straight down, torso tall",
      "Control the rear knee toward the floor"
    ]
  },
  "step-up": {
    "name": "Step Up",
    "cues": [
      "Drive through the top foot",
      "Don’t push off the trailing leg",
      "Control the descent — no bouncing"
    ]
  },
  "standing-calf-raise": {
    "name": "Standing Calf Raise",
    "cues": [
      "Full range — heels low to high",
      "Pause at the top, squeeze",
      "Slow on the way down"
    ]
  },
  "nordic-hamstring-curl": {
    "name": "Nordic Hamstring Curl",
    "cues": [
      "Anchor the ankles firmly",
      "Lower as slowly as you can",
      "Keep hips extended, hinge from the knees"
    ]
  },
  "copenhagen-plank": {
    "name": "Copenhagen Plank",
    "cues": [
      "Stack shoulder over elbow",
      "Squeeze the top adductor",
      "Keep a straight line head-to-hip"
    ]
  },
  "pull-up": {
    "name": "Pull Up",
    "cues": [
      "Start from a dead hang",
      "Pull elbows down and back",
      "Chin over the bar, control the lower"
    ]
  },
  "dumbbell-bench-press": {
    "name": "Dumbbell Bench Press",
    "cues": [
      "Shoulder blades pinned to the bench",
      "Lower to mid-chest",
      "Press up and slightly together"
    ]
  },
  "seated-cable-row": {
    "name": "Seated Cable Row",
    "cues": [
      "Tall chest, pull to the navel",
      "Squeeze shoulder blades together",
      "Don’t lean back — stay over the hips"
    ]
  },
  "shoulder-press": {
    "name": "Shoulder Press",
    "cues": [
      "Brace, don’t arch the lower back",
      "Press to a locked-out finish",
      "Bar/dumbbells over the mid-foot"
    ]
  },
  "face-pull": {
    "name": "Face Pull",
    "cues": [
      "Pull to eye level, elbows high",
      "Externally rotate at the end",
      "Light weight, slow tempo"
    ]
  },
  "pallof-press": {
    "name": "Pallof Press",
    "cues": [
      "Square hips and shoulders to the front",
      "Press straight out, resist the twist",
      "Slow out, slow back"
    ]
  },
  "barbell-bench-press": {
    "name": "Bench Press (Barbell)",
    "cues": [
      "Feet planted, shoulder blades squeezed",
      "Lower to the lower chest, elbows ~45°",
      "Press up and slightly back over the shoulders"
    ]
  },
  "incline-dumbbell-press": {
    "name": "Incline Bench Press (Dumbbell)",
    "cues": [
      "Bench at 30–45°",
      "Lower to the upper chest",
      "Press up without clanking the bells"
    ]
  },
  "cable-fly-crossover": {
    "name": "Cable Fly Crossovers",
    "cues": [
      "Soft bend in the elbows, keep it fixed",
      "Hug a barrel — hands meet in front",
      "Slow back to a stretch"
    ]
  },
  "dumbbell-chest-fly": {
    "name": "Chest Fly (Dumbbell)",
    "cues": [
      "Slight bend in the elbows",
      "Open wide to a stretch, not past the shoulders",
      "Squeeze the chest to bring them together"
    ]
  },
  "machine-chest-fly": {
    "name": "Chest Fly (Machine)",
    "cues": [
      "Seat so the handles are at chest height",
      "Elbows soft, squeeze together",
      "Control the return"
    ]
  },
  "band-chest-fly": {
    "name": "Chest Fly (Band)",
    "cues": [
      "Step out until the band is tight at the start",
      "Arms wide, slight elbow bend",
      "Squeeze, pause, slow back"
    ]
  },
  "suspension-chest-fly": {
    "name": "Chest Fly (Suspension)",
    "cues": [
      "Body in a straight plank line",
      "Open the arms slowly, elbows soft",
      "Squeeze back up — steeper is harder"
    ]
  },
  "chest-dip": {
    "name": "Chest Dip",
    "cues": [
      "Lean forward slightly to load the chest",
      "Lower until shoulders are just below elbows",
      "Press back up to lockout"
    ]
  },
  "assisted-chest-dip": {
    "name": "Chest Dip (Assisted)",
    "cues": [
      "More counterweight makes it easier",
      "Lean forward, lower under control",
      "Press up without bouncing off the pad"
    ]
  },
  "weighted-chest-dip": {
    "name": "Chest Dip (Weighted)",
    "cues": [
      "Belt snug, weight hanging still",
      "Same depth as a bodyweight dip",
      "Drive up, don’t swing"
    ]
  },
  "bent-over-row": {
    "name": "Bent Over Row (Barbell)",
    "cues": [
      "Hinge to ~45°, flat back",
      "Pull the bar to the lower ribs",
      "Lower under control, no torso swing"
    ]
  },
  "lat-pulldown": {
    "name": "Lat Pulldown (Cable)",
    "cues": [
      "Thighs locked under the pad",
      "Pull the bar to the upper chest",
      "Elbows down and in, slow on the way up"
    ]
  },
  "deadlift": {
    "name": "Deadlift (Barbell)",
    "cues": [
      "Bar over mid-foot, shins close",
      "Brace, push the floor away",
      "Lock out with the glutes, not the lower back"
    ]
  },
  "lateral-raise": {
    "name": "Lateral Raise (Dumbbell)",
    "cues": [
      "Lead with the elbows",
      "Raise to shoulder height, no higher",
      "Slow down, no swinging"
    ]
  },
  "arnold-press": {
    "name": "Arnold Press (Dumbbell)",
    "cues": [
      "Start palms facing you at the chin",
      "Rotate out as you press up",
      "Reverse the turn on the way down"
    ]
  },
  "dumbbell-curl": {
    "name": "Bicep Curl (Dumbbell)",
    "cues": [
      "Elbows pinned to your sides",
      "Curl up, turn the pinkies in at the top",
      "Lower all the way, slowly"
    ]
  },
  "hammer-curl": {
    "name": "Hammer Curl (Dumbbell)",
    "cues": [
      "Thumbs up, palms facing each other",
      "Elbows still, curl to the shoulder",
      "Control the lower"
    ]
  },
  "bicep-curl-21s": {
    "name": "21s Bicep Curl",
    "cues": [
      "7 reps bottom half, 7 top half, 7 full",
      "Elbows stay at your sides",
      "Lighter than your normal curl"
    ]
  },
  "triceps-pushdown": {
    "name": "Triceps Pushdown",
    "cues": [
      "Elbows pinned to your sides",
      "Push down to full lockout",
      "Only the forearms move"
    ]
  },
  "triceps-rope-pushdown": {
    "name": "Triceps Rope Pushdown",
    "cues": [
      "Elbows tight to the ribs",
      "Split the rope apart at the bottom",
      "Control the rope back up"
    ]
  },
  "leg-press": {
    "name": "Leg Press (Machine)",
    "cues": [
      "Feet shoulder-width, mid-platform",
      "Lower until the knees reach ~90°",
      "Don’t lock the knees hard at the top"
    ]
  },
  "leg-extension": {
    "name": "Leg Extension (Machine)",
    "cues": [
      "Knee lined up with the machine’s pivot",
      "Extend fully, squeeze the quads",
      "Slow on the way down"
    ]
  },
  "lying-leg-curl": {
    "name": "Lying Leg Curl (Machine)",
    "cues": [
      "Hips pressed into the pad",
      "Curl the heels to the glutes",
      "Lower under control"
    ]
  },
  "seated-leg-curl": {
    "name": "Seated Leg Curl (Machine)",
    "cues": [
      "Thigh pad snug above the knees",
      "Curl the heels down and back",
      "Slow return to a stretch"
    ]
  },
  "box-squat": {
    "name": "Box Squat (Barbell)",
    "cues": [
      "Sit back to the box, shins vertical",
      "Pause briefly, stay braced",
      "Drive up without rocking"
    ]
  },
  "barbell-bulgarian-split-squat": {
    "name": "Bulgarian Split Squat (Barbell)",
    "cues": [
      "Bar on the upper back, rear foot on the bench",
      "Drop straight down, torso tall",
      "Drive through the front heel"
    ]
  },
  "box-jump": {
    "name": "Box Jump",
    "cues": [
      "Swing the arms, jump up — not out",
      "Land soft and quiet, knees out",
      "Step down, don’t jump down"
    ]
  },
  "calf-press": {
    "name": "Calf Press (Machine)",
    "cues": [
      "Balls of the feet on the platform edge",
      "Full stretch at the bottom",
      "Press up high and pause"
    ]
  },
  "calf-extension-machine": {
    "name": "Calf Extension (Machine)",
    "cues": [
      "Knees straight but not locked",
      "Point the toes through the full range",
      "Slow on the way back"
    ]
  },
  "bird-dog": {
    "name": "Bird Dog",
    "cues": [
      "Hands under shoulders, knees under hips",
      "Reach opposite arm and leg long",
      "Hips stay level — no twisting"
    ]
  },
  "ab-wheel": {
    "name": "Ab Wheel",
    "cues": [
      "Tuck the pelvis, ribs down",
      "Roll out only as far as you can hold a flat back",
      "Pull back with the abs, not the hips"
    ]
  },
  "ab-scissors": {
    "name": "Ab Scissors",
    "cues": [
      "Lower back pressed into the floor",
      "Legs long, cross and switch",
      "Small, controlled kicks"
    ]
  },
  "bicycle-crunch": {
    "name": "Bicycle Crunch",
    "cues": [
      "Elbow to the opposite knee",
      "Extend the other leg long",
      "Rotate through the ribs, not the neck"
    ]
  },
  "bicycle-crunch-raised-legs": {
    "name": "Bicycle Crunch Raised Legs",
    "cues": [
      "Legs stay up off the floor throughout",
      "Elbow to the opposite knee",
      "Slow and controlled beats fast"
    ]
  },
  "burpee": {
    "name": "Burpee",
    "cues": [
      "Hands down, jump the feet back",
      "Chest to the floor, push up",
      "Feet in, jump with the arms overhead"
    ]
  },
  "air-bike": {
    "name": "Air Bike",
    "cues": [
      "Push and pull the handles",
      "Drive through the whole pedal stroke",
      "Harder work = more air resistance"
    ]
  },
  "aerobics": {
    "name": "Aerobics",
    "cues": [
      "Step fully onto the platform",
      "Keep a steady rhythm",
      "Breathe — conversational pace"
    ]
  },
  "boxing": {
    "name": "Boxing",
    "cues": [
      "Hands up, chin down",
      "Punch from the hips, not the arm",
      "Stay light on the feet"
    ]
  }
};

en.muscle = {
  "Chest": "Chest",
  "Back": "Back",
  "Shoulders": "Shoulders",
  "Biceps": "Biceps",
  "Triceps": "Triceps",
  "Forearms": "Forearms",
  "Traps": "Traps",
  "Quads": "Quads",
  "Hamstrings": "Hamstrings",
  "Glutes": "Glutes",
  "Calves": "Calves",
  "Adductors": "Adductors",
  "Abs": "Abs",
  "Full body": "Full body",
  "Cardio": "Cardio"
};

en.equip = {
  "Barbell": "Barbell",
  "Dumbbell": "Dumbbell",
  "Kettlebell": "Kettlebell",
  "Machine": "Machine",
  "Cable": "Cable",
  "Band": "Band",
  "Trap bar": "Trap bar",
  "Bodyweight": "Bodyweight",
  "Other": "Other"
};

en.gym = {
  "kind": {
    "warmup": "Warm-up",
    "work": "Work",
    "drop": "Drop",
    "failure": "Failure"
  },
  "letter": {
    "warmup": "W",
    "drop": "D",
    "failure": "F"
  },
  "rest": "Rest {time}",
  "restOff": "Rest off",
  "logged": "Logged",
  "restLeft": "Rest {time} left",
  "restK": "Rest",
  "less15": "15 seconds less",
  "more15": "15 seconds more",
  "skip": "Skip",
  "time": "Time",
  "pressStart": "press Start when you’re ready",
  "start": "Start",
  "save": "Save",
  "finish": "Finish",
  "exercises": "Exercises",
  "noExercises": "No exercises yet. Add some, or start from a routine in Settings.",
  "addExercises": "Add exercises",
  "saveRoutine": "Save as routine",
  "menu": {
    "up": "Move up",
    "down": "Move down",
    "link": "Superset with next",
    "unlink": "Remove from superset",
    "replace": "Replace exercise",
    "remove": "Remove exercise"
  },
  "more": "More",
  "moreAria": "{name}: more",
  "colSet": "Set",
  "colLast": "Last",
  "colTime": "Time",
  "colKg": "Kg",
  "colPlusKg": "+Kg",
  "colReps": "Reps",
  "done": "Done",
  "supersetAria": "Superset {letter}: {name}",
  "superset": "Superset {letter}",
  "historyAria": "{name}: history and records",
  "dragAria": "Drag to reorder {name}",
  "dragTitle": "Drag to reorder",
  "restBetween": "Rest between sets",
  "note": "Note",
  "notePh": "A note for this exercise",
  "noteAria": "Note for {name}",
  "howTo": "How to",
  "addSet": "Add set",
  "setName": "{kind} set {label}",
  "useLast": "Use last time: {set}",
  "lastPrefix": "Last ",
  "changeType": "{name}. Change type or remove",
  "removeSet": "Remove set",
  "clockAria": {
    "start": "Start the clock for {name}",
    "stop": "Stop the clock for {name}"
  },
  "seconds": "seconds",
  "addedKilos": "added kilos",
  "kilos": "kilos",
  "reps": "reps",
  "setDone": "{name} done",
  "setDonePR": "{name} done, personal record",
  "pr": "PR",
  "sumSets": "Sets",
  "sumVolume": "Volume",
  "sumTime": "Time",
  "savedEarned": "Saved. This session earned",
  "backToLog": "Back to the log",
  "routineTitle": "Save as routine",
  "routineLabel": "Routine name",
  "routineSubmit": "Save routine",
  "routineSaved": "Saved “{name}”. Start it from Settings or the + button.",
  "tickFirst": "Tick at least one working set first.",
  "saved": "Saved",
  "flyChip": "+1 set",
  "replaceTitle": "Replace exercise",
  "removeConfirm": {
    "one": "Remove {name}? Its {n} logged set goes too.",
    "other": "Remove {name}? Its {n} logged sets go too."
  }
};

en.pose = {
  "run": [
    "Tall posture, relaxed shoulders",
    "Quick light cadence (~180 spm)",
    "Land under your hips"
  ],
  "bike": [
    "Smooth, round pedal stroke",
    "Relaxed grip and shoulders",
    "Hold target RPE / HR"
  ],
  "swim": [
    "Long reach, high elbow catch",
    "Rotate from the hips",
    "Exhale steadily underwater"
  ],
  "mobility": [
    "Move slow and controlled",
    "Breathe into each position",
    "Never force a stretch"
  ],
  "fallback": [
    "Control the eccentric",
    "Full range of motion",
    "Log weight + RPE"
  ]
};

en.stats = {
  "heaviest": "Heaviest: {v} kg",
  "e1rm": "Est. 1RM: {v} kg",
  "mostReps": "Most reps: {v}",
  "longest": "Longest: {v} s",
  "subE1rm": "est. 1RM",
  "subHeaviest": "heaviest",
  "subLongest": "longest",
  "subReps": "most reps",
  "repsN": "{n} reps",
  "noSets": "No gym sets logged in the last four weeks.",
  "balance": "{total} working sets in four weeks. {muscle} got the most ({pct}%).",
  "noneFor": "None for {list}.",
  "groupsNoSets": "{n} muscle groups had no sets.",
  "or": "or"
};

en.split = {
  "preset": {
    "full3": "Full body ×3",
    "upper-lower": "Upper / Lower",
    "ppl": "Push / Pull / Legs",
    "arnold": "Arnold split",
    "bro5": "Bro split ×5",
    "ppl6": "Push / Pull / Legs ×6"
  },
  "day": {
    "fullA": "Full body A",
    "fullB": "Full body B",
    "fullC": "Full body C",
    "upper": "Upper",
    "lower": "Lower",
    "push": "Push",
    "pull": "Pull",
    "legs": "Legs",
    "chestBack": "Chest & back",
    "shouldersArms": "Shoulders & arms",
    "chest": "Chest",
    "back": "Back",
    "shoulders": "Shoulders",
    "arms": "Arms"
  },
  "rest": "Rest",
  "dayN": "Day {n}",
  "addDay": "Add at least one training day.",
  "tooMany": "{gym} gym days, but only {days} training days a week. The coach will fit what it can.",
  "noGroups": "{label} has no muscle groups yet.",
  "missing": "No day trains {list}.",
  "backToBack": "{a} and {b} both train {list} on back-to-back days."
};

en.gh = {
  "est1rm": "Estimated 1RM",
  "longestSet": "Longest set",
  "mostReps": "Most reps",
  "chartAria": "From {a} on {da} to {b} on {db}",
  "exercise": "Exercise",
  "tE1rm": "Est. 1RM",
  "tHeaviest": "Heaviest",
  "tMostReps": "Most reps",
  "tLongest": "Longest",
  "tBest": "Best session",
  "volumeOn": "volume · {date}",
  "historyAria": "{name} history",
  "history": "History",
  "e1rmNote": "Est. 1RM is an estimate from your best set (Epley formula, sets of {n} reps or fewer), not a lift you did.",
  "sessions": "Sessions",
  "noTicked": "No ticked sets for this exercise yet. Its records and chart start with your first logged session.",
  "records": "Records",
  "recordsEmpty": "Your best lifts land here once you’ve logged a gym session.",
  "plaqueAria": "{name}: {value} {sub}. Open history",
  "weeklyAria": "Working sets per week: {vals}",
  "weeklyAriaM": "Working sets per week for {muscle}: {vals}",
  "gym": "Gym",
  "gymEmpty": "Log a gym session and your weekly volume and muscle balance show up here.",
  "gymVolume": "Gym volume",
  "setsThisWeek": " sets this week",
  "muscle": "Muscle",
  "allMuscles": "All muscles",
  "perWeek": "Working sets per week · {from} – this week",
  "balance": "Muscle balance",
  "last4": "last 4 weeks"
};

en.pk = {
  "kind": {
    "weight_reps": "Weight and reps",
    "bodyweight": "Bodyweight reps",
    "time": "Time"
  },
  "addExercises": "Add exercises",
  "yours": " · yours",
  "nothing": "Nothing matches. Try fewer letters, clear a filter, or create it.",
  "recent": "Recent",
  "create": "Create",
  "add": "Add",
  "addN": "Add {n}",
  "name": "Name",
  "equipment": "Equipment",
  "mainMuscle": "Main muscle",
  "loggedAs": "Logged as",
  "back": "Back",
  "saveExercise": "Save exercise",
  "createExercise": "Create exercise",
  "search": "Search exercise",
  "allEquipment": "All equipment",
  "allMuscles": "All muscles",
  "muscle": "Muscle",
  "save": "Save",
  "errName": "Give it a name.",
  "errExists": "That exercise already exists.",
  "routine": "Routine"
};

en.ed = {
  "segKind": {
    "warmup": "Warm-up",
    "work": "Work",
    "rest": "Rest / float",
    "cooldown": "Cool-down"
  },
  "label": "Label",
  "min": "min",
  "removeSegment": "Remove segment",
  "exercise": "Exercise",
  "superset": "Superset {letter}",
  "setsAria": "{name} sets",
  "repsAria": "{name} reps",
  "secondsAria": "{name} seconds",
  "sets": " sets",
  "reps": "reps",
  "s": "s",
  "moveUp": "Move {name} up",
  "moveDown": "Move {name} down",
  "drag": "Drag to reorder {name}",
  "remove": "Remove {name}",
  "item": "Item",
  "removeItem": "Remove item",
  "newSession": "New session",
  "editSession": "Edit session",
  "startRoutine": "Start a routine",
  "title": "Title",
  "titlePh": "e.g. Long ride Z2",
  "type": "Type",
  "intensity": "Intensity",
  "date": "Date",
  "distance": "Distance (km, optional)",
  "duration": "Duration: {d}",
  "notes": "Notes / plan",
  "notesPh": "Targets, paces, reminders…",
  "intervals": "Interval structure",
  "noSegments": "No segments. Add work/rest blocks to draw the interval chart.",
  "addSegment": "Add segment",
  "gymExercises": "Gym exercises",
  "noExercises": "No exercises.",
  "addExercises": "Add exercises",
  "packing": "Packing list",
  "noItems": "No items.",
  "addItem": "Add item",
  "delete": "Delete",
  "duplicate": "Duplicate",
  "cancel": "Cancel",
  "save": "Save",
  "newSeg": "Work",
  "deleteConfirm": "Delete this session? This cannot be undone.",
  "deleted": "Session deleted",
  "duplicated": "Session duplicated",
  "session": "Session",
  "questAccepted": "Quest accepted",
  "saved": "Session saved",
  "copy": "{title} (copy)"
};

en.ob = {
  "eco": {
    "endurance": {
      "name": "Endurance / Triathlon",
      "sub": "Swim, bike & run progression"
    },
    "hyrox": {
      "name": "HYROX",
      "sub": "Functional hybrid power + aerobic pacing"
    },
    "hybrid": {
      "name": "Hybrid Athlete",
      "sub": "Weight-room strength + cardio disciplines"
    },
    "gym": {
      "name": "Only Gym / Strength",
      "sub": "Weight training, splits & conditioning"
    }
  },
  "athlete": {
    "tri": {
      "name": "Triathlete",
      "sub": "Swim · bike · run"
    },
    "run": {
      "name": "Runner",
      "sub": "5k to ultra-marathon"
    },
    "bike": {
      "name": "Cyclist",
      "sub": "Road, gravel & endurance"
    },
    "swim": {
      "name": "Swimmer",
      "sub": "Pool & open water"
    }
  },
  "goal": {
    "sprint": {
      "name": "Sprint Triathlon",
      "sub": "750m swim · 20k bike · 5k run"
    },
    "olympic": {
      "name": "Olympic Triathlon",
      "sub": "1.5k swim · 40k bike · 10k run"
    },
    "half": {
      "name": "70.3 · Half-Ironman",
      "sub": "1.9k swim · 90k bike · 21.1k run"
    },
    "full": {
      "name": "140.6 · Full Ironman",
      "sub": "3.8k swim · 180k bike · 42.2k run"
    },
    "5k": {
      "name": "5k · 10k",
      "sub": "Speed & threshold development"
    },
    "half-mar": {
      "name": "Half Marathon",
      "sub": "21.1k endurance build"
    },
    "marathon": {
      "name": "Marathon",
      "sub": "42.2k full distance"
    },
    "ultra": {
      "name": "Ultra / Trail",
      "sub": "50k+ time-on-feet focus"
    },
    "fondo": {
      "name": "Gran Fondo",
      "sub": "100–160k endurance event"
    },
    "century": {
      "name": "Century Ride",
      "sub": "160k / 100 miles"
    },
    "stage": {
      "name": "Stage Race / Tour",
      "sub": "Multi-day back-to-back load"
    },
    "ftp": {
      "name": "FTP Builder",
      "sub": "No race — raise raw power"
    },
    "ow15": {
      "name": "Open Water 1.5k",
      "sub": "First open-water distance"
    },
    "ow3k": {
      "name": "Open Water 3k+",
      "sub": "Marathon-swim endurance"
    },
    "meet": {
      "name": "Pool Meet",
      "sub": "100–400m race pace"
    },
    "fitness": {
      "name": "General Fitness",
      "sub": "Technique & aerobic base"
    }
  },
  "gymgoal": {
    "strength": {
      "name": "Maximum Strength",
      "sub": "Heavy compound lifts, low reps"
    },
    "hypertrophy": {
      "name": "Hypertrophy / Muscle Building",
      "sub": "Volume-driven splits"
    },
    "conditioning": {
      "name": "Functional Conditioning",
      "sub": "Engine work, circuits, carries"
    },
    "support": {
      "name": "Endurance & Injury Prevention",
      "sub": "Strength that supports cardio sport"
    }
  },
  "hyb": {
    "Gym / Strength": "Gym / Strength",
    "Running": "Running",
    "Cycling": "Cycling",
    "Swimming": "Swimming"
  },
  "gen": [
    "AI Coach compiling multi-sport macrocycle…",
    "Balancing periodization curves…",
    "Calculating intensity distribution…",
    "Scaling strength & watt targets to your baselines…",
    "Validating progressive recovery phases…"
  ],
  "qEco": "Select your primary training ecosystem:",
  "qAthlete": "What kind of endurance athlete are you?",
  "qGoal": "What is your primary distance goal?",
  "qHybrid": "Build your hybrid mix.",
  "hybridSub": "Pick every discipline your week should include",
  "qGymGoal": "What is your primary weight room goal?",
  "qHyrox": "Your HYROX pacing & functional baselines.",
  "runPace1k": "Current run pace (1k repeats)",
  "runPacePh": "4:45 min/km",
  "sled": "Sled push / pull comfort",
  "sledPh": "e.g. 125 kg push, steady",
  "wallball": "Wall ball threshold (unbroken reps)",
  "wallballPh": "e.g. 40 reps @ 6 kg",
  "qRace": "When is your primary A-Race?",
  "raceDate": "Race date",
  "raceName": "Race name",
  "raceNamePhHyrox": "HYROX Stockholm",
  "raceNamePh": "Ironman 70.3 Marbella",
  "finish": "Just finish comfortably",
  "pr": "Execute a PR / time goal",
  "qBaselines": "Set your performance baselines.",
  "ftp": "Cycling FTP (W)",
  "runThreshold": "Run threshold pace",
  "runThresholdPh": "4:30 min/km",
  "swimPace": "Swim 100m pace",
  "swimPacePh": "1:45 / 100m",
  "rhr": "Resting HR",
  "maxhr": "Max HR",
  "optional": "optional",
  "qWeek": "What does your training week look like?",
  "longDays": "Preferred long-session days",
  "restDays": "Absolute rest days",
  "capacity": "Weekly training capacity",
  "perWeek": " h / week",
  "qAnalysis": "Analyzing your athletic profile with Strava",
  "hSessions": "Sessions · last 4 weeks",
  "hVolume": "Avg weekly volume",
  "hBike": "Weekly bike",
  "hRun": "Weekly run",
  "hSwim": "Weekly swim",
  "hVerified": "Strava-verified",
  "gap": "Your target of <b>{target} h/week</b> is well above your recent ~{recent} h/week. The plan will apply an injury-prevention ramp: volume builds at most 10–15% per week from your real baseline.",
  "match": "Your target of <b>{target} h/week</b> matches your recent training. The plan builds straight from your baseline.",
  "noHistory": "No recent history found. The plan starts from a conservative base and builds gradually.",
  "restDay": "Rest day",
  "moveHere": ": tap to move {group} here",
  "dayName": "Name of day {n}",
  "removeDay": "Remove {label}",
  "addGroup": "Add a muscle group to {label}",
  "add": "Add",
  "qSplit": "Build your gym split.",
  "splitSub": "Start from a preset, then shape it. Tap a muscle, then tap another day to move it, or drag it.",
  "selectedAria": "{group} selected",
  "selected": "<b>{group}</b> selected",
  "moveBefore": "Move {group} to the day before",
  "moveAfter": "Move {group} to the day after",
  "remove": "Remove",
  "trainingDay": "Training day",
  "restDayBtn": "Rest day",
  "aria": "AI coach setup",
  "back": "Back",
  "stepAnalysis": "AI Coach · Strava analysis",
  "step": "AI Coach · Step {n} of {total}",
  "generate": "Generate tailored plan",
  "continue": "Continue",
  "genAria": "Generating plan",
  "genSub": "This takes a few seconds. Your plan is being tailored.",
  "added": {
    "one": "AI Coach added {n} tailored session to your calendar",
    "other": "AI Coach added {n} tailored sessions to your calendar"
  },
  "failed": "Plan generation failed. Try again.",
  "pickEco": "Pick your training ecosystem first",
  "pickAthlete": "Pick your discipline first",
  "pickGoal": "Pick your distance goal first",
  "pickHybrid": "Pick at least one discipline",
  "pickGymGoal": "Pick your weight room goal first",
  "signIn": "Sign in to generate a plan."
};

en.chat = {
  "chat": "Chat",
  "signInText": "Sign in to add friends and message them. Your training stays private; only what you send is shared.",
  "signIn": "Sign in",
  "loading": "Loading your chats…",
  "unreadN": "{n} unread",
  "general": "General",
  "direct": "Direct",
  "more": "More",
  "yourUsername": "Your username: {name}. Edit",
  "notSet": "not set",
  "setUsername": "Set your username",
  "addFriend": "Add friend",
  "request": "Request",
  "wantsFriends": "{handle} wants to be friends",
  "accept": "Accept",
  "moreFor": "More for {name}",
  "declineRequest": "Decline request",
  "you": "You: ",
  "sayHello": "Say hello",
  "threadAria": "{name}",
  "threadAriaUnread": {
    "one": "{name}, {n} unread",
    "other": "{name}, {n} unread"
  },
  "requested": "Requested",
  "waitingFor": "Waiting for {who}",
  "them": "them",
  "cancelRequest": "Cancel request",
  "noFriends": "No friends yet. Tap Add friend and type their username, or open an athlete on Ranks.",
  "noMessages": "No messages yet. Say hello.",
  "read": " · Read",
  "backToChats": "Back to chats",
  "viewProfileOf": "View {name}’s profile",
  "friend": "Friend",
  "moreOptions": "More options",
  "viewProfile": "View profile",
  "removeFriend": "Remove friend",
  "messagePh": "Message {name}",
  "message": "Message",
  "send": "Send",
  "theirUsername": "Their username",
  "add": "Add",
  "addHint": "Type their exact username, or tap an athlete on Ranks and add them from their profile.",
  "usernameRule": "Usernames are 3–20 letters, numbers or _",
  "nowFriendsWith": "You and {name} are friends",
  "requestSent": "Request sent to @{name}",
  "friendAdded": "Friend added",
  "wentWrong": "Something went wrong",
  "removeConfirm": "Remove {name} from your friends? You won’t be able to message each other.",
  "usernamePrompt": "Your username (3–20 letters, numbers or _). Friends use it to find you.",
  "nowAt": "You’re now @{name}",
  "open": "Open",
  "chatUnread": "Chat, {n} unread",
  "notifications": "Notifications",
  "notificationsNew": "Notifications, {n} new",
  "friendRequests": "Friend requests",
  "decline": "Decline {name}",
  "updates": "Updates",
  "nothingNew": "Nothing new. Friend requests and app news show up here.",
  "notif": {
    "accepted": "{name} accepted your friend request",
    "request": "{name} wants to be friends"
  },
  "btn": {
    "friends": "Message",
    "incoming": "Accept request",
    "outgoing": "Requested",
    "none": "Add friend"
  },
  "nowFriends": "You’re now friends",
  "requestSentShort": "Friend request sent"
};

en.room = {
  "athlete": "Athlete",
  "unblock": "Unblock {name}",
  "report": "Report message",
  "block": "Block {name}",
  "removeMine": "Remove my message",
  "removeAdmin": "Remove (admin)",
  "more": "More",
  "moreAria": "More for this message",
  "removed": "Message removed",
  "hidden": "Message hidden (you blocked {name})",
  "sending": "Sending…",
  "notSent": "Not sent.",
  "retry": "Retry",
  "discard": "Discard",
  "openProfile": "{name}, open profile",
  "loadingEarlier": "Loading earlier messages…",
  "start": "This is the start of General. Be kind, keep it about training.",
  "empty": "No messages yet. Say hello to everyone.",
  "loading": "Loading General…",
  "general": "General",
  "loadFailed": "Couldn’t load General. {error}",
  "tryAgain": "Try again",
  "aria": "General chat",
  "offline": "You’re offline. You can read; sending waits until you’re back.",
  "ph": "Message everyone",
  "phAria": "Message everyone in General",
  "send": "Send",
  "whatsWrong": "What’s wrong? (optional)",
  "reportNote": "The owner of MOSKE reviews every report. The author isn’t told who reported it.",
  "reportBtn": "Report",
  "reported": "Reported. Thanks for keeping General friendly.",
  "reportFailed": "Couldn’t report",
  "blockConfirm": "Block {name}? Their messages will be hidden for you. They won’t be told.",
  "blocked": "{name} is blocked",
  "removeConfirm": "Remove this message for everyone?",
  "wentWrong": "Something went wrong",
  "roomFailed": "Couldn’t load the room",
  "offlineSend": "You’re offline. Your message will need sending again once you’re back.",
  "slowDown": "Slow down: at most 10 messages a minute.",
  "slowDownShort": "Slow down: at most 10 a minute.",
  "writeFirst": "Write something first.",
  "tooLong": "Keep it under {n} characters."
};

en.auth = {
  "writeError": "Couldn’t save that change to your account. It may reappear when you reload. {detail}",
  "checkConnection": "Check your connection and try again.",
  "signedInSynced": {
    "one": "Signed in · synced {n} local session to your account",
    "other": "Signed in · synced {n} local sessions to your account"
  },
  "signedInSyncing": "Signed in · your data is now syncing",
  "setPassword": "Set a new password",
  "newPassword": "New password",
  "confirmPassword": "Confirm new password",
  "updatePassword": "Update password",
  "noMatch": "Passwords don’t match.",
  "updated": "Password updated. You’re signed in.",
  "updateFailed": "Could not update password",
  "signIn": "Sign in",
  "close": "Close",
  "title": "Sign in to sync",
  "sub": "Your training, on every device.",
  "email": "Email",
  "password": "Password",
  "create": "Create account",
  "forgot": "Forgot password?",
  "magic": "Email me a magic link",
  "emailFirst": "Type your email above first.",
  "magicSent": "Check your email for the magic link.",
  "magicFailed": "Could not send link",
  "resetSent": "Check your email for a password-reset link.",
  "resetFailed": "Could not send reset email",
  "created": "Account created. Confirm your email, then sign in.",
  "failed": "Sign-in failed",
  "err": {
    "invalid": "Wrong email or password.",
    "unconfirmed": "Confirm your email first, then sign in.",
    "exists": "There’s already an account with that email. Sign in instead.",
    "short": "The password needs at least 6 characters."
  }
};

en.lb = {
  "daysLeft": {
    "one": "<b>{n}</b> day left in season {s}",
    "other": "<b>{n}</b> days left in season {s}"
  },
  "title": "Leaderboards",
  "monthly": "Monthly season",
  "prize": "First place wins a 20% discount on your next MOSKE order.",
  "season": "Season",
  "allTime": "All-time",
  "loading": "Loading the leaderboard…",
  "ranks": "Ranks",
  "noSync": "Leaderboards need cloud sync configured.",
  "empty": "No ranked athletes yet. Complete a verified workout to appear here.",
  "failed": "Couldn’t load the leaderboard. Check your connection and try again.",
  "up": "Up {n} since your last visit",
  "down": "Down {n} since your last visit",
  "new": "New",
  "same": "Same rank as your last visit",
  "top3": "Top three",
  "podAria": "#{rank} {name}, {xp} XP",
  "toPass": "<b class=\"lb-gap\">{xp} XP</b> to pass {name}",
  "behind": "{name} is <b class=\"lb-gap\">{xp} XP</b> behind you",
  "rival": "Your rival",
  "chaser": "Your chaser",
  "you": "You #{rank}"
};

en.pp = {
  "ms": {
    "first": "First Steps",
    "tenK": "First 10K",
    "centurion": "Centurion",
    "half": "Half Century",
    "king": "Consistency King",
    "beast": "Fortnight Beast"
  },
  "profile": "Profile",
  "athlete": "Athlete",
  "rank": "Season rank #{rank} · ",
  "level": "Level {n}",
  "workouts": "Workouts",
  "distance": "Distance",
  "streak": "Streak",
  "hours": "Hours",
  "achievements": "Achievements",
  "failed": "Couldn’t load this profile.",
  "loading": "Loading profile…"
};

en.misc = {
  "week": "Week path",
  "stopLabel": "{day}: {what}",
  "restLow": "rest",
  "nothing": "nothing planned",
  "and": " and ",
  "verified": ", verified",
  "today": ", today",
  "gateAria": "{title} in {n} days",
  "daysShort": "{n}d",
  "todayLow": "today",
  "dShort": "{n} d",
  "weekAria": "Week path: {flags} of {planned} days verified{ev}. Open the season path",
  "weekAriaEv": ", {title} in {n} days",
  "weekN": "Week {n}",
  "now": "Now",
  "sessionsVerified": "{done} of {planned} sessions verified",
  "sessionsWord": " sessions · ",
  "hPlanned": " h planned",
  "next8": "Next 8 weeks",
  "seasonPath": "Season path",
  "addRace": "Add a race in Settings and the path runs to its finish gate.",
  "shop": "Shop",
  "loadingProducts": "Loading products…",
  "noProducts": "No products in this drop yet.",
  "shopFailed": "Couldn’t load the shop. Check your connection and try again.",
  "shareCard": "Share card",
  "drawing": "Drawing your card…",
  "drawFailed": "Couldn’t draw the card. Try again in a moment.",
  "shareAlt": "Your share card: {title}",
  "sharePost": "Share post",
  "shareStory": "Share story",
  "savePost": "Save post",
  "saveStory": "Save story",
  "sizes": "Post is 1080 × 1350, story is 1080 × 1920.",
  "session": "Session",
  "shareText": "{title} · done",
  "shareFailed": "Sharing didn’t work here. Try Save instead.",
  "trainedWith": "TRAINED WITH MOSKE",
  "refreshing": "Refreshing…",
  "upToDate": "Up to date",
  "refreshFailed": "Couldn’t refresh",
  "demoAthlete": "Demo athlete",
  "wentWrong": "Something went wrong",
  "thatsYou": "That’s you.",
  "noAthlete": "No athlete is called @{name}.",
  "friendsOnly": "You can only message friends.",
  "signInFirst": "Sign in first",
  "syncFailed": "Sync failed ({status})",
  "stravaActivity": "Strava activity"
};

en.pace = {
  "run": {
    "easy": "~5:05–5:30 /km",
    "steady": "~5:00 /km",
    "moderate": "MP ~4:40–4:55 /km",
    "threshold": "~4:10–4:25 /km (RPE 6–7)",
    "quality": "hard reps, RPE 7–8",
    "vo2": "RPE 8–9",
    "race": "race pace"
  },
  "bike": {
    "easy": "Z2 recovery, RPE 3",
    "steady": "Z2 conversational, RPE 3–4",
    "threshold": "2–3×12–15′, RPE 6–7",
    "quality": "RPE 7",
    "vo2": "5×3′, RPE 8–9",
    "race": "race effort"
  },
  "swim": {
    "easy": "easy aerobic",
    "steady": "aerobic technique"
  },
  "brick": {
    "race": "70.3 race pace off the bike"
  }
};

en.sheet = {
  "back": "Back",
  "close": "Close"
};

en.rt = {
  "exercises": {
    "one": "{n} exercise",
    "other": "{n} exercises"
  },
  "start": "Start",
  "delete": "Delete routine {name}",
  "newRecord": "New record",
  "event": "Event"
};

en.ai = {
  "failed": "AI plan generation failed.",
  "unavailable": "The AI coach is unavailable right now.",
  "bad": "The AI coach sent back a plan the app couldn’t read. Try again."
};

en.xp = {
  "reason": {
    "proof": "Not counted: link it on Strava to earn XP.",
    "sets": "Not counted: tick at least 3 working sets.",
    "timestamps": "Not counted: some sets were ticked without a time.",
    "tooFast": "Not counted: the sets were ticked too fast to be one session.",
    "tooLong": "Not counted: the sets are spread over more than 4 hours.",
    "short": "Not counted: shorter than 10 minutes.",
    "cap": "Daily gym cap reached: gym XP logged in the app tops out at 150 a day."
  },
  "verified": "Verified by Strava: +10% XP",
  "verifiedShort": "Verified",
  "checkin": "Checked in at your gym",
  "notCounted": "Not counted",
  "savedNot": "Saved. This session didn’t earn XP:",
  "lbChip": "{pct}%",
  "lbAria": "{pct}% of their XP is verified by Strava",
  "lbLegend": "The Strava % is the share of an athlete’s XP verified by Strava. Gym sessions logged in the app count too, within the XP rules.",
  "lbBase": "Ranks counts base XP: gear and gels never count here.",
  "baseN": "{n} base",
  "gearN": "{n} gear",
  "gelN": "{n} fuel",
  "coinsN": {
    "one": "+{n} coin",
    "other": "+{n} coins"
  },
  "carbsN": "+{n} g carbs"
};

en.checkin = {
  "title": "Gym check-in",
  "settingsLabel": "Gym check-in",
  "stateOn": "On",
  "stateOff": "Off",
  "what": "When you finish a gym session, MOSKE can check whether you’re at the gym you saved, and put a pin on the session when you are.",
  "p1": "Only a yes is kept with the session: never where you were.",
  "p2": "Your gym’s position is saved on this phone only. It isn’t synced or sent anywhere.",
  "p3": "It’s off unless you turn it on, and it doesn’t change your XP.",
  "onSaved": "On. Your gym is saved on this phone.",
  "onNoSpot": "On, but no gym is saved on this phone yet.",
  "saveHere": "Save this place as my gym",
  "turnOff": "Turn off and forget my gym",
  "turnOn": "Turn on and save this place as my gym",
  "notNow": "Not now",
  "saved": "Gym saved. Finishing a session here adds the pin.",
  "noLocation": "Couldn’t get your location. Check the browser’s location permission."
};

en.gear = {
  "title": "GEAR",
  "item": {
    "bike-wheels": {
      "slot": "Wheels",
      "blurb": "Better wheels roll faster for the same watts.",
      "t0": "Stock wheels",
      "t1": "Alloy training wheels",
      "t2": "Carbon wheels",
      "t3": "Deep-section carbon"
    },
    "bike-aerobars": {
      "slot": "Aerobars",
      "blurb": "Get low, cut the wind.",
      "t0": "No aerobars",
      "t1": "Clip-on aerobars",
      "t2": "Carbon clip-ons",
      "t3": "Integrated cockpit"
    },
    "bike-frame": {
      "slot": "Frame",
      "blurb": "Lighter and stiffer, every pedal stroke counts.",
      "t0": "Steel frame",
      "t1": "Alloy frame",
      "t2": "Carbon frame",
      "t3": "Carbon TT frame"
    },
    "bike-power": {
      "slot": "Power",
      "blurb": "Train by watts, not by feel.",
      "t0": "No power meter",
      "t1": "Single-sided power",
      "t2": "Dual-sided power",
      "t3": "Dual power + smart trainer"
    },
    "swim-goggles": {
      "slot": "Goggles",
      "blurb": "See the line, sight the buoy.",
      "t0": "Basic goggles",
      "t1": "Anti-fog goggles",
      "t2": "Mirrored goggles",
      "t3": "Racing goggles"
    },
    "swim-paddles": {
      "slot": "Paddles",
      "blurb": "More water per stroke builds the pull.",
      "t0": "No paddles",
      "t1": "Finger paddles",
      "t2": "Small paddles",
      "t3": "Full paddles"
    },
    "swim-buoy": {
      "slot": "Buoy and fins",
      "blurb": "Isolate the arms, then the legs.",
      "t0": "No pull buoy",
      "t1": "Pull buoy",
      "t2": "Pull buoy and fins",
      "t3": "Pull, fins and snorkel"
    },
    "swim-wetsuit": {
      "slot": "Wetsuit",
      "blurb": "Float higher, swim straighter in open water.",
      "t0": "No wetsuit",
      "t1": "Sleeveless wetsuit",
      "t2": "Full wetsuit",
      "t3": "Race wetsuit"
    },
    "run-shoes": {
      "slot": "Shoes",
      "blurb": "The one piece of kit every runner feels.",
      "t0": "Old trainers",
      "t1": "Daily trainers",
      "t2": "Tempo shoes",
      "t3": "Carbon racers"
    },
    "run-watch": {
      "slot": "Watch",
      "blurb": "Pace, heart rate and splits on your wrist.",
      "t0": "No watch",
      "t1": "GPS watch",
      "t2": "GPS + heart-rate strap",
      "t3": "Multisport watch"
    },
    "run-kit": {
      "slot": "Kit",
      "blurb": "Light kit that doesn’t chafe at kilometre 30.",
      "t0": "Cotton T-shirt",
      "t1": "Technical kit",
      "t2": "Lightweight kit",
      "t3": "Race singlet"
    },
    "run-recovery": {
      "slot": "Recovery",
      "blurb": "Recover faster, run again sooner.",
      "t0": "No recovery kit",
      "t1": "Foam roller",
      "t2": "Massage gun",
      "t3": "Compression boots"
    },
    "gym-belt": {
      "slot": "Belt",
      "blurb": "Brace harder on the heavy sets.",
      "t0": "No belt",
      "t1": "Nylon belt",
      "t2": "Leather belt",
      "t3": "Lever belt"
    },
    "gym-shoes": {
      "slot": "Shoes",
      "blurb": "A stable base under the bar.",
      "t0": "Running trainers",
      "t1": "Flat shoes",
      "t2": "Lifting shoes",
      "t3": "Competition lifters"
    },
    "gym-sleeves": {
      "slot": "Straps and sleeves",
      "blurb": "Grip and joints that last the session.",
      "t0": "No straps",
      "t1": "Lifting straps",
      "t2": "Straps and knee sleeves",
      "t3": "Straps, sleeves and wrist wraps"
    },
    "gym-bar": {
      "slot": "Bar",
      "blurb": "A bar that doesn’t slip, plates that weigh what they say.",
      "t0": "Any bar",
      "t1": "Chalk",
      "t2": "Chalk and a good bar",
      "t3": "Calibrated bar and plates"
    }
  },
  "kit": {
    "moske-navy": "MOSKE navy",
    "moske-sand": "MOSKE sand"
  },
  "signIn": "Sign in to build your kit. Coins come from training that earns XP, and your gear is kept on your account.",
  "offline": "You’re offline. You can look around; buying needs a connection.",
  "disciplines": "Disciplines",
  "disciplineBoost": "Gear boost",
  "ofCap": "of {cap} max",
  "tierOf": "Tier {n} of {of}",
  "next": "Next",
  "maxed": "Top tier",
  "noBoost": "No boost yet",
  "needMore": "{n} more coins",
  "buyAria": "Buy {name} for {cost} coins, {boost} XP in this discipline",
  "kitsNote": "Colourways for your athlete. They change how you look, not your XP.",
  "wear": "Wear",
  "wearing": "Wearing",
  "honest": "Gear and gels boost your own levels. Ranks counts base XP, the same for everyone.",
  "bought": "Bought.",
  "boughtBoost": "Fitted: {boost} XP in this discipline.",
  "err": {
    "not_signed_in": "Sign in to use GEAR.",
    "unknown_item": "That item isn’t in the workshop.",
    "starter": "You already have the starter kit.",
    "owned": "You already own that.",
    "tier_locked": "Buy the tier below first.",
    "insufficient": "Not enough coins yet.",
    "offline": "You’re offline. Buying needs a connection.",
    "demo": "Demo mode: nothing is bought.",
    "generic": "That didn’t go through. Try again.",
    "fuel_full": "You’re holding the most of that you can.",
    "fuel_none": "You have none of that. Buy some first.",
    "fuel_active": "Fuel is already running.",
    "fuel_limit": "You’ve used your limit of that this week."
  },
  "shop": "Gear shop",
  "inventory": "Inventory",
  "openShop": "Open the gear shop",
  "openInventory": "Open your inventory",
  "tab": {
    "gear": "Gear",
    "clothes": "Clothes",
    "fuel": "Fuel"
  },
  "res": {
    "max": "Max {n}",
    "aria": "Coins {coins}, carbs {carbs} g, each stores up to {cap}"
  },
  "needCarbs": "{n} g more carbs",
  "fuelEffect": "+{pct}% XP for {h} h · {n} a week",
  "fuelFull": "You can hold {n}",
  "buyFuelAria": "Buy {name} for {cost} grams of carbs",
  "buyKitAria": "Buy {name} for {cost} coins",
  "use": "Use",
  "fuelWhy": {
    "active": "Something is already running",
    "limit": "Used up for this week",
    "none": "None left"
  },
  "fuelOn": "{name}: +{pct}% XP for {h} hours",
  "fuelActiveAria": "{name} running: {time} left, +{pct}% XP",
  "clothesNote": "Kit for your athlete, bought with coins. It changes how you look, not your XP.",
  "fuelNote": "Fuel is bought with carbs. Only one runs at a time; take it right before you train.",
  "toShop": "Go to the shop",
  "invNoFuel": "No fuel yet.",
  "invNoClothes": "No clothes yet.",
  "invNoGear": "Only the starter kit so far.",
  "fuel": {
    "gel": {
      "name": "Energy gel",
      "blurb": "A quick hit for one hard session."
    },
    "energy-bar": {
      "name": "Energy bar",
      "blurb": "Oats and honey for a long morning."
    },
    "pasta": {
      "name": "Pasta meal",
      "blurb": "Carb-loading for a big training day."
    }
  }
};

export default en;
