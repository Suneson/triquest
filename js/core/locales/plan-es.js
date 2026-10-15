// plan-es.js — Spanish for the seeded plan (js/core/plan.js). That plan is
// stored as data in English, so it is translated where it's shown: titles,
// notes, interval labels and packing items are looked up here by their exact
// English text (see js/core/plan-i18n.js). Anything not listed shows as stored.

export const TITLES = {
  'Bike Z2 endurance': 'Bici Z2 de fondo',
  'Gym — Upper': 'Gimnasio — torso',
  'Bike VO₂': 'Bici VO₂',
  'Swim — own plan': 'Natación — por tu cuenta',
  'Gym — Lower B (single-leg + Nordics)': 'Gimnasio — pierna B (unilateral + nórdicos)',
  'Long run — easy': 'Tirada larga — suave',
  'Long ride Z2': 'Salida larga en bici Z2',
  'Run quality — Fartlek': 'Calidad corriendo — fartlek',
  'Gym — Lower A (heavy)': 'Gimnasio — pierna A (pesado)',
  'Easy spin': 'Rodaje suave en bici',
  'Bike threshold / sweet-spot': 'Bici umbral / sweet spot',
  'Run threshold': 'Umbral corriendo',
  'Easy swim': 'Nado suave',
  'Bike Z2 long': 'Bici Z2 larga',
  'Easy run': 'Rodaje suave',
  'Brick — ride + run': 'Transición — bici + carrera',
  'Long run + 70.3 pace': 'Tirada larga + ritmo 70.3',
  'Swim aerobic': 'Nado aeróbico',
  'Gym — strength maintenance': 'Gimnasio — mantenimiento de fuerza',
  'IRONMAN 70.3 — RACE DAY': 'IRONMAN 70.3 — DÍA DE CARRERA',
  'Run quality — threshold': 'Calidad corriendo — umbral',
  'Easy bike (recovery)': 'Bici suave (recuperación)',
  'Light strength': 'Fuerza ligera',
  'Easy run + strides': 'Rodaje suave + progresivos',
  'Easy swim or rest': 'Nado suave o descanso',
  'Easy run (shakeout)': 'Rodaje suave (soltar piernas)',
  'Long run': 'Tirada larga',
  'Marathon — RACE DAY': 'Maratón — DÍA DE CARRERA',
  'Marathon': 'Maratón',
};

// " (deload)" / " (taper)" on the end of a title
export const TITLE_SUFFIX = { deload: 'descarga', taper: 'tapering' };

// the sentence a deload or taper week puts in front of the notes
export const NOTE_PREFIX = {
  'Deload week — ~40% less volume.': 'Semana de descarga: ~40% menos de volumen.',
  'Taper — keep it short and sharp.': 'Tapering: corto e intenso.',
};

export const NOTES = {
  'Z2 conversational (RPE 3–4). Slot in 4×1′ at 100+ rpm high-cadence inside the ride.': 'Z2 de charla (RPE 3–4). Mete 4×1′ a más de 100 rpm de cadencia alta dentro de la salida.',
  'Pull-focused upper body. Keep it crisp.': 'Torso centrado en tracciones. Que salga limpio.',
  '5×(3′ VO₂ RPE 8–9 / 3′ easy). HR + RPE, ignore gym-bike watts.': '5×(3′ VO₂ RPE 8–9 / 3′ suave). Guíate por FC + RPE, ignora los vatios de la bici del gimnasio.',
  'Flex / optional. Nordics + calf work protect the past run injury — don’t skip those two.': 'Flexible / opcional. Los nórdicos y los gemelos protegen la lesión de carrera que tuviste: esos dos no te los saltes.',
  'Easy pace ~5:05–5:30/km. Practice fuelling 60–90 g carbs/h.': 'Ritmo suave ~5:05–5:30/km. Practica la nutrición: 60–90 g de hidratos/h.',
  'Backbone of the 200 km week. Z2, can hold a conversation. Practice on-bike fuelling.': 'La columna de la semana de 200 km. Z2, pudiendo charlar. Practica comer en la bici.',
  'Fartlek 6×(3′ hard / 2′ float). Stay relaxed on the hard reps — controlled, not maximal.': 'Fartlek 6×(3′ fuerte / 2′ suave). Relajado en los tramos fuertes: controlado, no a tope.',
  'Technique + aerobic. Your own set.': 'Técnica + aeróbico. Tu propia serie.',
  'Heavy strength. Brace hard, full depth on squats. Log weight + RPE.': 'Fuerza pesada. Core bien firme y sentadillas profundas. Apunta peso + RPE.',
  'Pure recovery flush, conversational RPE 3.': 'Pura recuperación para soltar, de charla, RPE 3.',
  '2–3×12–15′ at RPE 6–7 / 5′ easy. Build sustainable power for 70.3.': '2–3×12–15′ a RPE 6–7 / 5′ suave. Construye potencia sostenible para el 70.3.',
  '4×8′ tempo (or 6×3′) at ~4:10–4:25/km, RPE 6–7.': '4×8′ a ritmo tempo (o 6×3′) a ~4:10–4:25/km, RPE 6–7.',
  '2–2.5 h steady Z2. Some races-effort surges optional. Fuel it.': '2–2,5 h constantes en Z2. Algún cambio a ritmo de carrera, opcional. Come durante la salida.',
  'Easy shakeout, or rest if tired. Sleep beats an extra session.': 'Rodaje suave para soltar, o descanso si estás cansado. Dormir vale más que una sesión de más.',
  'Ride 2.5–3 h with race-effort blocks → straight into 20–30′ run at 70.3 pace. Dial transitions + fuelling.': 'Bici 2,5–3 h con bloques a ritmo de carrera → directo a 20–30′ corriendo a ritmo 70.3. Afina transiciones y nutrición.',
  '90–110′ with some at 70.3 pace, or easy + open-water swim.': '90–110′ con una parte a ritmo 70.3, o suave + nado en aguas abiertas.',
  'Maintenance dose, 1×/week now. Keep the bar moving fast.': 'Dosis de mantenimiento, ahora 1×/semana. Mueve la barra rápido.',
  '1.9 km swim · 90 km bike · 21.1 km run. Execute fuelling 60–90 g carbs/h. Trust the training.': '1,9 km nado · 90 km bici · 21,1 km carrera. Cumple la nutrición: 60–90 g de hidratos/h. Confía en el entreno.',
  '4×8′ threshold, or marathon-pace 2×5 km. ~4:10–4:25/km.': '4×8′ a umbral, o 2×5 km a ritmo de maratón. ~4:10–4:25/km.',
  'Maintenance / recovery spin only. Bike is easy this phase.': 'Solo bici de mantenimiento / recuperación. En esta fase la bici va suave.',
  'Keep Nordics + calves going for run durability.': 'Sigue con nórdicos y gemelos para que las piernas aguanten corriendo.',
  'Easy + 6×20 s strides. Smooth and light.': 'Suave + 6×20 s de progresivos. Fluido y ligero.',
  'Pre-long-run shakeout. Loose and easy.': 'Rodaje para soltar antes de la tirada larga. Suelto y suave.',
  'Very easy 75–90′ — first long run off the 70.3. No pace pressure.': '75–90′ muy suaves: primera tirada larga después del 70.3. Sin mirar el ritmo.',
  'Swim is parked this phase — optional flush only. Rest is fine.': 'La natación queda aparcada en esta fase: solo un nado suave opcional. Descansar está bien.',
  '22–24 km easy. Build durability gently.': '22–24 km suaves. Gana aguante poco a poco.',
  '27–28 km, last 5 km steady.': '27–28 km, los últimos 5 km a ritmo constante.',
  'Peak 32 km — middle 2×6 km at MP. Ceiling, not a must: 28–30 km is fine if anything niggles.': 'Pico de 32 km, con 2×6 km en medio a ritmo de maratón. Es un techo, no una obligación: 28–30 km está bien si algo molesta.',
  '24 km with 8 km at marathon pace.': '24 km con 8 km a ritmo de maratón.',
  '16–18 km easy — taper week.': '16–18 km suaves: semana de tapering.',
  '42.2 km at marathon pace ~4:40–4:55/km (lock in after the 70.3). Even effort, fuel early.': '42,2 km a ritmo de maratón ~4:40–4:55/km (se fija después del 70.3). Esfuerzo regular y come pronto.',
};

export const SEGMENTS = {
  'Warm-up': 'Calentamiento', 'VO₂': 'VO₂', 'Easy': 'Suave', 'Cool-down': 'Vuelta a la calma',
  'Hard': 'Fuerte', 'Float': 'Suave', 'Threshold': 'Umbral', 'Tempo': 'Tempo',
};

export const ITEMS = {
  'Bib shorts': 'Culotte', 'Cycling shoes': 'Zapatillas de ciclismo', 'Towel': 'Toalla', 'Fan on': 'Ventilador puesto',
  '2× bottles': '2 bidones', 'Chamois cream': 'Crema antirozaduras', 'HR strap': 'Banda de pulso', 'Lifting shoes': 'Zapatillas de halterofilia',
  'Belt': 'Cinturón', 'Knee sleeves': 'Rodilleras', 'Chalk / straps': 'Magnesio / straps', 'Water bottle': 'Botella de agua',
  'Swimsuit': 'Bañador', 'Goggles': 'Gafas de natación', 'Swim cap': 'Gorro', 'Flip-flops': 'Chanclas', 'Anti-fog spray': 'Antivaho',
  'Running shoes': 'Zapatillas de correr', 'Run watch / HR strap': 'Reloj / banda de pulso', 'Cap or visor': 'Gorra o visera',
  'Gels / chews': 'Geles / gominolas', 'Anti-chafe balm': 'Bálsamo antirozaduras', 'Water flask': 'Bidón blando',
  'Cycling + run shoes': 'Zapatillas de bici + de correr', 'Race belt': 'Cinturón portadorsal', 'Bottles + gels': 'Bidones + geles',
  'Transition towel': 'Toalla de transición', 'Wetsuit': 'Neopreno', 'Goggles ×2': 'Gafas ×2', 'Tri suit': 'Tritraje',
  'Bike + helmet': 'Bici + casco', 'Race shoes': 'Zapatillas de competición', 'Race belt + bib': 'Cinturón + dorsal',
  'Gels / carbs 60–90 g/h': 'Geles / hidratos 60–90 g/h', 'Bottles': 'Bidones', 'Bodyglide': 'Bodyglide', 'Timing chip': 'Chip',
  'Race kit + bib': 'Equipación + dorsal', 'Gels (carbs)': 'Geles (hidratos)', 'Cap': 'Gorra', 'Anti-chafe': 'Antirozaduras',
  'Throwaway layer': 'Capa para tirar',
};

// the default packing presets (settings.packing), by sport where a word
// means a different thing (a swim cap is a gorro, a running cap a gorra)
export const PRESET_ITEMS = {
  shoes: 'zapatillas', watch: 'reloj', gels: 'geles', cap: 'gorra', bib: 'culotte', bottles: 'bidones', helmet: 'casco',
  trunks: 'bañador', goggles: 'gafas', towel: 'toalla', belt: 'cinturón', water: 'agua',
};
export const PRESET_BY_SPORT = { swim: { cap: 'gorro' } };

export const PRINCIPLES = {
  'VO₂max is already 67 (lab) — gains come from threshold + strength economy + durability. One VO₂ session/week is enough.': 'El VO₂max ya es 67 (de laboratorio): las mejoras vienen del umbral, la economía de fuerza y el aguante. Con una sesión de VO₂ a la semana basta.',
  'Never spike weekly run volume more than ~10%.': 'Nunca subas el volumen semanal de carrera más de un ~10%.',
  'Nordic curls + calf work every week — they protect the past run injury. Don’t skip them.': 'Nórdicos y gemelos cada semana: protegen la lesión de carrera que tuviste. No te los saltes.',
  'Practice race fuelling: 60–90 g carbs/h on long rides and runs.': 'Practica la nutrición de carrera: 60–90 g de hidratos/h en las salidas y tiradas largas.',
  'Sleep beats an extra session. On heavy weeks protect: Mon run quality, Thu bike quality, the Sat long run, and one strength session — drop the rest guilt-free.': 'Dormir vale más que una sesión de más. En semanas cargadas, protege: calidad corriendo el lunes, calidad en bici el jueves, la tirada larga del sábado y una sesión de fuerza; lo demás, quítalo sin culpa.',
};

export const PACE_LABELS = {
  'Easy / long run': 'Rodaje suave / tirada larga', 'Marathon pace (provisional)': 'Ritmo de maratón (provisional)', 'Threshold run': 'Umbral corriendo',
  'Bike Z2': 'Bici Z2', 'Bike VO₂': 'Bici VO₂', 'Bike threshold': 'Bici umbral',
  'Conversational, RPE 3–4': 'De charla, RPE 3–4', '5×3′ hard RPE 8–9 / 3′ easy': '5×3′ fuerte RPE 8–9 / 3′ suave', '2–3×12–15′ RPE 6–7 / 5′ easy': '2–3×12–15′ RPE 6–7 / 5′ suave',
};
