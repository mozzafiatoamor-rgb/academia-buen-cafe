// =====================================================================
//  PUNTOS JUSTOS · misma fórmula que Supabase (paso 4), para mostrar en la
//  app cuánto vale cada curso y para el modo demo.
// =====================================================================
export const CFG_BASE = {
  puntos_por_duracion: 1,        // 1 = según duración del video, 0 = puntos fijos
  puntos_por_minuto: 2,
  puntos_leccion_min: 5,
  puntos_leccion_max: 40,
  bono_curso_pct: 30,
  bono_curso_min: 20,
  bono_curso_max: 300,
  puntos_quiz_por_pregunta: 5,
  puntos_quiz_min: 15,
  puntos_quiz_max: 60,
  bono_a_tiempo_pct: 15,
  bono_a_tiempo_min: 10,
  // Audiolibros
  audio_puntos_por_minuto: 1,
  audio_tramo_min: 10,
  audio_bono_pct: 30,
  audio_bono_min: 20,
  audio_bono_max: 300,
  // Modo fijo
  puntos_leccion: 10,
  puntos_curso: 50,
  puntos_quiz_perfecto: 30,
  puntos_a_tiempo: 20,
};

let cfgActual = { ...CFG_BASE };
export const cfgPuntos = () => cfgActual;
export function fijarCfgPuntos(filas) {
  const c = { ...CFG_BASE };
  for (const [k, v] of Object.entries(filas || {})) if (k in c && v !== null && v !== "" && !isNaN(Number(v))) c[k] = Number(v);
  cfgActual = c;
}

const entre = (v, a, b) => Math.min(Math.max(v, a), b);
const porDuracion = (c) => Number(c.puntos_por_duracion) === 1;

export function puntosLeccion(duracionSeg, c = cfgActual) {
  if (porDuracion(c) && duracionSeg > 0) return entre(Math.round((duracionSeg / 60) * c.puntos_por_minuto), c.puntos_leccion_min, c.puntos_leccion_max);
  return c.puntos_leccion;
}
export function puntosCurso(lecciones, c = cfgActual) {
  if (!porDuracion(c)) return c.puntos_curso;
  const suma = lecciones.reduce((a, l) => a + puntosLeccion(l.duracion_seg, c), 0);
  return entre(Math.round((suma * c.bono_curso_pct) / 100), c.bono_curso_min, c.bono_curso_max);
}
export function puntosQuiz(nPreguntas, c = cfgActual) {
  if (!porDuracion(c)) return c.puntos_quiz_perfecto;
  return entre(nPreguntas * c.puntos_quiz_por_pregunta, c.puntos_quiz_min, c.puntos_quiz_max);
}
export function puntosATiempo(lecciones, c = cfgActual) {
  if (!porDuracion(c)) return c.puntos_a_tiempo;
  return Math.max(Math.round((puntosCurso(lecciones, c) * c.bono_a_tiempo_pct) / 100), c.bono_a_tiempo_min);
}

// Desglose de lo que vale un curso completo.
export function valorCurso({ lecciones, preguntas = 0, conFecha = false }, c = cfgActual) {
  const porLecciones = lecciones.reduce((a, l) => a + puntosLeccion(l.duracion_seg, c), 0);
  const bono = puntosCurso(lecciones, c);
  const quiz = preguntas > 0 ? puntosQuiz(preguntas, c) : 0;
  const aTiempo = conFecha ? puntosATiempo(lecciones, c) : 0;
  return { porLecciones, bono, quiz, aTiempo, total: porLecciones + bono + quiz + aTiempo };
}

// Niveles sugeridos según lo que se puede ganar en todo el catálogo publicado.
export function nivelesSugeridos(totalCatalogo, nombres) {
  const pct = [0, 0.08, 0.25, 0.5, 0.85];
  const redondear = (v) => Math.max(50, Math.round(v / 50) * 50);
  return nombres.map((nombre, i) => ({ orden: i + 1, nombre, puntos_min: i === 0 ? 0 : redondear(totalCatalogo * pct[Math.min(i, pct.length - 1)]) }));
}


// Audiolibros: puntos por minuto escuchado (se pagan por tramos) + bono al terminar.
export function valorAudio(duracionSeg, conFecha = false, c = cfgActual) {
  const min = Math.max(0, Number(duracionSeg) || 0) / 60;
  const porMinuto = Math.round(min * c.audio_puntos_por_minuto);
  const bono = entre(Math.round(min * c.audio_puntos_por_minuto * c.audio_bono_pct / 100), c.audio_bono_min, c.audio_bono_max);
  const aTiempo = conFecha ? Math.max(Math.round(bono * c.bono_a_tiempo_pct / 100), c.bono_a_tiempo_min) : 0;
  return { porMinuto, bono, aTiempo, total: porMinuto + bono + aTiempo };
}
