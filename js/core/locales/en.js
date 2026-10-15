// en.js — the app's English. Keys are grouped by screen; values are strings,
// plural objects ({ one, other }) or lists. Spanish lives in es.js with the
// same keys (tests/i18n.test.js checks they match).

const en = {};

en.app = {
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
  "daysN": "{n}d"
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

export default en;
