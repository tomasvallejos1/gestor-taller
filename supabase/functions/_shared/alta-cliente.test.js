import test from 'node:test';
import assert from 'node:assert/strict';
import { crearCliente } from './datos-presupuestos.js';

/**
 * Cliente de Supabase de mentira: registra lo que se le pidio insertar y
 * devuelve esa misma fila. Alcanza para probar lo que importa acá, que es
 * QUE se manda a guardar y que se rechaza antes de llegar a la base.
 */
function clienteFalso() {
  const registro = { insertado: null };
  return {
    registro,
    from() {
      return {
        insert(fila) {
          registro.insertado = fila;
          return {
            select() {
              return { single: async () => ({ data: { id: 'uuid-1', ...fila }, error: null }) };
            },
          };
        },
      };
    },
  };
}

test('crearCliente', async (t) => {
  await t.test('guarda una persona fisica con DNI', async () => {
    const c = clienteFalso();
    await crearCliente(c, {
      nombre: 'Juan Gimenez',
      tipo_persona: 'fisica',
      documento_tipo: 'dni',
      documento: '12.345.678',
      condicion_fiscal: 'consumidor_final',
    });
    assert.equal(c.registro.insertado.nombre, 'Juan Gimenez');
    // Se normaliza a digitos: el papel lo trae con puntos.
    assert.equal(c.registro.insertado.documento, '12345678');
    assert.equal(c.registro.insertado.tipo_persona, 'fisica');
  });

  await t.test('guarda una empresa con CUIT valido', async () => {
    const c = clienteFalso();
    await crearCliente(c, {
      nombre: 'Metalurgica del Sur SA',
      tipo_persona: 'juridica',
      documento_tipo: 'cuit',
      // El digito verificador de 3071234567 es 1 (modulo 11 de AFIP).
      documento: '30-71234567-1',
      condicion_fiscal: 'responsable_inscripto',
    });
    assert.equal(c.registro.insertado.documento, '30712345671');
    assert.equal(c.registro.insertado.condicion_fiscal, 'responsable_inscripto');
  });

  await t.test('rechaza un CUIT con el digito verificador cambiado', async () => {
    // Este es el caso que importa: son 11 digitos y "parece" bien, pero
    // el modulo 11 no cierra. Si pasa, sale impreso en el presupuesto.
    const c = clienteFalso();
    await assert.rejects(
      () => crearCliente(c, {
        nombre: 'Empresa Trucha',
        tipo_persona: 'juridica',
        documento_tipo: 'cuit',
        // Mismos 10 primeros digitos que el caso valido, pero terminado
        // en 4 en vez de 1: es exactamente el error de tipeo que hay que
        // atrapar antes de imprimirlo.
        documento: '30712345674',
      }),
      /ultimo digito no coincide/i,
    );
    assert.equal(c.registro.insertado, null, 'no tendria que haber llegado a la base');
  });

  await t.test('rechaza una empresa identificada con DNI', async () => {
    const c = clienteFalso();
    await assert.rejects(
      () => crearCliente(c, {
        nombre: 'Empresa SA', tipo_persona: 'juridica',
        documento_tipo: 'dni', documento: '12345678',
      }),
      /CUIT/,
    );
  });

  await t.test('rechaza un DNI de cuatro digitos', async () => {
    const c = clienteFalso();
    await assert.rejects(
      () => crearCliente(c, {
        nombre: 'Alguien', tipo_persona: 'fisica',
        documento_tipo: 'dni', documento: '1234',
      }),
      /7 u 8 digitos/,
    );
  });

  await t.test('sin documento se guarda igual', async () => {
    // Ir a buscar el DNI no puede ser condicion para presupuestar.
    const c = clienteFalso();
    await crearCliente(c, { nombre: 'Cliente de mostrador', tipo_persona: 'fisica' });
    assert.equal(c.registro.insertado.documento, null);
    assert.equal(c.registro.insertado.documento_tipo, null);
    assert.equal(c.registro.insertado.condicion_fiscal, 'consumidor_final');
  });

  await t.test('sin nombre no se guarda', async () => {
    const c = clienteFalso();
    await assert.rejects(() => crearCliente(c, { nombre: '   ' }), /nombre/);
    assert.equal(c.registro.insertado, null);
  });
});
