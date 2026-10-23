# Spanish terms to decide

**Decided (15 Oct):** Run is "Correr", Brick stays "Brick", Taper is "Tapering",
the bro split stays "Bro split", Quests are "Misiones", the Fitness hub is "Mi
forma". These are in `es.js`; the rest of the list below stands as shipped
until you say otherwise.

Spanish is your first language, so these are the calls I'd like you to make.
Each line says what the app shows now and the alternatives I weighed. Change
any of them in `js/core/locales/es.js` (or `plan-es.js` for the seeded plan)
and `npm test` will tell you if a placeholder went missing.

## Sports and intensities

| English | Now | Alternatives | Why |
| --- | --- | --- | --- |
| Run (sport label) | Carrera | Correr, Running | "Carrera" is what Spanish triathlon uses for the run leg, but it also means "race". Where both could clash (a race tag on a run) the race tag reads "Carrera" too. You may prefer "Correr" for the sport |
| Bike | Bici | Ciclismo | "Bici" is how people say it; the scene label uses "Ciclismo" |
| Brick | Transición | Brick, Combinado | Spanish triathletes say "transición" or "brick" ("hacer un brick"). If your crowd says brick, use it |
| Race (intensity) | Competición | Carrera, Ritmo de carrera | Avoids a second "Carrera" next to the sport |
| Steady | Constante | Fondo, Ritmo cómodo | |
| Threshold | Umbral | | Standard |
| Sweet spot | Sweet spot (kept) | Zona dulce | Cyclists in Spain say "sweet spot"; "zona dulce" reads translated |
| Taper | Tapering | Puesta a punto, Afinamiento | "Tapering" is what Spanish runners say; "puesta a punto" is the formal one |
| Deload | Descarga | | Standard in gyms |
| Fartlek, Tempo | kept | | Used as-is in Spanish |

## Gym

| English | Now | Alternatives |
| --- | --- | --- |
| Set (column) | Serie | |
| Last (column) | Antes | Anterior, Últ. ("Anterior" didn't fit at 320px) |
| Reps | Reps | Repeticiones (used in screen-reader labels) |
| Warm-up set letter | C (calentamiento) | W kept as in English |
| Work set | Efectiva | De trabajo |
| Drop set | Drop set | Descendente |
| Failure | Al fallo | |
| PR (badge on a set) | PR | MP (marca personal), Récord. The record toasts say "Nuevo récord" |
| Superset | Superserie | Biserie |
| Push / Pull / Legs | Empuje / Tirón / Pierna | Push / Pull / Legs is common in Spanish gyms too |
| Upper / Lower | Torso / Pierna | |
| Bro split | Weider | "Rutina Weider" is the Spanish name for the one-muscle-a-day split |
| Back Squat | Sentadilla trasera | Sentadilla con barra |
| Romanian Deadlift | Peso muerto rumano | |
| Trap Bar Deadlift | Peso muerto con barra hexagonal | |
| Bulgarian Split Squat | Sentadilla búlgara | |
| Nordic Hamstring Curl | Curl nórdico | Nórdicos |
| Copenhagen Plank | Plancha Copenhague | |
| Face Pull | Face pull (kept) | Jalón a la cara |
| Pallof Press | Press Pallof | |
| Lat Pulldown | Jalón al pecho | |
| Triceps Pushdown | Extensión de tríceps en polea | Jalón de tríceps |
| Bird Dog | Bird dog (kept) | Cuadrupedia, Superman cruzado |
| Air Bike | Air bike (kept) | Bici de aire, Assault bike |
| Aerobics | Step | Aeróbic |
| Quads / Hamstrings / Calves | Cuádriceps / Femorales / Gemelos | Isquios for hamstrings |

## App vocabulary

| English | Now | Alternatives |
| --- | --- | --- |
| Quests | Misiones | Retos |
| Daily quests | Misiones del día | Retos diarios |
| Resets 10:44 | Reinicio 10:44 | Nuevas en 10:44 (too long at 320px) |
| Ranks (tab) | Ranking | Clasificación (the screen title uses it) |
| Leaderboards | Clasificación | |
| Shop | Tienda | |
| Coach | Entrenador | Coach, Míster |
| Fitness (hub title) | Mi forma | Forma física (cut off at 320px), Fitness |
| Season path / Week path | Camino de la temporada / de la semana | Ruta |
| Streak | Racha | |
| Level up | Subes de nivel | ¡Nivel nuevo! |
| Account level | Nivel de cuenta | |
| General / Direct (chat) | General / Privados | Directos, Mensajes |
| Report / Block | Denunciar / Bloquear | Reportar |
| Magic link | Enlace mágico | Enlace de acceso |
| Packing (bag) | Bolsa | Mochila, Qué llevar |
| Fuelling | Nutrición / avituallamiento | |

## Tone

- I used "tú" throughout, short sentences, and Spain's Spanish ("móvil", "vale", "ordenador" avoided, "bici", "zapatillas").
- The coach speaks like a Spanish coach would: "A por ello", "Levanta el pie", "Que salga limpio".
- The welcome card says "Bienvenido a MOSKE". If you'd rather avoid the gendered form, "Te damos la bienvenida a MOSKE" works.
- "Corredor", "Ciclista", "Nadador" in the wizard are masculine forms used generically; "Triatleta" is neutral. Alternatives: "Corro", "Pedaleo", "Nado".

## Feats and trophies (added with the feats, 2026-10-23)

| English | Now | Alternatives |
| --- | --- | --- |
| Feat | Logro | Hazaña, Proeza |
| Trophies (case title) | Trofeos | Vitrina de trofeos (cut off at 320px) |
| Trophy board | Tablón de trofeos | Panel de trofeos |
| Trisuit | Trimono | Mono de triatlón |
| Lifting singlet | Maillot de halterofilia | Body de halterofilia |
| Cross (feats across sports) | Combi | Combinado, Multideporte |
| Finisher shirt | Camiseta de finisher | Camiseta de meta |
| Earned, not bought | Se ganan, no se compran | |
| Half marathon | Media maratón | Medio maratón |

## Challenges (added with the challenges, 2026-10-23)

| English | Now | Alternatives |
| --- | --- | --- |
| Challenge | Reto | Desafío |
| Stake | Apuesta | Entrada, Puesta |
| Pot | Bote | Fondo |
| Fee (burned) | Comisión (se quema) | Tasa |
| Ceiling reached | Tope alcanzado | Límite alcanzado |
| Winner takes all | El ganador se lo lleva todo | Todo para el primero |
