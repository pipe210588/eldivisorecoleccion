// Pruebas de firestore.rules en el emulador de Firebase (GitHub Actions), con datos ficticios.
// Cubren el lote cogido por día (Alfonsito F4, D-104) y lo que ya existía y no debe cambiar.
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, Timestamp } from 'firebase/firestore';

const FINCA = 'finca-prueba';        // finca con escritura de Alfonsito aprobada (escritorUid)
const SIN_ESCRITOR = 'finca-sin-escritor'; // Alfonsito solo lee
const MAYORDOMO = 'mayordomo-ficticio';
const ALFONSITO = 'alfonsito-ficticio';
const EXTRANO = 'otra-persona';
const SEMANA = '2026-11-16';
const SEMANA_SIN_DOC = '2026-11-23';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-libro',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

after(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'fincas', FINCA), { precioKg: 1000, mayordomoUid: MAYORDOMO, lectorUid: ALFONSITO, escritorUid: ALFONSITO });
    await setDoc(doc(db, 'fincas', SIN_ESCRITOR), { precioKg: 1000, lectorUid: ALFONSITO });
    for (const finca of [FINCA, SIN_ESCRITOR]) {
      await setDoc(doc(db, 'fincas', finca, 'semanas', SEMANA), { precioKg: 1000, pagada: false, cogedores: [] });
    }
  });
});

const db = (uid) => env.authenticatedContext(uid).firestore();
const lotes = (d, finca = FINCA, semana = SEMANA) => doc(d, 'fincas', finca, 'lotesCogida', semana);

const deAlfonsito = (cambios = {}) => ({
  loteId: 'lote-1', loteNombre: 'Lote Uno', origen: 'alfonsito',
  mensajeId: 'wamid.FICTICIO1', creadoEn: Timestamp.now(), huella: 'a'.repeat(64), ...cambios,
});
const dePersona = (cambios = {}) => ({
  loteId: 'lote-2', loteNombre: 'Lote Dos', origen: 'persona', editadoPorPersona: true,
  editadoPor: 'mayordomo', editadoEn: '2026-11-18T20:00:00.000Z', ...cambios,
});

async function sembrar(datos, finca = FINCA, semana = SEMANA) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(lotes(ctx.firestore(), finca, semana), datos);
  });
}

// ---------- Alfonsito: lo que sí puede ----------

test('Alfonsito anota el lote de un día en una semana que existe', async () => {
  await assertSucceeds(setDoc(lotes(db(ALFONSITO)), { lun: deAlfonsito() }));
});

test('Alfonsito agrega otro día sin tocar los demás', async () => {
  await sembrar({ lun: deAlfonsito() });
  await assertSucceeds(updateDoc(lotes(db(ALFONSITO)), { mar: deAlfonsito({ mensajeId: 'wamid.FICTICIO2' }) }));
});

test('Alfonsito corrige una entrada suya que nadie tocó', async () => {
  await sembrar({ lun: deAlfonsito() });
  await assertSucceeds(updateDoc(lotes(db(ALFONSITO)), { lun: deAlfonsito({ loteId: 'lote-3', loteNombre: 'Lote Tres' }) }));
});

// ---------- Alfonsito: lo que no puede ----------

test('Alfonsito no toca un día que corrigió una persona', async () => {
  await sembrar({ lun: dePersona() });
  await assertFails(updateDoc(lotes(db(ALFONSITO)), { lun: deAlfonsito() }));
});

test('Alfonsito no toca un día corregido aunque la persona dejara el lote vacío', async () => {
  await sembrar({ lun: dePersona({ loteId: '', loteNombre: '' }) });
  await assertFails(updateDoc(lotes(db(ALFONSITO)), { lun: deAlfonsito() }));
});

test('Alfonsito no escribe dos días en la misma escritura', async () => {
  await assertFails(setDoc(lotes(db(ALFONSITO)), { lun: deAlfonsito(), mar: deAlfonsito() }));
});

test('Alfonsito no escribe sábado ni domingo', async () => {
  await assertFails(setDoc(lotes(db(ALFONSITO)), { sab: deAlfonsito() }));
  await assertFails(setDoc(lotes(db(ALFONSITO)), { dom: deAlfonsito() }));
});

test('Alfonsito no escribe una clave que no es un día', async () => {
  await assertFails(setDoc(lotes(db(ALFONSITO)), { notas: deAlfonsito() }));
});

test('Alfonsito no escribe en una semana que no existe', async () => {
  await assertFails(setDoc(lotes(db(ALFONSITO), FINCA, SEMANA_SIN_DOC), { lun: deAlfonsito() }));
});

test('Alfonsito no escribe en una finca donde el dueño no aprobó la escritura', async () => {
  await assertFails(setDoc(lotes(db(ALFONSITO), SIN_ESCRITOR), { lun: deAlfonsito() }));
});

test('Alfonsito no se pone la marca de persona ni cambia el origen', async () => {
  await assertFails(setDoc(lotes(db(ALFONSITO)), { lun: deAlfonsito({ editadoPorPersona: true }) }));
  await assertFails(setDoc(lotes(db(ALFONSITO)), { lun: deAlfonsito({ origen: 'persona' }) }));
});

test('Alfonsito no escribe una entrada incompleta o con tipos inválidos', async () => {
  const { huella, ...sinHuella } = deAlfonsito();
  await assertFails(setDoc(lotes(db(ALFONSITO)), { lun: sinHuella }));
  await assertFails(setDoc(lotes(db(ALFONSITO)), { lun: deAlfonsito({ loteId: '' }) }));
  await assertFails(setDoc(lotes(db(ALFONSITO)), { lun: deAlfonsito({ huella: 'corta' }) }));
  await assertFails(setDoc(lotes(db(ALFONSITO)), { lun: deAlfonsito({ creadoEn: '2026-11-18' }) }));
  await assertFails(setDoc(lotes(db(ALFONSITO)), { lun: deAlfonsito({ mensajeId: '' }) }));
  await assertFails(setDoc(lotes(db(ALFONSITO)), { lun: deAlfonsito({ kilos: 30 }) }));
});

test('Alfonsito no borra un día ni el documento de la semana', async () => {
  await sembrar({ lun: deAlfonsito(), mar: deAlfonsito() });
  await assertFails(updateDoc(lotes(db(ALFONSITO)), { lun: deleteField() }));
  await assertFails(deleteDoc(lotes(db(ALFONSITO))));
});

test('Alfonsito no escribe en ninguna otra parte del Libro', async () => {
  const d = db(ALFONSITO);
  await assertFails(updateDoc(doc(d, 'fincas', FINCA, 'semanas', SEMANA), { lluvia: { lun: 3 } }));
  await assertFails(setDoc(doc(d, 'fincas', FINCA, 'jornales', SEMANA), { labores: [] }));
  await assertFails(setDoc(doc(d, 'fincas', FINCA, 'privado', SEMANA), { produccion: [] }));
  await assertFails(setDoc(doc(d, 'fincas', FINCA, 'compartido', 'config'), { lotes: [] }));
  await assertFails(updateDoc(doc(d, 'fincas', FINCA), { escritorUid: 'otro' }));
});

test('Alfonsito sigue pudiendo leer el Libro', async () => {
  await sembrar({ lun: deAlfonsito() });
  await assertSucceeds(getDoc(lotes(db(ALFONSITO))));
  await assertSucceeds(getDoc(doc(db(ALFONSITO), 'fincas', FINCA, 'semanas', SEMANA)));
});

// ---------- Remitente incorrecto ----------

test('Otra persona no escribe ni lee el lote cogido', async () => {
  await assertFails(setDoc(lotes(db(EXTRANO)), { lun: deAlfonsito() }));
  await assertFails(setDoc(lotes(db(EXTRANO)), { lun: dePersona() }));
  await sembrar({ lun: deAlfonsito() });
  await assertFails(getDoc(lotes(db(EXTRANO))));
});

test('El mayordomo no puede hacerse pasar por Alfonsito', async () => {
  await assertFails(setDoc(lotes(db(MAYORDOMO)), { lun: deAlfonsito() }));
});

// ---------- Personas (dueño y mayordomo) ----------

test('El mayordomo anota el lote del día con la marca de persona', async () => {
  await assertSucceeds(setDoc(lotes(db(MAYORDOMO)), { lun: dePersona() }));
});

test('Una persona no escribe sin la marca', async () => {
  const { editadoPorPersona, ...sinMarca } = dePersona();
  await assertFails(setDoc(lotes(db(MAYORDOMO)), { lun: sinMarca }));
});

test('El dueño corrige un día que anotó Alfonsito', async () => {
  await sembrar({ lun: deAlfonsito() });
  await assertSucceeds(updateDoc(lotes(db(FINCA)), { lun: dePersona({ editadoPor: 'dueño' }) }));
});

test('Una persona puede dejar un día sin lote, y queda marcado', async () => {
  await sembrar({ lun: deAlfonsito() });
  await assertSucceeds(updateDoc(lotes(db(MAYORDOMO)), { lun: dePersona({ loteId: '', loteNombre: '' }) }));
});

test('Solo el dueño borra el documento de la semana', async () => {
  await sembrar({ lun: deAlfonsito() });
  await assertFails(deleteDoc(lotes(db(MAYORDOMO))));
  await assertSucceeds(deleteDoc(lotes(db(FINCA))));
});

// ---------- Lo que ya existía sigue igual ----------

test('El mayordomo sigue sin poder cambiar el precio ni marcar pagada la semana', async () => {
  await assertFails(updateDoc(doc(db(MAYORDOMO), 'fincas', FINCA, 'semanas', SEMANA), { precioKg: 2000 }));
  await assertFails(updateDoc(doc(db(MAYORDOMO), 'fincas', FINCA, 'semanas', SEMANA), { pagada: true }));
  await assertSucceeds(updateDoc(doc(db(MAYORDOMO), 'fincas', FINCA, 'semanas', SEMANA), { lluvia: { lun: 3 } }));
});

test('El lector sin escritura sigue sin escribir en la semana', async () => {
  await assertFails(updateDoc(doc(db(ALFONSITO), 'fincas', SIN_ESCRITOR, 'semanas', SEMANA), { lluvia: { lun: 3 } }));
});
