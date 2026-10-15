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
  "run": "Carrera",
  "bike": "Bici",
  "swim": "Natación",
  "gym": "Gimnasio",
  "brick": "Transición",
  "mobility": "Movilidad",
  "other": "Otro",
  "cycling": "Ciclismo",
  "running": "Carrera",
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
  "runVolume": "Volumen de carrera {pct}% respecto a la semana pasada ({last}→{now} km).",
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
  "daysN": "{n} d"
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
    "brick": "Día de transición: bici y directo a correr.",
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
    "desc": "Completa una sesión de transición"
  },
  "triple": {
    "name": "Triple amenaza",
    "desc": "Corre, pedalea y nada el mismo día"
  },
  "all-rounder": {
    "name": "Todoterreno",
    "desc": "Completa una sesión de carrera, bici, natación y gimnasio"
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
  "brick": "Clava la sesión de transición",
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
    "bro5": "Weider ×5",
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
      "sub": "Progresión en natación, bici y carrera"
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
      "sub": "Natación · bici · carrera"
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
    "Running": "Carrera",
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
  "runPace1k": "Ritmo actual de carrera (series de 1 km)",
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
  "hRun": "Carrera por semana",
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

export default es;
