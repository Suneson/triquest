// es.js — el español de la app (de España, en el registro de un gimnasio o un
// club de triatlón, no de un manual). Mismas claves que en.js; los términos
// dudosos están en docs/i18n/REVIEW.md.

const es = {};

es.app = {
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
  "resetsIn": "Nuevas en {time}",
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
  "fitness": "Forma física",
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

export default es;
