// es.js — el español de la app (de España, en el registro de un gimnasio o un
// club de triatlón, no de un manual). Mismas claves que en.js; los términos
// dudosos están en docs/i18n/REVIEW.md.

const es = {};

es.app = {
  "storageBlocked": "El almacenamiento está bloqueado (¿modo privado?). Tus datos solo se guardan en memoria y se perderán al cerrar esta pestaña.",
  "title": "MOSKE — Tu entrenamiento de triatlón",
  "description": "MOSKE: entrena triatlón como en un videojuego, también sin conexión.",
  "noscript": "MOSKE necesita JavaScript activado."
};

es.nav = {
  "home": "Inicio",
  "shop": "Tienda",
  "ranks": "Ranking",
  "chat": "Chat",
  "profile": "Perfil",
  "views": "Secciones",
  "notifications": "Notificaciones",
  "accountLevel": "Nivel de la cuenta",
  "openProfile": "Abrir perfil",
  "addSession": "Añadir una sesión",
  "chatUnread": {
    "one": "Chat, {n} sin leer",
    "other": "Chat, {n} sin leer"
  },
  "accountLevelFull": "Nivel de cuenta {level}, te faltan {toNext} XP para el siguiente"
};

es.sport = {
  "run": "Correr",
  "bike": "Bici",
  "swim": "Natación",
  "gym": "Gimnasio",
  "brick": "Brick",
  "mobility": "Movilidad",
  "other": "Otro",
  "cycling": "Ciclismo",
  "running": "Correr",
  "swimming": "Natación"
};

es.intensity = {
  "easy": "Suave",
  "steady": "Constante",
  "moderate": "Moderado",
  "threshold": "Umbral",
  "vo2": "VO₂",
  "quality": "Calidad",
  "race": "Competición",
  "work": "Trabajo"
};

es.date = {
  "daysShort": [
    "lun",
    "mar",
    "mié",
    "jue",
    "vie",
    "sáb",
    "dom"
  ],
  "days": [
    "lunes",
    "martes",
    "miércoles",
    "jueves",
    "viernes",
    "sábado",
    "domingo"
  ],
  "dayLetters": [
    "L",
    "M",
    "X",
    "J",
    "V",
    "S",
    "D"
  ],
  "months": [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sept",
    "oct",
    "nov",
    "dic"
  ],
  "shortLabel": "{day} {date} {month}",
  "today": "Hoy",
  "yesterday": "Ayer",
  "tomorrow": "Mañana",
  "now": "ahora",
  "minAgo": "{n} min",
  "hourAgo": "{n} h"
};

es.ui = {
  "packRemove": "Quitar {item}",
  "packEmpty": "Todavía no hay nada",
  "packAddPh": "Añadir algo…",
  "packAddAria": "Añadir a la bolsa",
  "add": "Añadir",
  "fuelTitle": "Recordatorio de avituallamiento",
  "fuelText": "Practica 60–90 g de hidratos/h",
  "vsPlan": "/ {planned} previsto",
  "actual": {
    "distance": "Distancia",
    "time": "Tiempo",
    "avgHr": "FC media",
    "avgPower": "Potencia media",
    "cadence": "Cadencia",
    "elevation": "Desnivel",
    "calories": "Calorías",
    "rpe": "RPE"
  },
  "viewOnStrava": "Ver en Strava ↗",
  "actualTitle": "Lo que hiciste",
  "logActual": "Apunta el resultado real",
  "fieldAvgHr": "FC media",
  "zoneTitle": "Zona de frecuencia cardiaca {n}",
  "sessionBlock": "Sesión",
  "noLevels": "Aún no hay niveles para este deporte.",
  "zoomLevel": "Ampliar nivel {n}",
  "levelAlt": "{sport}, nivel {n}",
  "unlockMore": "Completa más sesiones de {sport} para desbloquear el siguiente escenario.",
  "xpToLevel": "{xp} XP para el nivel {next}",
  "sportLevels": "Niveles por deporte",
  "powerBar": "{min} min a {watts} W ({pct}% del FTP)",
  "power": "Potencia",
  "ftpNote": "FTP {ftp} W · ajustado a tu perfil",
  "packing": "Bolsa",
  "tagRace": "Carrera",
  "tagTaper": "Tapering",
  "tagDeload": "Descarga",
  "completed": "Hecha",
  "planned": "Prevista",
  "next": "Siguiente",
  "shareCard": "Compartir tarjeta",
  "edit": "Editar",
  "duplicate": "Duplicar",
  "delete": "Borrar",
  "raceDayBanner": "Día de carrera: {title}. A por ello.",
  "nextEvent": "Próxima carrera: {title} · {date}",
  "aiOffer": "¿Quieres un plan hecho para tus carreras y tu semana?",
  "buildPlan": "Crear mi plan",
  "questsCleared": "Misiones completadas",
  "questsClearedSub": "+{xp} XP hoy · nuevas en {time}",
  "questDone": " (hecha)",
  "noQuests": "Hoy no hay misiones. Planifica una sesión para desbloquear alguna.",
  "dailyQuests": "Misiones del día",
  "resetsAtMidnight": "Se renuevan a medianoche",
  "resetsIn": "Reinicio {time}",
  "todayEyebrow": "{weekday} · hoy",
  "openCalendar": "Abrir tu calendario",
  "calendar": "Calendario",
  "tomorrowLine": "{sport}: {title}",
  "restRecovery": "Día de descanso y recuperación",
  "tomorrow": "Mañana",
  "niceWork": "Buen trabajo, hoy ya has entrenado.",
  "freshDay": "Día nuevo, piernas frescas.",
  "thisWeek": "Esta semana",
  "plan": "Plan",
  "vol": "Vol",
  "int": "Int",
  "volume": "Volumen",
  "intensity": "Intensidad",
  "xBase": "{ratio}× tu base",
  "calibrating": "calibrando",
  "editGoals": "Editar objetivos",
  "hoursUnit": "h",
  "insightPerfect": "Todos los objetivos de la semana cumplidos. Semana perfecta.",
  "insightKm": "Te faltan {n} km para tu objetivo de distancia semanal.",
  "insightHours": "Te quedan {n} horas de entreno para tu objetivo semanal.",
  "insightSessions": {
    "one": "Te falta {n} sesión esta semana para tu objetivo.",
    "other": "Te faltan {n} sesiones esta semana para tu objetivo."
  },
  "today": "Hoy",
  "rest": "Descanso",
  "nextUp": "Lo siguiente",
  "nextUpLine": "Lo siguiente: {title} · {date}",
  "nothingScheduled": "Nada planificado. Toca para añadir una sesión.",
  "done": "Hecha",
  "structuredHint": " · sesión estructurada, toca para ver la serie completa",
  "detailsHint": " · toca para ver detalles",
  "moreToday": {
    "one": "+ {n} sesión más hoy. Míralo en el calendario.",
    "other": "+ {n} sesiones más hoy. Míralo en el calendario."
  },
  "restDay": "Descanso",
  "addSession": "Añadir una sesión",
  "prevWeek": "Semana anterior",
  "nextWeek": "Semana siguiente",
  "profile": "Perfil",
  "zone": {
    "ok": "en la zona buena",
    "high": "alta, ojo con la fatiga",
    "danger": "disparada, levanta el pie",
    "detraining": "baja, hay margen para cargar",
    "unknown": "creando tu base"
  },
  "noRunLastWeek": "La semana pasada no corriste, no hay con qué comparar.",
  "runVolume": "Volumen corriendo {pct}% respecto a la semana pasada ({last}→{now} km).",
  "trainingLoad": "Carga de entrenamiento",
  "acute": "Aguda (7 d)",
  "chronic": "Crónica (semanal)",
  "acwr": "ACWR",
  "acwrLine": "El ratio agudo:crónico está {zone}. Lo ideal, entre 0,8 y 1,3. {runLine}",
  "bodyMetrics": "Datos corporales",
  "weight": "Peso",
  "restingHr": "FC en reposo",
  "sleep": "Sueño",
  "phKg": "kg",
  "phRhr": "FC reposo",
  "phSleep": "horas de sueño",
  "ariaWeight": "Peso en kg",
  "ariaRhr": "FC en reposo",
  "ariaSleep": "Horas de sueño",
  "logToday": "Apuntar hoy",
  "weeklyVolume": "Volumen semanal (8 últimas semanas)",
  "weeklyVolumeNote": "Horas de entreno completado por semana.",
  "disciplineBreakdown": "Reparto por deporte",
  "noSplit": "Completa sesiones para ver tu reparto.",
  "consistency": "Constancia",
  "consistencyLine": "Racha actual {current} · la más larga {longest} días",
  "heatDone": " · hecho",
  "badges": "Insignias",
  "paceRef": "Ritmos y zonas de referencia",
  "planPrinciples": "Principios del plan",
  "totals": {
    "level": "Nivel",
    "totalXp": "XP total",
    "sessions": "Sesiones",
    "hours": "Horas",
    "distance": "Distancia",
    "bestStreak": "Mejor racha"
  },
  "daysShort": "{n} d",
  "raceIn": {
    "one": "{title} en {n} día",
    "other": "{title} en {n} días"
  }
};

es.main = {
  "badgeUnlocked": "Insignia desbloqueada",
  "accountLevel": "Nivel de cuenta {level}",
  "questOne": "Misión completada +{xp} XP",
  "questMany": "{n} misiones completadas +{xp} XP",
  "levelUp": "Subes de nivel",
  "levelAlt": "{sport}, nivel {n}",
  "levelAria": "Nivel {n}",
  "newScenery": " Pronto llega un escenario nuevo.",
  "continue": "Seguir",
  "removed": {
    "one": "{message} · {n} sesión eliminada",
    "other": "{message} · {n} sesiones eliminadas"
  },
  "signOutConfirm": "¿Cerrar sesión? Tus datos se quedan en la nube y en este dispositivo.",
  "stravaConnectFailed": "No se pudo conectar Strava",
  "stravaSync": "Strava: {link} vinculadas, {insert} añadidas",
  "syncFailed": "No se pudo sincronizar",
  "stravaDisconnected": "Strava desconectado",
  "disconnectFailed": "No se pudo desconectar",
  "deleteRoutine": "¿Borrar la rutina «{name}»? Las sesiones que ya hiciste se quedan.",
  "nothingToClear": "No hay nada que borrar: no tienes sesiones planificadas por delante.",
  "clearConfirm": {
    "one": "¿Borrar {n} sesión planificada a partir de hoy?\n\nLas sesiones hechas y verificadas por Strava se mantienen.",
    "other": "¿Borrar {n} sesiones planificadas a partir de hoy?\n\nLas sesiones hechas y verificadas por Strava se mantienen."
  },
  "futureCleared": "Entrenos futuros borrados",
  "planEmpty": "Tu plan ya está vacío. Crea uno nuevo abajo.",
  "resetConfirm": {
    "one": "¿Reiniciar tu plan de entreno?\n\nSe borra {n} sesión planificada, pasada o futura. Tu historial hecho y verificado por Strava, la XP, los niveles y las insignias se mantienen.",
    "other": "¿Reiniciar tu plan de entreno?\n\nSe borran las {n} sesiones planificadas, pasadas y futuras. Tu historial hecho y verificado por Strava, la XP, los niveles y las insignias se mantienen."
  },
  "planReset": "Plan reiniciado. Crea uno nuevo con el plan de entreno con IA",
  "duplicated": "Sesión duplicada",
  "deleteConfirm": "¿Borrar esta sesión?",
  "deleted": "Sesión borrada",
  "metricsLogged": "Datos de hoy apuntados",
  "noTomorrow": "Mañana no hay ninguna sesión a la que añadirlo.",
  "settings": "Ajustes",
  "sound": "Efectos de sonido",
  "reduceMotion": "Reducir movimiento",
  "units": "Unidades",
  "metric": "Métrico (km)",
  "imperial": "Imperial (mi)",
  "weekStarts": "La semana empieza el",
  "monday": "Lunes",
  "sunday": "Domingo",
  "language": "Idioma",
  "backup": "Copia de seguridad",
  "backupSignedIn": "Sesión iniciada. Tus datos se sincronizan solos entre dispositivos. Puedes exportar e importar igualmente para tener una copia sin conexión.",
  "backupLocal": "Los datos se guardan <b>en este navegador, en este dispositivo</b> (localStorage). <b>No</b> se sincronizan entre el móvil y el portátil. Inicia sesión arriba, o exporta e importa para pasarlos.",
  "export": "Exportar",
  "import": "Importar",
  "calendarFile": "Archivo de calendario",
  "install": "Instalar la app",
  "trainingPlan": "Plan de entreno",
  "ftp": "FTP en bici (vatios)",
  "plannedCount": {
    "one": "{n} sesión planificada en tu calendario ({upcoming} a partir de hoy).",
    "other": "{n} sesiones planificadas en tu calendario ({upcoming} a partir de hoy)."
  },
  "aiPlan": "Plan de entreno con IA",
  "clearFuture": "Borrar lo futuro",
  "resetPlan": "Reiniciar el plan",
  "clearNote": "Borrar lo futuro solo quita las sesiones que vienen; reiniciar quita todo el plan, pasado y futuro. Las sesiones hechas y verificadas por Strava se mantienen siempre, así que tu XP, niveles e insignias están a salvo.",
  "routines": "Rutinas",
  "noRoutines": "Aún no tienes rutinas. Abre una sesión de gimnasio y toca «Guardar como rutina».",
  "packingPresets": "Bolsa por deporte",
  "presetPh": "cosa, cosa, …",
  "dangerZone": "Zona peligrosa",
  "reseed": "Reiniciar y recargar el plan",
  "done": "Hecho",
  "reseedConfirm": "¿Reiniciarlo todo y volver a cargar el plan original? Perderás el progreso apuntado.",
  "reseeded": "Copia exportada y plan recargado",
  "imported": "Datos importados",
  "importFailed": "No se pudo importar: ese archivo no es una copia de MOSKE.",
  "exported": "Copia exportada",
  "calExported": "Calendario exportado",
  "goalsAria": "Editar objetivos semanales",
  "goalsTitle": "Objetivos semanales",
  "goalSessions": "Sesiones planificadas",
  "goalKm": "Distancia / volumen (km)",
  "goalHours": "Horas de entreno",
  "saveGoals": "Guardar objetivos",
  "goalsUpdated": "Objetivos actualizados",
  "newRecord": "Nuevo récord · {name}: {prs}",
  "newRecordHead": "Nuevo récord · {name}",
  "levelsAria": "Niveles de {sport}",
  "levels": "Niveles",
  "artwork": "Ilustración del nivel",
  "stravaAuto": "Strava: {link} vinculadas · {insert} importadas",
  "signedIn": "Sesión iniciada",
  "yourAccount": "tu cuenta",
  "signOut": "Cerrar sesión",
  "signInSync": "Inicia sesión para sincronizar",
  "connectStrava": "Conectar Strava",
  "syncNow": "Sincronizar ya",
  "disconnect": "Desconectar",
  "poweredByStrava": "Powered by Strava",
  "account": "Cuenta",
  "syncPrompt": "Inicia sesión para sincronizar el móvil y el portátil.",
  "signIn": "Iniciar sesión",
  "dismiss": "Cerrar",
  "strava": {
    "connected": "Strava conectado",
    "denied": "Conexión con Strava cancelada",
    "error": "No se pudo conectar con Strava",
    "auth_failed": "No se pudo conectar. Inicia sesión primero."
  },
  "welcome": {
    "aria": "Bienvenido a MOSKE",
    "coachAlt": "Tu entrenador",
    "coachT": "Te presento a tu entrenador",
    "coachB": "Las sesiones se completan cuando Strava las verifica. Eso es lo que da XP, completa las misiones del día y mantiene viva tu racha.",
    "plusT": "Hazlo a tu manera",
    "plusB": "Toca el botón + para añadir una sesión cualquier día, con series, ejercicios y lista para la bolsa.",
    "installT": "Añádela a la pantalla de inicio",
    "installB": "Instala MOSKE y tendrás una app a pantalla completa que funciona sin conexión en el gimnasio. Inicia sesión para sincronizar tus dispositivos.",
    "skip": "Saltar",
    "next": "Siguiente",
    "start": "A entrenar"
  }
};

es.lang = {
  "label": "Idioma",
  "en": "Inglés",
  "es": "Español"
};

es.pg = {
  "athlete": "Atleta",
  "sceneAlt": "Escenario de {sport}, nivel {n}",
  "charAlt": "Personaje de {sport}, nivel {n}",
  "sportGroup": "Deporte",
  "levelN": "Nivel {n}",
  "levelSeeAll": "Nivel {n}: ver todos los niveles",
  "toLevel": "{pct}% para el nivel {n}",
  "xpLine": "{into} / {span} XP · faltan {toNext} para el NV {next}",
  "openProfile": "Abrir perfil",
  "ageNew": "Nueva",
  "ageDays": "{n} d",
  "ageMonths": "{n} m",
  "ageYears": "{n} a",
  "calTitle": {
    "one": "{date} · {n} sesión",
    "other": "{date} · {n} sesiones"
  },
  "act1": "1 actividad",
  "act2": "2 actividades",
  "act3": "3+ actividades",
  "fromStrava": "Importada de Strava",
  "activitySummary": "Resumen de actividad",
  "strainCalibrating": "Calibrando",
  "strainBelow": "Por debajo",
  "strainAbove": "Por encima",
  "strainOn": "En su punto",
  "strain": "Carga y esfuerzo",
  "cupAria": {
    "earned": "{name}: conseguido",
    "locked": "{name}: bloqueado"
  },
  "trophies": "Vitrina de trofeos",
  "trophyTap": "Toca un trofeo para ver cómo se consigue.",
  "earned": "Conseguido",
  "locked": "Bloqueado",
  "status": {
    "Calibrating": "Calibrando",
    "Detraining": "Desentrenando",
    "Maintaining": "Manteniendo",
    "Productive": "Productivo",
    "Peaking": "En pico",
    "Fatigued": "Fatigado"
  },
  "cardioLoad": "Carga cardio",
  "accountSync": "Cuenta y sincronización",
  "signedIn": "Sesión iniciada",
  "syncing": "Sincronizando entre dispositivos",
  "allSettings": "Todos los ajustes",
  "noCompleted": "Aún no has completado ninguna sesión.",
  "activityHistory": "Historial de actividad",
  "backToFitness": "Volver a forma física",
  "activity": "Actividad",
  "history": "Historial",
  "questXp": "{xp} XP de misiones",
  "level": "Nivel",
  "workouts": "Entrenos",
  "streak": "Racha",
  "accountAge": "Antigüedad",
  "hours": "Horas",
  "overallLevel": "Nivel general",
  "fitnessDash": "Panel de forma física",
  "fitness": "Mi forma",
  "changePhoto": "Cambiar foto de perfil",
  "athleteProfile": "Perfil del atleta",
  "loadingAthlete": "Cargando datos del atleta…",
  "theirLevels": "Sus niveles por deporte",
  "athleteFailed": "No se pudo cargar este atleta. Revisa tu conexión.",
  "swipeHint": "Desliza o usa las flechas para ver sus otros deportes",
  "cardioFoot": "{from} – {to} · franja = tu zona de carga segura",
  "cardioBreakdown": "Reparto por estado cardio",
  "daysN": "{n} d",
  "xpGear": "+{n} XP de material y geles (solo tus niveles)"
};

es.coach = {
  "zone": {
    "1": "Zona 1: casi sin esfuerzo, respirando por la nariz.",
    "2": "Zona 2: deberías poder ir charlando todo el rato.",
    "3": "Zona 3: constante y honesto, hablando a ratos.",
    "4": "Zona 4: umbral. Duro pero controlado, sin tirones.",
    "5": "Zona 5: corto e intenso. Recupera del todo entre series."
  },
  "intensity": {
    "easy": "Suave de verdad. Los días suaves hacen que los duros funcionen.",
    "steady": "Coge un ritmo que pudieras mantener durante horas.",
    "moderate": "Exigente pero llevadero. Fluido y relajado.",
    "threshold": "Justo en el límite: duro, pero nunca descontrolado.",
    "quality": "Calidad antes que cantidad. Clava cada serie y para.",
    "vo2": "Esfuerzos grandes, recuperaciones completas. Empieza la primera serie un pelín suave.",
    "race": "Día de carrera. Confía en el entreno y dosifica el primer tercio."
  },
  "opener": {
    "run": "Toca correr.",
    "bike": "Toca bici.",
    "swim": "Al agua.",
    "gym": "Sesión de gimnasio.",
    "brick": "Día de brick: bici y directo a correr.",
    "mobility": "Trabajo de movilidad.",
    "other": "Sesión en la pizarra."
  },
  "raceCue": {
    "run": "Sal más lento de lo que te pide el cuerpo, asiéntate en el segundo tercio y vacía el depósito en el último.",
    "bike": "Rueda con tus números, no a rueda de nadie. Come pronto y bebe a menudo.",
    "swim": "Busca agua limpia, brazada larga y orienta cada seis. Ir tranquilo es ir rápido.",
    "brick": "Nada tranquilo, rueda con cabeza, corre con orgullo. Come pronto en la bici, lo agradecerás corriendo.",
    "gym": "Calienta bien, empieza con un levantamiento que dominas y luego a por todas.",
    "other": "Dosifica el primer tercio, come pronto y acaba fuerte."
  },
  "raceOpeners": [
    "Día de carrera: {race}.",
    "Ya está aquí. {race}.",
    "{race}. Para esto has entrenado."
  ],
  "raceClosers": [
    "Cada sesión que has apuntado está hoy en tus piernas.",
    "Hoy nada nuevo: el mismo desayuno, la misma ropa, el mismo tú.",
    "Sonríe en los momentos duros. Te has ganado estar aquí."
  ],
  "race": "Carrera",
  "raceDone": "{race}: hecho. Diga lo que diga el reloj, saliste y terminaste. Orgulloso de ti.",
  "raceEve": "{race} es mañana. Prepara la ropa, come lo de siempre y acuéstate pronto. El trabajo duro ya está hecho.",
  "verified": "Verificada en Strava. Esa cuenta. Recupera bien.",
  "markedDone": "Marcada como hecha. Vincúlala en Strava para que cuente.",
  "mainSet": "{opener} Parte principal: {main}.",
  "allCleared": "Misiones completadas. Descansa, mañana a la misma hora.",
  "inARow": "{n} días seguidos. Sigue sumando.",
  "sessionVerified": "Sesión verificada. Mira lo que queda en la pizarra.",
  "restDay": "Día de descanso. Recuperar también es entrenar.",
  "streakOn": "Llevas {n} de racha. Una sesión verificada la mantiene viva.",
  "default": "Las misiones se completan cuando Strava verifica tu sesión.",
  "moment": {
    "accepted": "Misión aceptada. Nos vemos ahí fuera.",
    "questDone": "Misión completada: {text}.",
    "sportLevel": "{label}, nivel {level}. Nuevo terreno desbloqueado.",
    "accountLevel": "Nivel de cuenta {level}. Estás construyendo algo.",
    "stravaNudge": "Conecta Strava. Las sesiones verificadas son las que dan XP y completan misiones."
  }
};

es.badge = {
  "first-workout": {
    "name": "Primeros pasos",
    "desc": "Completa tu primera sesión"
  },
  "streak-3": {
    "name": "Racha en marcha",
    "desc": "Consigue una racha de 3 días"
  },
  "streak-7": {
    "name": "Guerrero semanal",
    "desc": "Consigue una racha de 7 días"
  },
  "streak-14": {
    "name": "Bestia de quincena",
    "desc": "Consigue una racha de 14 días"
  },
  "level-5": {
    "name": "Estrella en ascenso",
    "desc": "Llega al nivel 5"
  },
  "level-10": {
    "name": "Doble dígito",
    "desc": "Llega al nivel 10"
  },
  "workouts-50": {
    "name": "Medio centenar",
    "desc": "Completa 50 sesiones"
  },
  "hours-12": {
    "name": "Horas de vuelo",
    "desc": "Entrena más de 12 horas en total"
  },
  "bike-100": {
    "name": "Centenario sobre ruedas",
    "desc": "Rueda 100 km en total"
  },
  "bike-500": {
    "name": "Fondista de la bici",
    "desc": "Rueda 500 km en total"
  },
  "run-100": {
    "name": "Correcaminos",
    "desc": "Corre 100 km en total"
  },
  "swim-25": {
    "name": "Pez",
    "desc": "Nada 25 km en total"
  },
  "brick": {
    "name": "Albañil",
    "desc": "Completa una sesión brick"
  },
  "triple": {
    "name": "Triple amenaza",
    "desc": "Corre, pedalea y nada el mismo día"
  },
  "all-rounder": {
    "name": "Todoterreno",
    "desc": "Completa una sesión de correr, bici, natación y gimnasio"
  },
  "long-run-30": {
    "name": "Listo para el maratón",
    "desc": "Completa una tirada de 30 km o más"
  },
  "bike-week-200": {
    "name": "Semanón de bici",
    "desc": "Rueda 200 km de bici en una sola semana"
  }
};

es.quest = {
  "plan-done": "Termina la sesión planificada de hoy",
  "min-45": "Entrena 45+ minutos hoy",
  "two-disc": "Dos deportes en un mismo día",
  "streak": "Mantén viva la racha",
  "km-10": "Haz 10 km hoy",
  "brick": "Clava la sesión brick",
  "pack-bag": "Prepara la bolsa de mañana",
  "rest-day": "Día de descanso: tómatelo, también cuenta"
};

es.scene = {
  "coach": "Entrenador"
};

es.ex = {
  "back-squat": {
    "name": "Sentadilla trasera",
    "cues": [
      "Activa el core antes de bajar",
      "Rodillas en línea con los pies, siéntate entre las caderas",
      "Empuja el suelo: profundidad completa"
    ]
  },
  "romanian-deadlift": {
    "name": "Peso muerto rumano",
    "cues": [
      "Bisagra de cadera, rodillas algo flexionadas",
      "Barra pegada, tibias verticales",
      "Nota el estiramiento del femoral, espalda recta"
    ]
  },
  "trap-bar-deadlift": {
    "name": "Peso muerto con barra hexagonal",
    "cues": [
      "Pecho arriba, empuja el suelo",
      "Columna neutra, dorsales activos",
      "Ponte bien recto y aprieta glúteos arriba"
    ]
  },
  "bulgarian-split-squat": {
    "name": "Sentadilla búlgara",
    "cues": [
      "El peso, sobre el talón de delante",
      "Baja en vertical, tronco erguido",
      "Controla la rodilla de atrás hacia el suelo"
    ]
  },
  "step-up": {
    "name": "Subida al cajón",
    "cues": [
      "Empuja con el pie de arriba",
      "No te impulses con la pierna de atrás",
      "Controla la bajada, sin rebotes"
    ]
  },
  "standing-calf-raise": {
    "name": "Elevación de gemelos de pie",
    "cues": [
      "Recorrido completo, talones de abajo arriba",
      "Pausa arriba y aprieta",
      "Baja despacio"
    ]
  },
  "nordic-hamstring-curl": {
    "name": "Curl nórdico",
    "cues": [
      "Tobillos bien sujetos",
      "Baja lo más despacio que puedas",
      "Cadera extendida, la bisagra es la rodilla"
    ]
  },
  "copenhagen-plank": {
    "name": "Plancha Copenhague",
    "cues": [
      "Hombro justo encima del codo",
      "Aprieta el aductor de arriba",
      "Línea recta de la cabeza a la cadera"
    ]
  },
  "pull-up": {
    "name": "Dominadas",
    "cues": [
      "Empieza colgado con los brazos estirados",
      "Lleva los codos abajo y atrás",
      "Barbilla por encima de la barra, baja controlado"
    ]
  },
  "dumbbell-bench-press": {
    "name": "Press de banca con mancuernas",
    "cues": [
      "Escápulas pegadas al banco",
      "Baja a la mitad del pecho",
      "Empuja hacia arriba y un poco hacia dentro"
    ]
  },
  "seated-cable-row": {
    "name": "Remo sentado en polea",
    "cues": [
      "Pecho alto, tira hacia el ombligo",
      "Junta las escápulas",
      "No te eches atrás: quédate sobre la cadera"
    ]
  },
  "shoulder-press": {
    "name": "Press de hombro",
    "cues": [
      "Core firme, sin arquear la zona lumbar",
      "Empuja hasta estirar los brazos del todo",
      "Barra o mancuernas sobre el medio del pie"
    ]
  },
  "face-pull": {
    "name": "Face pull",
    "cues": [
      "Tira a la altura de los ojos, codos altos",
      "Rota hacia fuera al final",
      "Poco peso y tempo lento"
    ]
  },
  "pallof-press": {
    "name": "Press Pallof",
    "cues": [
      "Cadera y hombros mirando al frente",
      "Empuja recto y resiste el giro",
      "Despacio al salir, despacio al volver"
    ]
  },
  "barbell-bench-press": {
    "name": "Press de banca (barra)",
    "cues": [
      "Pies firmes, escápulas apretadas",
      "Baja a la parte baja del pecho, codos a ~45°",
      "Empuja arriba y un poco hacia atrás, sobre los hombros"
    ]
  },
  "incline-dumbbell-press": {
    "name": "Press inclinado (mancuernas)",
    "cues": [
      "Banco a 30–45°",
      "Baja a la parte alta del pecho",
      "Sube sin chocar las mancuernas"
    ]
  },
  "cable-fly-crossover": {
    "name": "Cruce de poleas",
    "cues": [
      "Codos algo flexionados y fijos",
      "Como abrazando un barril: las manos se juntan delante",
      "Vuelve despacio hasta estirar"
    ]
  },
  "dumbbell-chest-fly": {
    "name": "Aperturas (mancuernas)",
    "cues": [
      "Codos ligeramente flexionados",
      "Abre hasta estirar, sin pasar de los hombros",
      "Aprieta el pecho para cerrar"
    ]
  },
  "machine-chest-fly": {
    "name": "Aperturas (máquina)",
    "cues": [
      "Ajusta el asiento: agarres a la altura del pecho",
      "Codos sueltos, aprieta al cerrar",
      "Controla la vuelta"
    ]
  },
  "band-chest-fly": {
    "name": "Aperturas (goma)",
    "cues": [
      "Aléjate hasta que la goma esté tensa al empezar",
      "Brazos abiertos, codos algo flexionados",
      "Aprieta, pausa y vuelve despacio"
    ]
  },
  "suspension-chest-fly": {
    "name": "Aperturas (TRX)",
    "cues": [
      "Cuerpo en línea recta, como en plancha",
      "Abre los brazos despacio, codos sueltos",
      "Aprieta para subir: cuanto más inclinado, más duro"
    ]
  },
  "chest-dip": {
    "name": "Fondos en paralelas",
    "cues": [
      "Inclínate un poco hacia delante para cargar el pecho",
      "Baja hasta que los hombros queden algo por debajo de los codos",
      "Sube hasta estirar los brazos"
    ]
  },
  "assisted-chest-dip": {
    "name": "Fondos asistidos",
    "cues": [
      "Más contrapeso lo hace más fácil",
      "Inclínate hacia delante y baja controlado",
      "Sube sin rebotar en el apoyo"
    ]
  },
  "weighted-chest-dip": {
    "name": "Fondos lastrados",
    "cues": [
      "Cinturón ajustado, el peso quieto",
      "La misma profundidad que sin lastre",
      "Empuja hacia arriba sin balancearte"
    ]
  },
  "bent-over-row": {
    "name": "Remo con barra",
    "cues": [
      "Inclínate a ~45°, espalda recta",
      "Lleva la barra a las costillas bajas",
      "Baja controlado, sin balancear el tronco"
    ]
  },
  "lat-pulldown": {
    "name": "Jalón al pecho (polea)",
    "cues": [
      "Muslos bien sujetos bajo el apoyo",
      "Lleva la barra a la parte alta del pecho",
      "Codos abajo y hacia dentro, sube despacio"
    ]
  },
  "deadlift": {
    "name": "Peso muerto (barra)",
    "cues": [
      "Barra sobre el medio del pie, tibias cerca",
      "Core firme, empuja el suelo",
      "Bloquea con los glúteos, no con la zona lumbar"
    ]
  },
  "lateral-raise": {
    "name": "Elevaciones laterales (mancuernas)",
    "cues": [
      "Lleva los codos por delante",
      "Sube hasta la altura del hombro, no más",
      "Baja despacio, sin balanceo"
    ]
  },
  "arnold-press": {
    "name": "Press Arnold (mancuernas)",
    "cues": [
      "Empieza con las palmas hacia ti, a la altura de la barbilla",
      "Gira hacia fuera mientras empujas",
      "Deshaz el giro al bajar"
    ]
  },
  "dumbbell-curl": {
    "name": "Curl de bíceps (mancuernas)",
    "cues": [
      "Codos pegados al cuerpo",
      "Sube y gira el meñique hacia dentro arriba",
      "Baja del todo, despacio"
    ]
  },
  "hammer-curl": {
    "name": "Curl martillo (mancuernas)",
    "cues": [
      "Pulgares arriba, palmas enfrentadas",
      "Codos quietos, sube hasta el hombro",
      "Controla la bajada"
    ]
  },
  "bicep-curl-21s": {
    "name": "Curl 21",
    "cues": [
      "7 reps la mitad de abajo, 7 la de arriba, 7 completas",
      "Los codos se quedan pegados al cuerpo",
      "Menos peso que en tu curl normal"
    ]
  },
  "triceps-pushdown": {
    "name": "Extensión de tríceps en polea",
    "cues": [
      "Codos pegados al cuerpo",
      "Empuja hasta estirar del todo",
      "Solo se mueven los antebrazos"
    ]
  },
  "triceps-rope-pushdown": {
    "name": "Extensión de tríceps con cuerda",
    "cues": [
      "Codos pegados a las costillas",
      "Separa la cuerda abajo",
      "Controla la cuerda al subir"
    ]
  },
  "leg-press": {
    "name": "Prensa de piernas",
    "cues": [
      "Pies al ancho de hombros, en el centro de la plataforma",
      "Baja hasta que las rodillas lleguen a ~90°",
      "No bloquees las rodillas de golpe arriba"
    ]
  },
  "leg-extension": {
    "name": "Extensión de cuádriceps (máquina)",
    "cues": [
      "Rodilla alineada con el eje de la máquina",
      "Estira del todo y aprieta el cuádriceps",
      "Baja despacio"
    ]
  },
  "lying-leg-curl": {
    "name": "Curl femoral tumbado (máquina)",
    "cues": [
      "Cadera pegada al apoyo",
      "Lleva los talones hacia los glúteos",
      "Baja controlado"
    ]
  },
  "seated-leg-curl": {
    "name": "Curl femoral sentado (máquina)",
    "cues": [
      "Apoyo del muslo ajustado sobre las rodillas",
      "Lleva los talones abajo y atrás",
      "Vuelve despacio hasta estirar"
    ]
  },
  "box-squat": {
    "name": "Sentadilla al cajón (barra)",
    "cues": [
      "Siéntate atrás hacia el cajón, tibias verticales",
      "Pausa breve, sin perder la tensión",
      "Sube sin balancearte"
    ]
  },
  "barbell-bulgarian-split-squat": {
    "name": "Sentadilla búlgara (barra)",
    "cues": [
      "Barra en la espalda alta, pie de atrás en el banco",
      "Baja en vertical, tronco erguido",
      "Empuja con el talón de delante"
    ]
  },
  "box-jump": {
    "name": "Salto al cajón",
    "cues": [
      "Balancea los brazos y salta hacia arriba, no hacia delante",
      "Aterriza suave y en silencio, rodillas hacia fuera",
      "Baja andando, no saltando"
    ]
  },
  "calf-press": {
    "name": "Gemelos en prensa (máquina)",
    "cues": [
      "Metatarsos en el borde de la plataforma",
      "Estira del todo abajo",
      "Empuja bien arriba y pausa"
    ]
  },
  "calf-extension-machine": {
    "name": "Extensión de gemelos (máquina)",
    "cues": [
      "Rodillas estiradas pero sin bloquear",
      "Estira la punta en todo el recorrido",
      "Vuelve despacio"
    ]
  },
  "bird-dog": {
    "name": "Bird dog",
    "cues": [
      "Manos bajo los hombros, rodillas bajo la cadera",
      "Estira el brazo y la pierna contrarios",
      "La cadera nivelada, sin girar"
    ]
  },
  "ab-wheel": {
    "name": "Rueda abdominal",
    "cues": [
      "Pelvis metida, costillas abajo",
      "Rueda solo hasta donde mantengas la espalda recta",
      "Vuelve con el abdomen, no con la cadera"
    ]
  },
  "ab-scissors": {
    "name": "Tijeras abdominales",
    "cues": [
      "Zona lumbar pegada al suelo",
      "Piernas estiradas, cruza y cambia",
      "Patadas cortas y controladas"
    ]
  },
  "bicycle-crunch": {
    "name": "Bicicleta abdominal",
    "cues": [
      "Codo hacia la rodilla contraria",
      "Estira bien la otra pierna",
      "Gira desde las costillas, no desde el cuello"
    ]
  },
  "bicycle-crunch-raised-legs": {
    "name": "Bicicleta abdominal con piernas elevadas",
    "cues": [
      "Las piernas no tocan el suelo en ningún momento",
      "Codo hacia la rodilla contraria",
      "Mejor lento y controlado que rápido"
    ]
  },
  "burpee": {
    "name": "Burpee",
    "cues": [
      "Manos al suelo, salta los pies atrás",
      "Pecho al suelo y empuja",
      "Pies dentro y salta con los brazos arriba"
    ]
  },
  "air-bike": {
    "name": "Air bike",
    "cues": [
      "Empuja y tira de los manillares",
      "Pedalea en todo el recorrido",
      "Más esfuerzo = más resistencia del aire"
    ]
  },
  "aerobics": {
    "name": "Step",
    "cues": [
      "Sube el pie entero a la plataforma",
      "Mantén un ritmo constante",
      "Respira: ritmo de poder hablar"
    ]
  },
  "boxing": {
    "name": "Boxeo",
    "cues": [
      "Guardia arriba, barbilla abajo",
      "Golpea desde la cadera, no solo con el brazo",
      "Ligero de pies"
    ]
  }
};

es.muscle = {
  "Chest": "Pecho",
  "Back": "Espalda",
  "Shoulders": "Hombros",
  "Biceps": "Bíceps",
  "Triceps": "Tríceps",
  "Forearms": "Antebrazos",
  "Traps": "Trapecios",
  "Quads": "Cuádriceps",
  "Hamstrings": "Femorales",
  "Glutes": "Glúteos",
  "Calves": "Gemelos",
  "Adductors": "Aductores",
  "Abs": "Abdomen",
  "Full body": "Cuerpo entero",
  "Cardio": "Cardio"
};

es.equip = {
  "Barbell": "Barra",
  "Dumbbell": "Mancuernas",
  "Kettlebell": "Kettlebell",
  "Machine": "Máquina",
  "Cable": "Polea",
  "Band": "Goma",
  "Trap bar": "Barra hexagonal",
  "Bodyweight": "Peso corporal",
  "Other": "Otro"
};

es.gym = {
  "kind": {
    "warmup": "Calentamiento",
    "work": "Efectiva",
    "drop": "Drop set",
    "failure": "Al fallo"
  },
  "letter": {
    "warmup": "C",
    "drop": "D",
    "failure": "F"
  },
  "rest": "Descanso {time}",
  "restOff": "Sin descanso",
  "logged": "Apuntada",
  "restLeft": "Quedan {time} de descanso",
  "restK": "Descanso",
  "less15": "15 segundos menos",
  "more15": "15 segundos más",
  "skip": "Saltar",
  "time": "Tiempo",
  "pressStart": "pulsa Empezar cuando estés listo",
  "start": "Empezar",
  "save": "Guardar",
  "finish": "Terminar",
  "exercises": "Ejercicios",
  "noExercises": "Aún no hay ejercicios. Añade alguno o empieza desde una rutina en Ajustes.",
  "addExercises": "Añadir ejercicios",
  "saveRoutine": "Guardar como rutina",
  "menu": {
    "up": "Subir",
    "down": "Bajar",
    "link": "Superserie con el siguiente",
    "unlink": "Quitar de la superserie",
    "replace": "Cambiar ejercicio",
    "remove": "Quitar ejercicio"
  },
  "more": "Más",
  "moreAria": "{name}: más opciones",
  "colSet": "Serie",
  "colLast": "Antes",
  "colTime": "Tiempo",
  "colKg": "Kg",
  "colPlusKg": "+Kg",
  "colReps": "Reps",
  "done": "Hecha",
  "supersetAria": "Superserie {letter}: {name}",
  "superset": "Superserie {letter}",
  "historyAria": "{name}: historial y récords",
  "dragAria": "Arrastra para reordenar {name}",
  "dragTitle": "Arrastra para reordenar",
  "restBetween": "Descanso entre series",
  "note": "Nota",
  "notePh": "Una nota para este ejercicio",
  "noteAria": "Nota para {name}",
  "howTo": "Cómo se hace",
  "addSet": "Añadir serie",
  "setName": "Serie {label} ({kind})",
  "useLast": "Usar la anterior: {set}",
  "lastPrefix": "Anterior ",
  "changeType": "{name}. Cambiar el tipo o quitarla",
  "removeSet": "Quitar serie",
  "clockAria": {
    "start": "Poner en marcha el reloj de {name}",
    "stop": "Parar el reloj de {name}"
  },
  "seconds": "segundos",
  "addedKilos": "kilos añadidos",
  "kilos": "kilos",
  "reps": "repeticiones",
  "setDone": "{name} hecha",
  "setDonePR": "{name} hecha, récord personal",
  "pr": "PR",
  "sumSets": "Series",
  "sumVolume": "Volumen",
  "sumTime": "Tiempo",
  "savedEarned": "Guardado. Esta sesión te ha dado",
  "backToLog": "Volver al registro",
  "routineTitle": "Guardar como rutina",
  "routineLabel": "Nombre de la rutina",
  "routineSubmit": "Guardar rutina",
  "routineSaved": "«{name}» guardada. Empiézala desde Ajustes o con el botón +.",
  "tickFirst": "Marca antes al menos una serie efectiva.",
  "saved": "Guardado",
  "flyChip": "+1 serie",
  "replaceTitle": "Cambiar ejercicio",
  "removeConfirm": {
    "one": "¿Quitar {name}? También se borra su serie apuntada.",
    "other": "¿Quitar {name}? También se borran sus {n} series apuntadas."
  }
};

es.pose = {
  "run": [
    "Postura alta, hombros sueltos",
    "Cadencia rápida y ligera (~180 ppm)",
    "Apoya bajo la cadera"
  ],
  "bike": [
    "Pedalada redonda y fluida",
    "Agarre y hombros relajados",
    "Mantén el RPE / la FC objetivo"
  ],
  "swim": [
    "Brazada larga, codo alto en el agarre",
    "Rota desde la cadera",
    "Suelta el aire de forma continua bajo el agua"
  ],
  "mobility": [
    "Muévete lento y controlado",
    "Respira en cada postura",
    "Nunca fuerces un estiramiento"
  ],
  "fallback": [
    "Controla la fase excéntrica",
    "Recorrido completo",
    "Apunta peso + RPE"
  ]
};

es.stats = {
  "heaviest": "Más peso: {v} kg",
  "e1rm": "1RM est.: {v} kg",
  "mostReps": "Más reps: {v}",
  "longest": "Más tiempo: {v} s",
  "subE1rm": "1RM est.",
  "subHeaviest": "más peso",
  "subLongest": "más tiempo",
  "subReps": "más reps",
  "repsN": "{n} reps",
  "noSets": "No has apuntado series de gimnasio en las últimas cuatro semanas.",
  "balance": "{total} series efectivas en cuatro semanas. {muscle} se llevó más ({pct}%).",
  "noneFor": "Nada para {list}.",
  "groupsNoSets": "{n} grupos musculares sin ninguna serie.",
  "or": "ni"
};

es.split = {
  "preset": {
    "full3": "Cuerpo entero ×3",
    "upper-lower": "Torso / Pierna",
    "ppl": "Empuje / Tirón / Pierna",
    "arnold": "Rutina Arnold",
    "bro5": "Bro split ×5",
    "ppl6": "Empuje / Tirón / Pierna ×6"
  },
  "day": {
    "fullA": "Cuerpo entero A",
    "fullB": "Cuerpo entero B",
    "fullC": "Cuerpo entero C",
    "upper": "Torso",
    "lower": "Pierna",
    "push": "Empuje",
    "pull": "Tirón",
    "legs": "Pierna",
    "chestBack": "Pecho y espalda",
    "shouldersArms": "Hombros y brazos",
    "chest": "Pecho",
    "back": "Espalda",
    "shoulders": "Hombros",
    "arms": "Brazos"
  },
  "rest": "Descanso",
  "dayN": "Día {n}",
  "addDay": "Añade al menos un día de entreno.",
  "tooMany": "{gym} días de gimnasio, pero solo {days} días de entreno a la semana. El entrenador meterá lo que pueda.",
  "noGroups": "{label} aún no tiene grupos musculares.",
  "missing": "Ningún día trabaja {list}.",
  "backToBack": "{a} y {b} trabajan {list} en días seguidos."
};

es.gh = {
  "est1rm": "1RM estimado",
  "longestSet": "Serie más larga",
  "mostReps": "Más repeticiones",
  "chartAria": "De {a} el {da} a {b} el {db}",
  "exercise": "Ejercicio",
  "tE1rm": "1RM est.",
  "tHeaviest": "Más peso",
  "tMostReps": "Más reps",
  "tLongest": "Más tiempo",
  "tBest": "Mejor sesión",
  "volumeOn": "volumen · {date}",
  "historyAria": "Historial de {name}",
  "history": "Historial",
  "e1rmNote": "El 1RM estimado sale de tu mejor serie (fórmula de Epley, series de {n} repeticiones o menos); no es un levantamiento que hayas hecho.",
  "sessions": "Sesiones",
  "noTicked": "Aún no has marcado series de este ejercicio. Sus récords y su gráfica empiezan con tu primera sesión apuntada.",
  "records": "Récords",
  "recordsEmpty": "Tus mejores levantamientos aparecen aquí cuando apuntes una sesión de gimnasio.",
  "plaqueAria": "{name}: {value} {sub}. Abrir historial",
  "weeklyAria": "Series efectivas por semana: {vals}",
  "weeklyAriaM": "Series efectivas por semana de {muscle}: {vals}",
  "gym": "Gimnasio",
  "gymEmpty": "Apunta una sesión de gimnasio y aquí verás tu volumen semanal y el equilibrio muscular.",
  "gymVolume": "Volumen de gimnasio",
  "setsThisWeek": " series esta semana",
  "muscle": "Músculo",
  "allMuscles": "Todos los músculos",
  "perWeek": "Series efectivas por semana · {from} – esta semana",
  "balance": "Equilibrio muscular",
  "last4": "últimas 4 semanas"
};

es.pk = {
  "kind": {
    "weight_reps": "Peso y repeticiones",
    "bodyweight": "Repeticiones con peso corporal",
    "time": "Tiempo"
  },
  "addExercises": "Añadir ejercicios",
  "yours": " · tuyo",
  "nothing": "No hay coincidencias. Prueba con menos letras, quita un filtro o créalo.",
  "recent": "Recientes",
  "create": "Crear",
  "add": "Añadir",
  "addN": "Añadir {n}",
  "name": "Nombre",
  "equipment": "Material",
  "mainMuscle": "Músculo principal",
  "loggedAs": "Se apunta como",
  "back": "Atrás",
  "saveExercise": "Guardar ejercicio",
  "createExercise": "Crear ejercicio",
  "search": "Buscar ejercicio",
  "allEquipment": "Todo el material",
  "allMuscles": "Todos los músculos",
  "muscle": "Músculo",
  "save": "Guardar",
  "errName": "Ponle un nombre.",
  "errExists": "Ese ejercicio ya existe.",
  "routine": "Rutina"
};

es.ed = {
  "segKind": {
    "warmup": "Calentamiento",
    "work": "Trabajo",
    "rest": "Descanso / suave",
    "cooldown": "Vuelta a la calma"
  },
  "label": "Nombre",
  "min": "min",
  "removeSegment": "Quitar bloque",
  "exercise": "Ejercicio",
  "superset": "Superserie {letter}",
  "setsAria": "Series de {name}",
  "repsAria": "Repeticiones de {name}",
  "secondsAria": "Segundos de {name}",
  "sets": " series",
  "reps": "reps",
  "s": "s",
  "moveUp": "Subir {name}",
  "moveDown": "Bajar {name}",
  "drag": "Arrastra para reordenar {name}",
  "remove": "Quitar {name}",
  "item": "Cosa",
  "removeItem": "Quitar",
  "newSession": "Nueva sesión",
  "editSession": "Editar sesión",
  "startRoutine": "Empezar una rutina",
  "title": "Título",
  "titlePh": "p. ej. Tirada larga en bici Z2",
  "type": "Tipo",
  "intensity": "Intensidad",
  "date": "Fecha",
  "distance": "Distancia (km, opcional)",
  "duration": "Duración: {d}",
  "notes": "Notas / plan",
  "notesPh": "Objetivos, ritmos, recordatorios…",
  "intervals": "Estructura de series",
  "noSegments": "Sin bloques. Añade bloques de trabajo y descanso para dibujar la gráfica.",
  "addSegment": "Añadir bloque",
  "gymExercises": "Ejercicios de gimnasio",
  "noExercises": "Sin ejercicios.",
  "addExercises": "Añadir ejercicios",
  "packing": "Lista para la bolsa",
  "noItems": "Nada todavía.",
  "addItem": "Añadir",
  "delete": "Borrar",
  "duplicate": "Duplicar",
  "cancel": "Cancelar",
  "save": "Guardar",
  "newSeg": "Trabajo",
  "deleteConfirm": "¿Borrar esta sesión? No se puede deshacer.",
  "deleted": "Sesión borrada",
  "duplicated": "Sesión duplicada",
  "session": "Sesión",
  "questAccepted": "Misión aceptada",
  "saved": "Sesión guardada",
  "copy": "{title} (copia)"
};

es.ob = {
  "eco": {
    "endurance": {
      "name": "Resistencia / Triatlón",
      "sub": "Progresión en natación, bici y correr"
    },
    "hyrox": {
      "name": "HYROX",
      "sub": "Fuerza funcional híbrida + ritmo aeróbico"
    },
    "hybrid": {
      "name": "Atleta híbrido",
      "sub": "Fuerza en el gimnasio + deportes de cardio"
    },
    "gym": {
      "name": "Solo gimnasio / fuerza",
      "sub": "Pesas, rutinas divididas y acondicionamiento"
    }
  },
  "athlete": {
    "tri": {
      "name": "Triatleta",
      "sub": "Natación · bici · correr"
    },
    "run": {
      "name": "Corredor",
      "sub": "Del 5k al ultra"
    },
    "bike": {
      "name": "Ciclista",
      "sub": "Carretera, gravel y fondo"
    },
    "swim": {
      "name": "Nadador",
      "sub": "Piscina y aguas abiertas"
    }
  },
  "goal": {
    "sprint": {
      "name": "Triatlón sprint",
      "sub": "750 m nado · 20 km bici · 5 km carrera"
    },
    "olympic": {
      "name": "Triatlón olímpico",
      "sub": "1,5 km nado · 40 km bici · 10 km carrera"
    },
    "half": {
      "name": "70.3 · Medio Ironman",
      "sub": "1,9 km nado · 90 km bici · 21,1 km carrera"
    },
    "full": {
      "name": "140.6 · Ironman",
      "sub": "3,8 km nado · 180 km bici · 42,2 km carrera"
    },
    "5k": {
      "name": "5k · 10k",
      "sub": "Velocidad y umbral"
    },
    "half-mar": {
      "name": "Media maratón",
      "sub": "Construir fondo para 21,1 km"
    },
    "marathon": {
      "name": "Maratón",
      "sub": "Los 42,2 km completos"
    },
    "ultra": {
      "name": "Ultra / Trail",
      "sub": "50 km+, horas de pie"
    },
    "fondo": {
      "name": "Gran Fondo",
      "sub": "Marcha de 100–160 km"
    },
    "century": {
      "name": "Century (160 km)",
      "sub": "160 km / 100 millas"
    },
    "stage": {
      "name": "Carrera por etapas",
      "sub": "Varios días de carga seguida"
    },
    "ftp": {
      "name": "Subir el FTP",
      "sub": "Sin carrera: más potencia pura"
    },
    "ow15": {
      "name": "Aguas abiertas 1,5 km",
      "sub": "Tu primera distancia en aguas abiertas"
    },
    "ow3k": {
      "name": "Aguas abiertas 3 km+",
      "sub": "Fondo de travesía"
    },
    "meet": {
      "name": "Competición en piscina",
      "sub": "Ritmo de 100–400 m"
    },
    "fitness": {
      "name": "Forma general",
      "sub": "Técnica y base aeróbica"
    }
  },
  "gymgoal": {
    "strength": {
      "name": "Fuerza máxima",
      "sub": "Básicos pesados, pocas repeticiones"
    },
    "hypertrophy": {
      "name": "Hipertrofia / ganar músculo",
      "sub": "Rutinas guiadas por volumen"
    },
    "conditioning": {
      "name": "Acondicionamiento funcional",
      "sub": "Motor, circuitos y acarreos"
    },
    "support": {
      "name": "Resistencia y prevención de lesiones",
      "sub": "Fuerza al servicio del cardio"
    }
  },
  "hyb": {
    "Gym / Strength": "Gimnasio / fuerza",
    "Running": "Correr",
    "Cycling": "Ciclismo",
    "Swimming": "Natación"
  },
  "gen": [
    "El entrenador IA está montando tu macrociclo multideporte…",
    "Ajustando las curvas de periodización…",
    "Calculando el reparto de intensidades…",
    "Ajustando objetivos de fuerza y vatios a tus marcas…",
    "Revisando las fases de recuperación…"
  ],
  "qEco": "Elige tu tipo de entrenamiento principal:",
  "qAthlete": "¿Qué tipo de atleta de resistencia eres?",
  "qGoal": "¿Cuál es tu distancia objetivo?",
  "qHybrid": "Monta tu mezcla híbrida.",
  "hybridSub": "Elige todos los deportes que quieras en tu semana",
  "qGymGoal": "¿Cuál es tu objetivo principal en el gimnasio?",
  "qHyrox": "Tus ritmos y marcas funcionales de HYROX.",
  "runPace1k": "Ritmo actual corriendo (series de 1 km)",
  "runPacePh": "4:45 min/km",
  "sled": "Soltura con el trineo (empuje / arrastre)",
  "sledPh": "p. ej. 125 kg de empuje, constante",
  "wallball": "Umbral de wall balls (reps seguidas)",
  "wallballPh": "p. ej. 40 reps con 6 kg",
  "qRace": "¿Cuándo es tu carrera A?",
  "raceDate": "Fecha de la carrera",
  "raceName": "Nombre de la carrera",
  "raceNamePhHyrox": "HYROX Madrid",
  "raceNamePh": "Ironman 70.3 Marbella",
  "finish": "Terminar cómodo",
  "pr": "Ir a por marca / tiempo",
  "qBaselines": "Tus marcas de referencia.",
  "ftp": "FTP en bici (W)",
  "runThreshold": "Ritmo de umbral corriendo",
  "runThresholdPh": "4:30 min/km",
  "swimPace": "Ritmo a los 100 m nadando",
  "swimPacePh": "1:45 / 100 m",
  "rhr": "FC en reposo",
  "maxhr": "FC máxima",
  "optional": "opcional",
  "qWeek": "¿Cómo es tu semana de entreno?",
  "longDays": "Días preferidos para las tiradas largas",
  "restDays": "Días de descanso total",
  "capacity": "Horas de entreno a la semana",
  "perWeek": " h / semana",
  "qAnalysis": "Analizando tu perfil de atleta con Strava",
  "hSessions": "Sesiones · últimas 4 semanas",
  "hVolume": "Volumen semanal medio",
  "hBike": "Bici por semana",
  "hRun": "Correr por semana",
  "hSwim": "Natación por semana",
  "hVerified": "Verificadas por Strava",
  "gap": "Tu objetivo de <b>{target} h/semana</b> está muy por encima de tus ~{recent} h/semana recientes. El plan aplicará una progresión para prevenir lesiones: el volumen sube como mucho un 10–15% por semana desde tu base real.",
  "match": "Tu objetivo de <b>{target} h/semana</b> encaja con lo que entrenas ahora. El plan parte directamente de tu base.",
  "noHistory": "No hay historial reciente. El plan empieza con una base prudente y sube poco a poco.",
  "restDay": "Descanso",
  "moveHere": ": toca para mover {group} aquí",
  "dayName": "Nombre del día {n}",
  "removeDay": "Quitar {label}",
  "addGroup": "Añadir un grupo muscular a {label}",
  "add": "Añadir",
  "qSplit": "Monta tu rutina de gimnasio.",
  "splitSub": "Empieza con una plantilla y dale forma. Toca un músculo y luego otro día para moverlo, o arrástralo.",
  "selectedAria": "{group} seleccionado",
  "selected": "<b>{group}</b> seleccionado",
  "moveBefore": "Mover {group} al día anterior",
  "moveAfter": "Mover {group} al día siguiente",
  "remove": "Quitar",
  "trainingDay": "Día de entreno",
  "restDayBtn": "Día de descanso",
  "aria": "Configurar el entrenador IA",
  "back": "Atrás",
  "stepAnalysis": "Entrenador IA · análisis de Strava",
  "step": "Entrenador IA · paso {n} de {total}",
  "generate": "Crear mi plan",
  "continue": "Seguir",
  "genAria": "Creando el plan",
  "genSub": "Tarda unos segundos. Estamos ajustando tu plan.",
  "added": {
    "one": "El entrenador IA ha añadido {n} sesión a tu calendario",
    "other": "El entrenador IA ha añadido {n} sesiones a tu calendario"
  },
  "failed": "No se pudo crear el plan. Vuelve a intentarlo.",
  "pickEco": "Elige antes tu tipo de entrenamiento",
  "pickAthlete": "Elige antes tu deporte",
  "pickGoal": "Elige antes tu distancia objetivo",
  "pickHybrid": "Elige al menos un deporte",
  "pickGymGoal": "Elige antes tu objetivo en el gimnasio",
  "signIn": "Inicia sesión para crear un plan."
};

es.chat = {
  "chat": "Chat",
  "signInText": "Inicia sesión para añadir amigos y escribirles. Tu entreno sigue siendo privado; solo se comparte lo que envías.",
  "signIn": "Iniciar sesión",
  "loading": "Cargando tus chats…",
  "unreadN": "{n} sin leer",
  "general": "General",
  "direct": "Privados",
  "more": "Más",
  "yourUsername": "Tu nombre de usuario: {name}. Editar",
  "notSet": "sin definir",
  "setUsername": "Elige tu nombre de usuario",
  "addFriend": "Añadir amigo",
  "request": "Solicitud",
  "wantsFriends": "{handle} quiere ser tu amigo",
  "accept": "Aceptar",
  "moreFor": "Más opciones para {name}",
  "declineRequest": "Rechazar solicitud",
  "you": "Tú: ",
  "sayHello": "Saluda",
  "threadAria": "{name}",
  "threadAriaUnread": {
    "one": "{name}, {n} sin leer",
    "other": "{name}, {n} sin leer"
  },
  "requested": "Enviada",
  "waitingFor": "Esperando a {who}",
  "them": "que acepte",
  "cancelRequest": "Cancelar solicitud",
  "noFriends": "Aún no tienes amigos. Toca Añadir amigo y escribe su nombre de usuario, o abre un atleta en el Ranking.",
  "noMessages": "Aún no hay mensajes. Saluda.",
  "read": " · Leído",
  "backToChats": "Volver a los chats",
  "viewProfileOf": "Ver el perfil de {name}",
  "friend": "Amigo",
  "moreOptions": "Más opciones",
  "viewProfile": "Ver perfil",
  "removeFriend": "Quitar amigo",
  "messagePh": "Escribe a {name}",
  "message": "Mensaje",
  "send": "Enviar",
  "theirUsername": "Su nombre de usuario",
  "add": "Añadir",
  "addHint": "Escribe su nombre de usuario exacto, o toca un atleta en el Ranking y añádelo desde su perfil.",
  "usernameRule": "El nombre de usuario lleva de 3 a 20 letras, números o _",
  "nowFriendsWith": "Ya sois amigos tú y {name}",
  "requestSent": "Solicitud enviada a @{name}",
  "friendAdded": "Amigo añadido",
  "wentWrong": "Algo ha fallado",
  "removeConfirm": "¿Quitar a {name} de tus amigos? No podréis escribiros.",
  "usernamePrompt": "Tu nombre de usuario (de 3 a 20 letras, números o _). Tus amigos lo usan para encontrarte.",
  "nowAt": "Ahora eres @{name}",
  "open": "Abrir",
  "chatUnread": "Chat, {n} sin leer",
  "notifications": "Notificaciones",
  "notificationsNew": "Notificaciones, {n} nuevas",
  "friendRequests": "Solicitudes de amistad",
  "decline": "Rechazar a {name}",
  "updates": "Novedades",
  "nothingNew": "Nada nuevo. Aquí verás las solicitudes de amistad y las novedades de la app.",
  "notif": {
    "accepted": "{name} ha aceptado tu solicitud de amistad",
    "request": "{name} quiere ser tu amigo"
  },
  "btn": {
    "friends": "Mensaje",
    "incoming": "Aceptar solicitud",
    "outgoing": "Enviada",
    "none": "Añadir amigo"
  },
  "nowFriends": "Ya sois amigos",
  "requestSentShort": "Solicitud enviada"
};

es.room = {
  "athlete": "Atleta",
  "unblock": "Desbloquear a {name}",
  "report": "Denunciar mensaje",
  "block": "Bloquear a {name}",
  "removeMine": "Borrar mi mensaje",
  "removeAdmin": "Borrar (admin)",
  "more": "Más",
  "moreAria": "Más opciones para este mensaje",
  "removed": "Mensaje borrado",
  "hidden": "Mensaje oculto (has bloqueado a {name})",
  "sending": "Enviando…",
  "notSent": "No enviado.",
  "retry": "Reintentar",
  "discard": "Descartar",
  "openProfile": "{name}, abrir perfil",
  "loadingEarlier": "Cargando mensajes anteriores…",
  "start": "Aquí empieza General. Buen rollo, y que sea de entreno.",
  "empty": "Aún no hay mensajes. Saluda a todo el mundo.",
  "loading": "Cargando General…",
  "general": "General",
  "loadFailed": "No se pudo cargar General. {error}",
  "tryAgain": "Reintentar",
  "aria": "Chat General",
  "offline": "Estás sin conexión. Puedes leer; los envíos esperan a que vuelvas.",
  "ph": "Escribe a todos",
  "phAria": "Escribe a todos en General",
  "send": "Enviar",
  "whatsWrong": "¿Qué pasa? (opcional)",
  "reportNote": "El responsable de MOSKE revisa cada denuncia. Al autor no se le dice quién le ha denunciado.",
  "reportBtn": "Denunciar",
  "reported": "Denunciado. Gracias por mantener General con buen ambiente.",
  "reportFailed": "No se pudo denunciar",
  "blockConfirm": "¿Bloquear a {name}? Dejarás de ver sus mensajes. No se le avisa.",
  "blocked": "{name} está bloqueado",
  "removeConfirm": "¿Borrar este mensaje para todos?",
  "wentWrong": "Algo ha fallado",
  "roomFailed": "No se pudo cargar la sala",
  "offlineSend": "Estás sin conexión. Tendrás que volver a enviar el mensaje cuando vuelvas.",
  "slowDown": "Más despacio: como mucho 10 mensajes por minuto.",
  "slowDownShort": "Más despacio: 10 por minuto como mucho.",
  "writeFirst": "Escribe algo primero.",
  "tooLong": "Que no pase de {n} caracteres."
};

es.auth = {
  "writeError": "No se pudo guardar ese cambio en tu cuenta. Puede que vuelva a aparecer al recargar. {detail}",
  "checkConnection": "Revisa tu conexión y vuelve a intentarlo.",
  "signedInSynced": {
    "one": "Sesión iniciada · {n} sesión local sincronizada con tu cuenta",
    "other": "Sesión iniciada · {n} sesiones locales sincronizadas con tu cuenta"
  },
  "signedInSyncing": "Sesión iniciada · tus datos ya se están sincronizando",
  "setPassword": "Nueva contraseña",
  "newPassword": "Nueva contraseña",
  "confirmPassword": "Repite la nueva contraseña",
  "updatePassword": "Cambiar contraseña",
  "noMatch": "Las contraseñas no coinciden.",
  "updated": "Contraseña cambiada. Ya has iniciado sesión.",
  "updateFailed": "No se pudo cambiar la contraseña",
  "signIn": "Iniciar sesión",
  "close": "Cerrar",
  "title": "Inicia sesión para sincronizar",
  "sub": "Tu entreno, en todos tus dispositivos.",
  "email": "Correo electrónico",
  "password": "Contraseña",
  "create": "Crear cuenta",
  "forgot": "¿Has olvidado la contraseña?",
  "magic": "Envíame un enlace mágico",
  "emailFirst": "Escribe primero tu correo arriba.",
  "magicSent": "Mira tu correo: te hemos enviado el enlace mágico.",
  "magicFailed": "No se pudo enviar el enlace",
  "resetSent": "Mira tu correo: te hemos enviado un enlace para cambiar la contraseña.",
  "resetFailed": "No se pudo enviar el correo",
  "created": "Cuenta creada. Confirma tu correo y luego inicia sesión.",
  "failed": "No se pudo iniciar sesión",
  "err": {
    "invalid": "Correo o contraseña incorrectos.",
    "unconfirmed": "Confirma primero tu correo y luego inicia sesión.",
    "exists": "Ya hay una cuenta con ese correo. Inicia sesión.",
    "short": "La contraseña necesita al menos 6 caracteres."
  }
};

es.lb = {
  "daysLeft": {
    "one": "Queda <b>{n}</b> día de la temporada {s}",
    "other": "Quedan <b>{n}</b> días de la temporada {s}"
  },
  "title": "Clasificación",
  "monthly": "Temporada mensual",
  "prize": "El primero se lleva un 20% de descuento en su próximo pedido de MOSKE.",
  "season": "Temporada",
  "allTime": "Histórico",
  "loading": "Cargando la clasificación…",
  "ranks": "Ranking",
  "noSync": "La clasificación necesita la sincronización en la nube.",
  "empty": "Aún no hay nadie en la clasificación. Completa un entreno verificado para aparecer.",
  "failed": "No se pudo cargar la clasificación. Revisa tu conexión y vuelve a intentarlo.",
  "up": "Subes {n} desde tu última visita",
  "down": "Bajas {n} desde tu última visita",
  "new": "Nuevo",
  "same": "Mismo puesto que en tu última visita",
  "top3": "Los tres primeros",
  "podAria": "#{rank} {name}, {xp} XP",
  "toPass": "Te faltan <b class=\"lb-gap\">{xp} XP</b> para pasar a {name}",
  "behind": "{name} está a <b class=\"lb-gap\">{xp} XP</b> de ti",
  "rival": "Tu rival",
  "chaser": "Quien te persigue",
  "you": "Tú, #{rank}"
};

es.pp = {
  "ms": {
    "first": "Primeros pasos",
    "tenK": "Primeros 10K",
    "centurion": "Centurión",
    "half": "Medio centenar",
    "king": "Rey de la constancia",
    "beast": "Bestia de quincena"
  },
  "profile": "Perfil",
  "athlete": "Atleta",
  "rank": "Puesto #{rank} en la temporada · ",
  "level": "Nivel {n}",
  "workouts": "Entrenos",
  "distance": "Distancia",
  "streak": "Racha",
  "hours": "Horas",
  "achievements": "Logros",
  "failed": "No se pudo cargar este perfil.",
  "loading": "Cargando perfil…"
};

es.misc = {
  "week": "Camino de la semana",
  "stopLabel": "{day}: {what}",
  "restLow": "descanso",
  "nothing": "nada planificado",
  "and": " y ",
  "verified": ", verificado",
  "today": ", hoy",
  "gateAria": "{title} en {n} días",
  "daysShort": "{n}d",
  "todayLow": "hoy",
  "dShort": "{n} d",
  "weekAria": "Camino de la semana: {flags} de {planned} días verificados{ev}. Abrir el camino de la temporada",
  "weekAriaEv": ", {title} en {n} días",
  "weekN": "Semana {n}",
  "now": "Ahora",
  "sessionsVerified": "{done} de {planned} sesiones verificadas",
  "sessionsWord": " sesiones · ",
  "hPlanned": " h previstas",
  "next8": "Próximas 8 semanas",
  "seasonPath": "Camino de la temporada",
  "addRace": "Añade una carrera en Ajustes y el camino llegará hasta su meta.",
  "shop": "Tienda",
  "loadingProducts": "Cargando productos…",
  "noProducts": "Todavía no hay productos en esta colección.",
  "shopFailed": "No se pudo cargar la tienda. Revisa tu conexión y vuelve a intentarlo.",
  "shareCard": "Compartir tarjeta",
  "drawing": "Dibujando tu tarjeta…",
  "drawFailed": "No se pudo dibujar la tarjeta. Inténtalo de nuevo en un momento.",
  "shareAlt": "Tu tarjeta para compartir: {title}",
  "sharePost": "Compartir post",
  "shareStory": "Compartir historia",
  "savePost": "Guardar post",
  "saveStory": "Guardar historia",
  "sizes": "El post mide 1080 × 1350 y la historia 1080 × 1920.",
  "session": "Sesión",
  "shareText": "{title} · hecho",
  "shareFailed": "Aquí no se ha podido compartir. Prueba a guardarla.",
  "trainedWith": "ENTRENADO CON MOSKE",
  "refreshing": "Actualizando…",
  "upToDate": "Todo al día",
  "refreshFailed": "No se pudo actualizar",
  "demoAthlete": "Atleta de prueba",
  "wentWrong": "Algo ha fallado",
  "thatsYou": "Ese eres tú.",
  "noAthlete": "No hay ningún atleta llamado @{name}.",
  "friendsOnly": "Solo puedes escribir a tus amigos.",
  "signInFirst": "Inicia sesión primero",
  "syncFailed": "No se pudo sincronizar ({status})",
  "stravaActivity": "Actividad de Strava"
};

es.pace = {
  "run": {
    "easy": "~5:05–5:30 /km",
    "steady": "~5:00 /km",
    "moderate": "RM ~4:40–4:55 /km",
    "threshold": "~4:10–4:25 /km (RPE 6–7)",
    "quality": "series duras, RPE 7–8",
    "vo2": "RPE 8–9",
    "race": "ritmo de carrera"
  },
  "bike": {
    "easy": "Z2 recuperación, RPE 3",
    "steady": "Z2 de charla, RPE 3–4",
    "threshold": "2–3×12–15′, RPE 6–7",
    "quality": "RPE 7",
    "vo2": "5×3′, RPE 8–9",
    "race": "esfuerzo de carrera"
  },
  "swim": {
    "easy": "aeróbico suave",
    "steady": "técnica aeróbica"
  },
  "brick": {
    "race": "ritmo de carrera del 70.3 al bajar de la bici"
  }
};

es.sheet = {
  "back": "Atrás",
  "close": "Cerrar"
};

es.rt = {
  "exercises": {
    "one": "{n} ejercicio",
    "other": "{n} ejercicios"
  },
  "start": "Empezar",
  "delete": "Borrar la rutina {name}",
  "newRecord": "Nuevo récord",
  "event": "Evento"
};

es.ai = {
  "failed": "No se pudo crear el plan con IA.",
  "unavailable": "El entrenador IA no está disponible ahora mismo.",
  "bad": "El entrenador IA ha devuelto un plan que la app no puede leer. Vuelve a intentarlo."
};

es.xp = {
  "reason": {
    "proof": "No cuenta: vincúlala en Strava para ganar XP.",
    "manual": "No cuenta: esta actividad de Strava se metió a mano, no se grabó.",
    "sets": "No cuenta: marca al menos 3 series efectivas.",
    "timestamps": "No cuenta: hay series marcadas sin hora.",
    "tooFast": "No cuenta: las series se marcaron demasiado rápido para ser una sesión.",
    "tooLong": "No cuenta: las series se reparten en más de 4 horas.",
    "short": "No cuenta: dura menos de 10 minutos.",
    "cap": "Tope diario de gimnasio: el gimnasio apuntado en la app da como mucho 150 XP al día."
  },
  "verified": "Verificada por Strava: +10% de XP",
  "verifiedShort": "Verificada",
  "checkin": "Check-in en tu gimnasio",
  "notCounted": "No cuenta",
  "savedNot": "Guardado. Esta sesión no ha dado XP:",
  "lbChip": "{pct}%",
  "lbAria": "El {pct}% de su XP está verificado por Strava",
  "lbLegend": "El % de Strava es la parte de la XP de cada atleta verificada por Strava. El gimnasio apuntado en la app también cuenta, dentro de las reglas de XP.",
  "lbBase": "La clasificación cuenta la XP base: el material y los geles nunca cuentan aquí.",
  "baseN": "{n} base",
  "gearN": "{n} material",
  "gelN": "{n} nutrición",
  "coinsN": {
    "one": "+{n} moneda",
    "other": "+{n} monedas"
  },
  "carbsN": "+{n} g de carbohidratos"
};

es.checkin = {
  "title": "Check-in",
  "settingsLabel": "Check-in en el gimnasio",
  "stateOn": "Activado",
  "stateOff": "Desactivado",
  "what": "Al terminar una sesión de gimnasio, MOSKE puede comprobar si estás en el gimnasio que guardaste y, si es así, poner un pin en la sesión.",
  "p1": "Con la sesión solo se guarda un sí: nunca dónde estabas.",
  "p2": "La ubicación de tu gimnasio se guarda solo en este móvil. No se sincroniza ni se envía a ningún sitio.",
  "p3": "Está desactivado salvo que lo actives, y no cambia tu XP.",
  "onSaved": "Activado. Tu gimnasio está guardado en este móvil.",
  "onNoSpot": "Activado, pero aún no hay gimnasio guardado en este móvil.",
  "saveHere": "Guardar este sitio como mi gimnasio",
  "turnOff": "Desactivar y olvidar mi gimnasio",
  "turnOn": "Activar y guardar este sitio como mi gimnasio",
  "notNow": "Ahora no",
  "saved": "Gimnasio guardado. Al terminar una sesión aquí se añade el pin.",
  "noLocation": "No se pudo obtener tu ubicación. Revisa el permiso de ubicación del navegador."
};

es.gear = {
  "title": "MATERIAL",
  "item": {
    "bike-wheels": {
      "slot": "Ruedas",
      "blurb": "Unas ruedas mejores ruedan más rápido con los mismos vatios.",
      "t0": "Ruedas de serie",
      "t1": "Ruedas de aluminio",
      "t2": "Ruedas de carbono",
      "t3": "Carbono de perfil alto"
    },
    "bike-aerobars": {
      "slot": "Acoples",
      "blurb": "Agáchate y corta el viento.",
      "t0": "Sin acoples",
      "t1": "Acoples de pinza",
      "t2": "Acoples de carbono",
      "t3": "Cockpit integrado"
    },
    "bike-frame": {
      "slot": "Cuadro",
      "blurb": "Más ligero y rígido: cada pedalada cuenta.",
      "t0": "Cuadro de acero",
      "t1": "Cuadro de aluminio",
      "t2": "Cuadro de carbono",
      "t3": "Cuadro de crono de carbono"
    },
    "bike-power": {
      "slot": "Potencia",
      "blurb": "Entrena por vatios, no por sensaciones.",
      "t0": "Sin potenciómetro",
      "t1": "Potenciómetro de una biela",
      "t2": "Potenciómetro doble",
      "t3": "Potenciómetro doble y rodillo inteligente"
    },
    "swim-goggles": {
      "slot": "Gafas",
      "blurb": "Ve la línea, encuentra la boya.",
      "t0": "Gafas básicas",
      "t1": "Gafas antivaho",
      "t2": "Gafas espejadas",
      "t3": "Gafas de competición"
    },
    "swim-paddles": {
      "slot": "Palas",
      "blurb": "Más agua por brazada, más fuerza de tracción.",
      "t0": "Sin palas",
      "t1": "Palas de dedos",
      "t2": "Palas pequeñas",
      "t3": "Palas grandes"
    },
    "swim-buoy": {
      "slot": "Pull y aletas",
      "blurb": "Aísla los brazos y luego las piernas.",
      "t0": "Sin pull",
      "t1": "Pull buoy",
      "t2": "Pull y aletas",
      "t3": "Pull, aletas y tubo"
    },
    "swim-wetsuit": {
      "slot": "Neopreno",
      "blurb": "Flota más y nada más recto en aguas abiertas.",
      "t0": "Sin neopreno",
      "t1": "Neopreno sin mangas",
      "t2": "Neopreno completo",
      "t3": "Neopreno de competición"
    },
    "run-shoes": {
      "slot": "Zapatillas",
      "blurb": "La pieza de material que todo corredor nota.",
      "t0": "Zapatillas viejas",
      "t1": "Zapatillas de rodaje",
      "t2": "Zapatillas de ritmo",
      "t3": "Zapatillas de carbono"
    },
    "run-watch": {
      "slot": "Reloj",
      "blurb": "Ritmo, pulso y parciales en la muñeca.",
      "t0": "Sin reloj",
      "t1": "Reloj GPS",
      "t2": "GPS y banda de pulso",
      "t3": "Reloj multideporte"
    },
    "run-kit": {
      "slot": "Ropa",
      "blurb": "Ropa ligera que no roza en el kilómetro 30.",
      "t0": "Camiseta de algodón",
      "t1": "Ropa técnica",
      "t2": "Ropa ligera",
      "t3": "Camiseta de competición"
    },
    "run-recovery": {
      "slot": "Recuperación",
      "blurb": "Recupera antes y vuelve a correr antes.",
      "t0": "Sin material de recuperación",
      "t1": "Rodillo de espuma",
      "t2": "Pistola de masaje",
      "t3": "Botas de presoterapia"
    },
    "gym-belt": {
      "slot": "Cinturón",
      "blurb": "Más estabilidad en las series pesadas.",
      "t0": "Sin cinturón",
      "t1": "Cinturón de nailon",
      "t2": "Cinturón de cuero",
      "t3": "Cinturón de palanca"
    },
    "gym-shoes": {
      "slot": "Zapatillas",
      "blurb": "Una base estable bajo la barra.",
      "t0": "Zapatillas de correr",
      "t1": "Zapatillas planas",
      "t2": "Zapatillas de halterofilia",
      "t3": "Zapatillas de competición"
    },
    "gym-sleeves": {
      "slot": "Straps y rodilleras",
      "blurb": "Agarre y articulaciones que aguantan la sesión.",
      "t0": "Sin straps",
      "t1": "Straps",
      "t2": "Straps y rodilleras",
      "t3": "Straps, rodilleras y muñequeras"
    },
    "gym-bar": {
      "slot": "Barra",
      "blurb": "Una barra que no resbala y discos que pesan lo que dicen.",
      "t0": "Cualquier barra",
      "t1": "Magnesio",
      "t2": "Magnesio y buena barra",
      "t3": "Barra y discos calibrados"
    }
  },
  "kit": {
    "moske-navy": "MOSKE marino",
    "moske-sand": "MOSKE arena",
    "moske-crimson": "MOSKE carmesí",
    "moske-climber": "MOSKE escalador",
    "moske-pro": "MOSKE pro negro"
  },
  "signIn": "Inicia sesión para montar tu material. Las monedas salen del entrenamiento que suma XP, y tu material se guarda en tu cuenta.",
  "offline": "Estás sin conexión. Puedes mirar; para comprar hace falta conexión.",
  "disciplines": "Disciplinas",
  "disciplineBoost": "Mejora de material",
  "ofCap": "de {cap} máx.",
  "tierOf": "Nivel {n} de {of}",
  "next": "Siguiente",
  "maxed": "Nivel máximo",
  "noBoost": "Sin mejora aún",
  "needMore": "Faltan {n} monedas",
  "buyAria": "Comprar {name} por {cost} monedas, {boost} de XP en esta disciplina",
  "kitsNote": "Combinaciones de color para tu atleta. Cambian tu aspecto, no tu XP.",
  "wear": "Ponerla",
  "wearing": "Puesta",
  "honest": "El material y los geles mejoran tus propios niveles. La clasificación cuenta la XP base, igual para todos.",
  "bought": "Comprado.",
  "boughtBoost": "Montado: {boost} de XP en esta disciplina.",
  "err": {
    "not_signed_in": "Inicia sesión para usar MATERIAL.",
    "unknown_item": "Ese artículo no está en el taller.",
    "starter": "Ya tienes el material de serie.",
    "owned": "Ya lo tienes.",
    "tier_locked": "Compra antes el nivel anterior.",
    "insufficient": "Aún no tienes monedas suficientes.",
    "offline": "Estás sin conexión. Para comprar hace falta conexión.",
    "demo": "Modo demo: no se compra nada.",
    "generic": "No ha salido bien. Inténtalo de nuevo.",
    "fuel_full": "Ya llevas el máximo de eso.",
    "fuel_none": "No te queda. Compra antes.",
    "fuel_active": "Ya tienes nutrición activa.",
    "fuel_limit": "Has llegado al límite de eso esta semana."
  },
  "shop": "Tienda de material",
  "inventory": "Inventario",
  "openShop": "Abrir la tienda de material",
  "openInventory": "Abrir tu inventario",
  "tab": {
    "gear": "Material",
    "clothes": "Ropa",
    "fuel": "Nutrición"
  },
  "res": {
    "aria": "Monedas {coins}, carbohidratos {carbs} g, cada uno guarda hasta {cap}"
  },
  "needCarbs": "Faltan {n} g de carbohidratos",
  "fuelEffect": "+{pct}% de XP durante {h} h · {n} por semana",
  "fuelFull": "Puedes llevar {n}",
  "buyFuelAria": "Comprar {name} por {cost} gramos de carbohidratos",
  "buyKitAria": "Comprar {name} por {cost} monedas",
  "use": "Usar",
  "fuelWhy": {
    "active": "Ya tienes nutrición activa",
    "limit": "Agotado esta semana",
    "none": "No te queda"
  },
  "fuelOn": "{name}: +{pct}% de XP durante {h} horas",
  "fuelOnNext": "{name}: +{pct}% de XP en tu próximo entrenamiento",
  "fuelEffectNext": "+{pct}% de XP en tu próximo entrenamiento · {n} por semana",
  "nextWorkout": "Próximo entreno",
  "fuelWaitingAria": "{name} tomado: +{pct}% de XP en tu próximo entrenamiento",
  "fuelActiveAria": "{name} activo: quedan {time}, +{pct}% de XP",
  "clothesNote": "Equipación para tu atleta, con monedas. Cambia tu aspecto, no tu XP.",
  "fuelNote": "La nutrición se compra con carbohidratos, una activa a la vez. Un gel potencia tu próximo entrenamiento, cuando llegue; la comida potencia cada sesión durante unas horas.",
  "toShop": "Ir a la tienda",
  "invNoFuel": "Aún no tienes nutrición.",
  "invNoClothes": "Aún no tienes ropa.",
  "invNoGear": "Por ahora, solo el material de serie.",
  "fuel": {
    "gel": {
      "name": "Gel energético",
      "blurb": "El azul. Un chute rápido para una sesión dura."
    },
    "energy-bar": {
      "name": "Barrita energética",
      "blurb": "Avena y miel para una mañana larga."
    },
    "pasta": {
      "name": "Plato de pasta",
      "blurb": "Carga de hidratos para un gran día de entreno."
    },
    "gel-caffeine": {
      "name": "Gel con cafeína",
      "blurb": "El rojo: cafeína e hidratos para un esfuerzo más intenso."
    },
    "gel-race": {
      "name": "Gel de carrera",
      "blurb": "El dorado. Guárdalo para la sesión que importa."
    },
    "rice-cake": {
      "name": "Pastel de arroz",
      "blurb": "Arroz pegajoso envuelto en papel de aluminio, el tentempié de los pros."
    },
    "recovery-shake": {
      "name": "Batido de recuperación",
      "blurb": "Proteína e hidratos para volver más fuerte mañana."
    }
  }
};

// feats (js/core/feats.js, docs/FEATS.md)
es.feat = {
  "run-10k": {
    "name": "10 km corriendo",
    "blurb": "Diez kilómetros del tirón."
  },
  "run-5k-25": {
    "name": "5 km en menos de 25",
    "blurb": "Cinco kilómetros en 25:00 o menos."
  },
  "run-5k-22": {
    "name": "5 km en menos de 22",
    "blurb": "Cinco kilómetros en 22:00 o menos."
  },
  "run-5k-20": {
    "name": "5 km sub-20",
    "blurb": "Cinco kilómetros por debajo de 20 minutos. La que todos persiguen."
  },
  "run-10k-50": {
    "name": "10 km en menos de 50",
    "blurb": "Diez kilómetros en 50:00 o menos."
  },
  "run-10k-45": {
    "name": "10 km en menos de 45",
    "blurb": "Diez kilómetros en 45:00 o menos."
  },
  "run-half": {
    "name": "Media maratón",
    "blurb": "21,1 km en una sola carrera."
  },
  "run-30k": {
    "name": "30 km corriendo",
    "blurb": "Treinta kilómetros en una sola carrera."
  },
  "run-marathon": {
    "name": "Maratón",
    "blurb": "42,2 km en una sola carrera."
  },
  "run-month-50": {
    "name": "Mes de 50 km",
    "blurb": "Cincuenta kilómetros corriendo en un mes natural."
  },
  "run-month-100": {
    "name": "Mes de 100 km",
    "blurb": "Cien kilómetros corriendo en un mes natural."
  },
  "bike-50": {
    "name": "Salida de 50 km",
    "blurb": "Cincuenta kilómetros en una salida."
  },
  "bike-100": {
    "name": "Centenaria",
    "blurb": "Cien kilómetros en una salida."
  },
  "bike-160": {
    "name": "Gran fondo",
    "blurb": "160 km en una salida."
  },
  "bike-climb-2000": {
    "name": "Día de 2.000 m",
    "blurb": "Dos mil metros de desnivel en una salida."
  },
  "bike-40kph": {
    "name": "A 40 por hora",
    "blurb": "Veinte kilómetros o más a 40 km/h de media en movimiento."
  },
  "bike-hc": {
    "name": "Fuera de categoría",
    "blurb": "Un puerto HC entero de un tirón."
  },
  "bike-month-200": {
    "name": "Mes de 200 km",
    "blurb": "Doscientos kilómetros en bici en un mes natural."
  },
  "bike-month-500": {
    "name": "Mes de 500 km",
    "blurb": "Quinientos kilómetros en bici en un mes natural."
  },
  "swim-1k": {
    "name": "1 km nadando",
    "blurb": "Un kilómetro en un solo entreno de natación."
  },
  "swim-1k-steady": {
    "name": "Kilómetro seguido",
    "blurb": "Un kilómetro casi sin pararte en la pared."
  },
  "swim-2k": {
    "name": "2 km nadando",
    "blurb": "Dos kilómetros en un solo entreno."
  },
  "swim-1k-145": {
    "name": "Ritmo 1:45",
    "blurb": "Un kilómetro o más a 1:45 los 100 m."
  },
  "swim-month-10": {
    "name": "Mes de 10 km",
    "blurb": "Diez kilómetros nadando en un mes natural."
  },
  "gym-25": {
    "name": "25 sesiones",
    "blurb": "Veinticinco sesiones de gimnasio que dieron XP."
  },
  "gym-100": {
    "name": "100 sesiones",
    "blurb": "Cien sesiones de gimnasio que dieron XP."
  },
  "gym-bench-1": {
    "name": "Press con tu peso",
    "blurb": "Press de banca con tu peso corporal, de 1 a 5 repeticiones."
  },
  "gym-squat-15": {
    "name": "Sentadilla 1,5×",
    "blurb": "Sentadilla con vez y media tu peso corporal."
  },
  "gym-dead-2": {
    "name": "Peso muerto doble",
    "blurb": "Peso muerto con el doble de tu peso corporal."
  },
  "cross-four-weeks": {
    "name": "Cuatro de cuatro",
    "blurb": "Correr, bici, nadar y gimnasio todas las semanas durante cuatro semanas."
  },
  "cross-olympic-day": {
    "name": "Día olímpico",
    "blurb": "Nadar 1,5 km, 40 km en bici y correr 10 km el mismo día."
  },
  "cross-iron-day": {
    "name": "Día Ironman",
    "blurb": "Nadar 3,8 km, 180 km en bici y correr 42,2 km el mismo día."
  },
  "cross-race": {
    "name": "Día de carrera",
    "blurb": "Una carrera de verdad, planificada y marcada como carrera en Strava."
  }
};

es.feat.ui = {
  "title": "Trofeos",
  "sports": "Deportes",
  "sport": {
    "bike": "Bici",
    "swim": "Nadar",
    "run": "Correr",
    "gym": "Gym",
    "cross": "Combinado"
  },
  "boardAria": "Tablón de trofeos: {n} de {total} logros. Abrir la vitrina",
  "ofWon": "de {total} conseguidos",
  "check": "Comprobar",
  "signedOut": "Sin sesión iniciada: esto es lo que ganarían tus entrenos. Inicia sesión y el servidor te los da.",
  "honest": "Solo cuentan los entrenos grabados en Strava, nunca metidos a mano ni en máquina (pesas: registradas en la app, con el check-in del gimnasio). Los números imposibles se ignoran sin más.",
  "km": "{n} km",
  "m": "{n} m",
  "kmh": "{n} km/h",
  "rest": "{n}% de descanso",
  "per100": "{t} /100 m",
  "kg": "{n} kg",
  "sessions": "{n} sesiones",
  "weeks": "{n} semanas",
  "reward": "Desbloquea: {item}",
  "rewardTrio": "Con los otros dos levantamientos: {item}",
  "logged": "Registrado",
  "strava": "Strava",
  "whole": "actividad completa",
  "session": "Ver el entreno",
  "nearAria": "Tu mejor marca {best}, objetivo {target}",
  "best": "Tu mejor marca: {best} · objetivo {target}",
  "notYet": "Todavía no hay ningún entreno que cuente.",
  "needsTitle": "Para los logros de fuerza",
  "bodyweight": "Peso corporal (kg)",
  "saveWeight": "Guardar",
  "weightLogged": "Último registro: {date}. Cada levantamiento se compara con el peso más alto que registraste en los 30 días anteriores.",
  "weightWhy": "Registra tu peso: cada levantamiento se compara con el peso más alto que registraste en los 30 días anteriores.",
  "weightSaved": "Peso guardado: {kg} kg",
  "checkinOn": "El check-in del gimnasio está activado: los entrenos en tu gimnasio llevan el pin.",
  "checkinOff": "Los logros de fuerza necesitan el pin del check-in del gimnasio.",
  "checkinTurnOn": "Activarlo",
  "won": "Logro conseguido",
  "itemsTitle": "Se ganan, no se compran",
  "itemsNote": "No se pueden comprar. Cada uno sale de un logro, con los colores de la temporada en que lo consigues, y esos colores no vuelven.",
  "itemHow": "Cómo se gana:",
  "itemWon": "Ganado, con los colores de esa temporada",
  "itemOwned": "Tuyo",
  "itemLocked": "Se gana, nunca se compra",
  "itemLockedLogged": "Se gana con pesas registradas"
};
es.featItem = {
  "kit-run-sub20": "Equipación sub-20 de carrera",
  "kit-gran-fondo": "Equipación ciclista Gran Fondo",
  "kit-iron": "Equipación Iron",
  "trisuit-limited": "Trimono edición limitada",
  "singlet-lifting": "Maillot de halterofilia",
  "shirt-finisher": "Camiseta de finisher",
  "cap-run": "Gorra de carrera MOSKE",
  "cap-climber": "Gorra de escalador",
  "cap-training": "Gorra de entreno MOSKE",
  "frame-olympic": "Marco olímpico",
  "frame-race": "Marco de dorsal"
};

// challenges (js/core/challenges.js, docs/CHALLENGES.md)
es.ch = {
  "rule": {
    "distance": "Más kilómetros {sport}",
    "xp": "Más XP base {sport}",
    "sessions": "Más días {sport}",
    "fastest": "El {dist} más rápido ({sport})",
    "longest": "El entreno {sport} más largo, hasta {target}",
    "climb": "Más metros de desnivel {sport}",
    "segment": "El más rápido en el segmento {segment}"
  },
  "sportWord": {
    "any": "entrenando",
    "run": "corriendo",
    "bike": "en bici",
    "swim": "nadando"
  },
  "dist": {
    "5k": "5 km",
    "10k": "10 km",
    "half": "media maratón",
    "20k": "20 km",
    "40k": "40 km",
    "1k": "1 km"
  },
  "minutes": "{n} min",
  "payWinner": "el ganador se lo lleva todo",
  "payPlaces": "premio a los primeros {split}",
  "ruleLine": "{what}, {when}, solo Strava · {pay}"
};

// the challenge screens (js/app/challenges-view.js)
es.chx = {
  "title": "Retos",
  "new": "Nuevo reto",
  "newAria": "Publicar un reto",
  "you": "Tú",
  "athlete": "Atleta",
  "signIn": "Inicia sesión para retar a otros atletas.",
  "loading": "Cargando…",
  "none": "Aún no hay retos. Publica el primero.",
  "honest": "Solo monedas, nunca se compran ni se cobran. Solo cuentan entrenos grabados en Strava, nunca en un día de descanso planificado, nunca gimnasio.",
  "sec": {
    "invites": "Retos para ti",
    "live": "Abiertos y en marcha",
    "done": "Terminados"
  },
  "gone": "Este reto ya no está disponible.",
  "kind": {
    "distance": "Más distancia",
    "xp": "Más XP",
    "sessions": "Más entrenos",
    "fastest": "El más rápido",
    "longest": "El entreno más largo",
    "climb": "Más desnivel",
    "segment": "Rey del segmento"
  },
  "sport": {
    "any": "Cualquiera (correr, bici, nadar)",
    "run": "Carrera",
    "bike": "Ciclismo",
    "swim": "Natación"
  },
  "phase": {
    "open": "Abierto",
    "running": "En marcha",
    "resolving": "Resolviéndose",
    "settled": "Resuelto",
    "cancelled": "Cancelado"
  },
  "cardAria": "Reto: {rule}. Abrirlo",
  "stake": "Apuesta",
  "pot": "Bote",
  "free": "Gratis, sin apuesta",
  "inN": "{n} de {max} dentro",
  "youreIn": "Estás dentro",
  "full": "Completo",
  "joinFor": "Entrar · {n} monedas",
  "joinFree": "Entrar",
  "settled": "Resuelto",
  "wonCoins": "Ganaste {n} monedas",
  "toast": {
    "won": "Cerrado: quedaste {place}.º de {of} y ganaste {n} monedas.",
    "placed": "Cerrado: quedaste {place}.º de {of}. Tu apuesta fue al bote.",
    "noShow": "Cerrado: ninguna sesión tuya contó, así que tu apuesta fue al bote.",
    "void": "Nadie tuvo una sesión que contara. Se devolvieron todas las apuestas.",
    "cancelled": "Se canceló antes de empezar. Se te devolvió la apuesta."
  },
  "trophyBy": "{name} ganó un trofeo en este reto",
  "noShow": "sin entreno",
  "xp": "{n} XP",
  "days": {
    "one": "{n} día",
    "other": "{n} días"
  },
  "result": "Resultado",
  "void": "Anulado: nadie entrenó, todas las apuestas se devolvieron",
  "potLine": "Bote {pot} · comisión {fee} (se quema) · premio {prize} · {burned} quemadas en total",
  "cancelled": "Cancelado por quien lo creó. Todas las apuestas se devolvieron enteras.",
  "cancelledFew": "Cancelado: menos de dos personas entraron antes del inicio. Todas las apuestas se devolvieron enteras.",
  "standings": "Clasificación",
  "cut": "tope alcanzado",
  "lowerWins": "Gana el más bajo",
  "higherWins": "Gana el más alto",
  "endsOn": "termina el {date}",
  "settlesOn": "se resuelve el {date} (los entrenos que Strava sincronice tarde cuentan)",
  "when": "Cuándo",
  "who": {
    "room": "Cualquiera en General",
    "direct": "Amigos que elijo"
  },
  "whoIn": "Quién está",
  "howItWorks": "Cómo funciona",
  "term": {
    "strava": "Solo cuentan entrenos grabados en Strava: nunca metidos a mano, nunca en un día de descanso planificado, nunca gimnasio.",
    "noShow": "Si no tienes ningún entreno válido en el plazo, pierdes tu apuesta, que va al bote.",
    "ties": "Los empates comparten los puestos que ocupan. Los puestos con premio que nadie alcanza se reparten entre los demás.",
    "fee": "El {fee}% del bote es la comisión y desaparece.",
    "cap": "Lo que ganas cuenta como ingreso: si tu almacén de 10.000 monedas está lleno, el resto se pierde.",
    "refuse": "Puedes rechazar cualquier reto, o salirte antes de que empiece y recuperar tu apuesta. No cuesta nada."
  },
  "cancel": "Cancelar el reto",
  "cancelConfirm": "¿Cancelar este reto? Todas las apuestas se devuelven enteras.",
  "cancelledToast": "Reto cancelado. Todas las apuestas se devolvieron.",
  "leave": "Salir",
  "leaveRefund": "Salir y recuperar mi apuesta",
  "decline": "Rechazar",
  "left": "Hecho. No perdiste nada.",
  "joinTitle": "Entrar en este reto",
  "sure": "Apuesto {n} monedas y he leído cómo funciona",
  "notNow": "Ahora no",
  "stakeN": "Apostar {n} monedas",
  "joined": "Estás dentro. ¡A por ello!",
  "suggestions": "Sugerencias",
  "custom": "O créalo a tu manera",
  "tpl": {
    "weekend-long": "Salida larga del finde",
    "fast-5k": "El 5 km más rápido",
    "km-week": "Semana de kilómetros",
    "consistent": "El más constante",
    "xp-sprint": "Sprint de XP",
    "climb-month": "Desnivel del mes",
    "segment-king": "Rey del segmento"
  },
  "f": {
    "kind": "Reto",
    "sport": "Deporte",
    "dist": "Distancia",
    "target": "Cuenta hasta (minutos, máx. {max})",
    "segment": "Enlace al segmento de Strava",
    "segmentName": "Nombre del segmento (opcional)",
    "segmentPh": "strava.com/segments/123456…",
    "start": "Empieza",
    "days": "Días (1–28)",
    "stake": "Apuesta en monedas (0–{max})",
    "payout": "Premios",
    "who": "Quién puede entrar",
    "friends": "Invita a hasta {n} amigos"
  },
  "payout": {
    "winner": "El ganador se lo lleva todo",
    "top2": "1.º 65% · 2.º 35%",
    "top3": "1.º 50% · 2.º 30% · 3.º 20%"
  },
  "noFriends": "Primero añade amigos (en Ranking o Chat).",
  "stakeNote": "Todo el que entra apuesta {n} monedas. El {fee}% del bote se quema como comisión.",
  "post": "Publicar el reto",
  "postStake": "Publicar y apostar {n} monedas",
  "posted": "Reto publicado en General",
  "sent": "Reto enviado",
  "directSetting": "Dejar que mis amigos me reten directamente",
  "directSettingNote": "Desactivado: nadie puede enviarte un reto. Puedes seguir entrando en los de General.",
  "err": {
    "not_signed_in": "Inicia sesión primero.",
    "offline": "Estás sin conexión. Los retos la necesitan.",
    "generic": "Algo ha fallado. Inténtalo otra vez.",
    "kind": "Elige un tipo de reto.",
    "sport": "Ese deporte no admite este tipo de reto (y el gimnasio nunca entra).",
    "window": "Un reto dura de 1 a 28 días.",
    "start": "Tiene que empezar mañana o después, como mucho dentro de 14 días.",
    "stake": "La apuesta va de 0 a 150 monedas.",
    "payout": "Elige cómo se reparten los premios.",
    "dist": "Elige una distancia.",
    "target": "Pon un objetivo que el deporte permita.",
    "segment": "Pega el enlace de un segmento de Strava.",
    "invitees": "Invita de 1 a 4 amigos.",
    "no_direct": "Uno de ellos no acepta retos directos.",
    "open_max": "Ya tienes 2 retos abiertos.",
    "room_day": "Hoy ya has publicado 3 retos. Prueba mañana.",
    "room_full": "General ya tiene 6 retos abiertos.",
    "full": "Este reto está completo.",
    "closed": "Ya ha empezado: no se puede entrar.",
    "joined": "Ya estás dentro.",
    "not_invited": "Este reto es solo para amigos invitados.",
    "not_found": "Este reto ya no está disponible.",
    "creator": "Lo creaste tú: cancélalo.",
    "not_yours": "Solo quien lo creó puede cancelarlo.",
    "age": "Las apuestas se abren 14 días después de registrarte.",
    "verified": "Para apostar necesitas 6 entrenos de Strava en los últimos 30 días.",
    "balance": "No tienes monedas suficientes.",
    "share": "Eso es más de la mitad de tus monedas.",
    "week": "Con esto pasarías de 300 monedas apostadas esta semana.",
    "pair": "Esta semana ya apostaste contra alguno de ellos (o tres veces este mes)."
  }
};

// ---- the long loop: workshop, base, props (docs/LOOP.md) ----
es.gear.tab["base"] = "Base";
es.gear.err["in_workshop"] = "Eso ya está en el taller.";
es.gear.err["has_next"] = "Saca antes de la cola el nivel de encima.";
es.gear.err["no_job"] = "Ese trabajo no está en tu taller.";
es.gear.err["job_done"] = "Ese trabajo ya ha terminado.";
es.gear.err["not_fitting"] = "Un gel solo termina el trabajo que se está montando ahora.";
es.loop = {
  "ws": {
    "title": "Taller",
    "bays": {
      "one": "{n} puesto",
      "other": "{n} puestos"
    },
    "bay": "Puesto {n}",
    "free": "Libre. Lo próximo que compres empieza aquí al momento.",
    "leftWord": "restantes",
    "skip": "Terminar con un gel",
    "cancel": "Cancelar",
    "remove": "Quitar",
    "removeAria": "Quitar {name} de la cola",
    "needGel": "Un gel termina el trabajo ya. No llevas ninguno.",
    "queue": "Esperando puesto",
    "startsAt": "Empieza a las {time} · puesto {bay}",
    "fittedAt": "Montado a las {time}",
    "rules": "Quitar un trabajo que no ha empezado es gratis. Cancelar a medio montar te lo devuelve todo la primera vez; después, el {pct} %.",
    "fittingCard": "En el taller:",
    "queuedCard": "En cola: empieza a las {time}",
    "fitsIn": "Se monta en {time}",
    "h": "{h} h",
    "min": "{m} min",
    "hMin": "{h} h {m} min",
    "startedToast": "Ya en el puesto. Listo a las {time}.",
    "queuedToast": "En cola: empieza a las {start}, listo a las {time}.",
    "cancelFull": "¿Dejar de montarlo? Recuperas las {n} monedas.",
    "cancelPart": "¿Dejar de montarlo? Recuperas {n} de las {cost} monedas.",
    "cancelled": "Fuera del taller. Te devolvemos {n} monedas.",
    "fitted": "Montado",
    "fittedToast": "Listo en el taller",
    "readyN": {
      "one": "{n} cosa lista",
      "other": "{n} cosas listas"
    }
  },
  "quad": {
    "bike": "Velódromo",
    "run": "Pista",
    "swim": "Piscina",
    "gym": "Sala",
    "lv": "NV {n}",
    "aria": "{name}, nivel {n}. Ver lo que puedes construir aquí",
    "toNext": {
      "one": "{n} punto de obra para el nivel {lv}",
      "other": "{n} puntos de obra para el nivel {lv}"
    },
    "top": "Completo",
    "note": "Este nivel sube con lo que construyes aquí, no con la XP. Un mes tranquilo no le quita nada."
  },
  "prop": {
    "built": "Construido",
    "points": {
      "one": "+{n} punto de obra",
      "other": "+{n} puntos de obra"
    },
    "buyAria": "Construir {name} por {cost} monedas",
    "glows": "Se enciende al anochecer"
  }
};
es.prop = {
  "bike-rack": {
    "name": "Aparcabicis",
    "blurb": "Un sitio para las bicis que no sea el suelo."
  },
  "bike-stand": {
    "name": "Soporte de taller",
    "blurb": "Sujeta el cuadro para que el mecánico deje de arrodillarse."
  },
  "bike-tent": {
    "name": "Carpa de equipo",
    "blurb": "Sombra, una silla plegable y ambiente de carrera."
  },
  "bike-lights": {
    "name": "Focos",
    "blurb": "El patio sigue abierto de noche."
  },
  "run-water": {
    "name": "Avituallamiento",
    "blurb": "Vasos en una mesa, como en las carreras."
  },
  "run-gate": {
    "name": "Arco de cronometraje",
    "blurb": "Cada vuelta que pasa por debajo tiene tiempo."
  },
  "run-stand": {
    "name": "Grada",
    "blurb": "Tres filas de asientos y siempre alguien mirando."
  },
  "run-lights": {
    "name": "Focos de pista",
    "blurb": "Series al atardecer, con luz."
  },
  "swim-reel": {
    "name": "Carrete de corcheras",
    "blurb": "Corcheras puestas para las series serias."
  },
  "swim-clock": {
    "name": "Reloj de ritmo",
    "blurb": "La aguja grande que tiene toda piscina de club."
  },
  "swim-stand": {
    "name": "Grada de piscina",
    "blurb": "Asientos para el trofeo que organizarás algún día."
  },
  "gym-chalk": {
    "name": "Cuenco de magnesio",
    "blurb": "Agarre para los días pesados."
  },
  "gym-sound": {
    "name": "Equipo de música",
    "blurb": "Tu lista, a buen volumen."
  }
};

// ---- el ciclo largo, fases 3 y 4: base, colecciones, planos, prestigio (docs/LOOP.md) ----
es.gear.err["fragments_short"] = "Aún no tienes fragmentos suficientes para esa pieza.";
es.gear.err["prestige_level"] = "Esa disciplina aún no tiene el nivel para una estrella.";
es.gear.err["prestige_max"] = "Esa disciplina ya tiene todas las estrellas.";
es.loop.base = {
  "title": "Tu base",
  "islandAria": "Tus cuatro zonas",
  "quadAria": "{sport}: {quad} nivel {q}, nivel de deporte {n}, {won} de {total} logros. Entrar",
  "buildingAria": "Construyendo {name}",
  "lvl": "NV {n}",
  "hint": "Toca una zona para entrar.",
  "back": "Volver a tu base",
  "next": "Lo siguiente",
  "building": "En el taller",
  "workshopFree": "No hay nada en marcha. El taller está libre.",
  "more": {
    "one": "+{n} más",
    "other": "+{n} más"
  },
  "afford": "Monedas",
  "canBuy": {
    "one": "{n} cosa que puedes construir ya",
    "other": "{n} cosas que puedes construir ya"
  },
  "short": "{name}: te faltan {n} monedas",
  "feat": "El logro más cerca"
};
es.loop.col = {
  "title": "Colecciones",
  "note": "Todas las piezas de una disciplina en un nivel completan ese juego: un premio único en monedas y una placa en su tablón.",
  "bronze": "Juego de bronce",
  "silver": "Juego de plata",
  "gold": "Juego de oro",
  "aria": "{set}: {n} de {of} piezas",
  "bonus": "Premio al completarlo: {n} monedas",
  "paid": "{n} monedas cobradas · {date}",
  "boardAria": {
    "one": "{n} placa de juego",
    "other": "{n} placas de juego"
  }
};
es.loop.bp = {
  "title": "Planos",
  "note": "Cada misión que completas vale {n} fragmento. Elige una pieza rara como objetivo; cuando tengas suficientes, constrúyela. Nada es al azar.",
  "have": "Fragmentos: {n}",
  "price": {
    "one": "{n} fragmento",
    "other": "{n} fragmentos"
  },
  "aim": "Ir a por esta",
  "aiming": "tu objetivo",
  "progress": "{n} de {of} fragmentos",
  "left": "Faltan {n}",
  "ready": "Lista para construir",
  "pickOne": "Elige una pieza rara como objetivo",
  "build": "Construir",
  "builtToast": "Construida con su plano. Ya está en tu escena."
};
es.loop.prestige = {
  "title": "Prestigio",
  "starsAria": {
    "one": "{n} estrella de prestigio",
    "other": "{n} estrellas de prestigio"
  },
  "what": "Opcional. Vuelve {sport} al nivel 1 a cambio de una estrella en su tablón y un +{pct}% en cada sesión de {sport} a partir de entonces. Puedes hacerlo en el nivel {lv}.",
  "keeps": "Tu escenario, equipo, objetos, logros, monedas y Ranking quedan exactamente igual. Si nunca lo haces, no cambia nada.",
  "button": "Reiniciar {sport} por una estrella",
  "confirm": "¿Volver {sport} al nivel 1? Conservas tu escenario, equipo, logros y Ranking, y ganas una estrella y un +{pct}% en las sesiones de {sport} desde ahora. No se puede deshacer.",
  "done": "{sport}: una estrella nueva en el tablón.",
  "next": "Tu próxima estrella será posible en el nivel {lv}. Estás en el nivel {n}.",
  "max": "Todas las estrellas conseguidas."
};
es.prop["bike-podium"] = { "name": "Podio de oro", "blurb": "Tres escalones, el de arriba dorado. Construido con su plano." };
es.prop["run-statue"] = { "name": "Estatua del corredor", "blurb": "Un corredor dorado en plena zancada junto a la pista. Construida con su plano." };
es.prop["swim-blocks"] = { "name": "Poyete de oro", "blurb": "El poyete de salida de las finales. Construido con su plano." };
es.prop["gym-cabinet"] = { "name": "Vitrina de trofeos", "blurb": "Puertas de cristal, tiradores dorados y sitio para más. Construida con su plano." };

// ---- el complejo unificado (docs/COMPOUND.md) ----
es.cp = {
  "lvl": "Nivel {n}",
  "coinsAria": "{n} monedas",
  "carbsAria": "{n} g de carbohidratos",
  "staminaAria": "Energía {n} de {max}. Se recarga sola, un punto por minuto",
  "roomsAria": "Salas",
  "nav": { "bike": "Ciclismo", "pool": "Natación", "run": "Carrera", "gym": "Gimnasio", "locker": "Vestuario y recuperación" },
  "room": { "gym": "Gimnasio", "pool": "Piscina", "bike": "Sala de bici", "run": "Sala de carrera", "locker": "Vestuario" },
  "item": { "coffee-machine": "Cafetera", "smart-bike": "Tu bici", "smart-trainer": "Rodillo inteligente" },
  "roledesc": "editor de la base",
  "vpAria": "Tu base. Arrastra para moverte, pellizca o usa los botones para hacer zoom. Toca un objeto para cogerlo.",
  "roomAlt": "{room}, nivel {n}",
  "roomAria": "{room}, nivel {n}, nivel de obra {q}. Abrir sus niveles",
  "lockerAria": "Vestuario, nivel {n}. Abrir tu inventario",
  "itemAria": "{name} en {room}. Tócalo para cogerlo",
  "itemSelAria": "{name}, cogido. Arrástralo, usa las flechas o las teclas de flecha; Escape para soltarlo",
  "selHint": "{name}: arrástralo o toca una flecha",
  "placed": "{name} movido a {room}",
  "why": {
    "bounds": "No puede atravesar una pared.",
    "blocked": "Ahí no: es agua.",
    "occupied": "Ya hay algo ahí."
  },
  "nudge": { "+u": "Mover una casilla a la derecha", "-u": "Mover una casilla a la izquierda", "+v": "Mover una casilla hacia delante", "-v": "Mover una casilla hacia atrás" },
  "needOne": "Deja al menos una sala."
};

// ---- misiones semanales, temporadas y el puesto (docs/LOOP.md §5) ----
es.gear.tab["stall"] = "Puesto";
es.gear.err["stall_gone"] = "Eso ya no está en el puesto: cambió a medianoche (UTC).";
es.gear.err["stall_only"] = "Eso solo se vende en el puesto del día.";
es.gear.err["mission_week"] = "Las misiones de esa semana ya no se pueden cobrar.";
es.gear.err["mission_unknown"] = "Esa misión no está en el tablón de esta semana.";
es.gear.err["mission_not_done"] = "Esa misión aún no está completa.";
Object.assign(es.cp.item, {
  "mission-board-bike": "Tablón de misiones", "mission-board-pool": "Tablón de misiones", "mission-board-run": "Tablón de misiones",
  "mission-board-gym": "Tablón de misiones", "mission-board-locker": "Tablón de misiones",
  "decor-plant": "Costilla de Adán", "decor-cooler": "Fuente de agua", "decor-bench": "Banco de vestuario", "decor-roller": "Estante de rulos",
  "decor-punchbag": "Saco de boxeo", "decor-shelf": "Estante de trofeos", "decor-towels": "Toallero", "decor-rug": "Alfombra del rayo"
});
es.mission = {
  "w-sessions-3": { "name": "Tres sesiones", "blurb": "Completa {n} sesiones verificadas esta semana." },
  "w-hours-4": { "name": "Cuatro horas", "blurb": "Entrena 4 horas esta semana, solo sesiones verificadas." },
  "w-km-40": { "name": "Cuarenta kilómetros", "blurb": "Haz {n} km esta semana corriendo, en bici o nadando." },
  "w-two-sports": { "name": "Dos deportes", "blurb": "Entrena {n} deportes distintos esta semana." },
  "w-long-90": { "name": "Una larga", "blurb": "Completa una sesión de 90 minutos o más." },
  "w-days-3": { "name": "Tres días", "blurb": "Entrena {n} días distintos esta semana." },
  "w-rest-2": { "name": "Dos días libres", "blurb": "Descansa {n} días completos esta semana. Un día cuenta cuando ha terminado." },
  "w-rest-1": { "name": "Un día libre", "blurb": "Descansa un día completo esta semana. Cuenta cuando ha terminado." },
  "w-recovery": { "name": "Sesión suave", "blurb": "Una sesión tranquila de 20 a 40 minutos. La recuperación cuenta." },
  "ui": {
    "title": "Tablón de misiones",
    "open": "Tablón de misiones",
    "thisWeek": "Esta semana",
    "nextWeek": "El tablón de la semana que viene",
    "daysLeft": { "one": "último día", "other": "quedan {n} días" },
    "training": "Entreno",
    "rest": "Descanso y recuperación",
    "restSame": "Las misiones de descanso y recuperación pagan exactamente lo mismo que las de entreno.",
    "count": "{n} de {of}",
    "hours": "{n} h de {of} h",
    "km": "{n} de {of} km",
    "rewardAria": "Paga {coins} monedas y {carbs} g de carbohidratos",
    "paid": "Cobrada",
    "paying": "Hecha",
    "paidToast": { "one": "Misión semanal cobrada", "other": "{n} misiones semanales cobradas" },
    "doneOf": "{n} de {of} misiones hechas"
  }
};
es.season = {
  "label": "Temporada · {year}",
  "name": { "almendro": "Almendro en flor", "alisio": "Alisios", "calima": "Calima", "mar-de-nubes": "Mar de nubes" },
  "daysLeft": { "one": "Último día de la temporada", "other": "Quedan {n} días de temporada" },
  "stat": { "sessions": "sesiones", "hours": "horas", "km": "km", "missions": "misiones", "feats": "hazañas", "coins": "monedas" },
  "kit": "Equipación {name}",
  "kitOwned": "Tuya para siempre. Póntela desde la pestaña Equipación.",
  "kitHow": "Completa {n} misiones semanales esta temporada para ganarla.",
  "kitHowNow": "{n} misiones semanales esta temporada",
  "kitHowLater": "Vuelve con su temporada",
  "kitProgress": "{n} de {of} misiones",
  "kitBlurb": "Los colores de una temporada. No se vende: se gana con misiones semanales en su temporada.",
  "kitsTitle": "Colores de temporada",
  "kitsNote": "Cada temporada tiene sus colores, que se ganan con {n} misiones semanales dentro de esa temporada. Una vez ganados son tuyos, aunque la temporada termine.",
  "keep": "Cuando termina la temporada ya no puedes ganar su equipación, pero nada de lo que ganaste desaparece.",
  "lastRecap": "Resumen de la temporada pasada",
  "recapTitle": "Resumen de temporada",
  "recapKeep": "Todo lo que hay aquí sigue siendo tuyo."
};
es.stall = {
  "today": "El puesto de hoy",
  "turns": "el siguiente en {time}",
  "soon": "El puesto abre pronto.",
  "owned": "Tuyo. Está en {room}.",
  "buyAria": "Comprar {name} por {cost} monedas",
  "size": "Ocupa {w} × {h} baldosas",
  "fair": "Un artículo al día, el mismo para todo el mundo, solo con monedas. La lista va en orden, así que puedes ver lo que viene.",
  "next": "Próximamente",
  "boughtToast": "Ya está en tus salas. Tócalo para moverlo.",
  "blurb": {
    "decor-plant": "Una costilla de Adán frondosa en una maceta azul marino. Todo vestuario necesita una.",
    "decor-cooler": "Agua fría junto a la pista, con vasos apilados.",
    "decor-bench": "Un banco largo de madera para atarse las zapatillas.",
    "decor-roller": "Tres rulos de espuma y una esterilla, para las zonas cargadas.",
    "decor-punchbag": "Un saco pesado en su soporte, con los guantes en la base.",
    "decor-shelf": "Sitio para tres copas y una medalla.",
    "decor-towels": "Toallas de piscina a rayas y unas gafas de repuesto.",
    "decor-rug": "Una alfombra azul marino con un rayo dorado. Se pueden poner cosas a su alrededor."
  }
};

export default es;
