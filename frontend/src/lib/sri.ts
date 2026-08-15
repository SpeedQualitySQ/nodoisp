import { supabase } from '@/lib/supabase'

const IVA_RATE = 0.15

export function calcularIva(subtotal: number) {
  return Math.round(subtotal * IVA_RATE * 100) / 100
}

/**
 * Simula la firma XAdES-BES y el envío SOAP al webservice del SRI: la clave
 * de acceso ya la generó la base de datos (algoritmo módulo 11 real) al
 * crear el borrador, así que aquí solo se simula la latencia de red y la
 * respuesta de autorización. El punto de integración real (xadesjs +
 * SOAP contra el SRI) queda marcado para una fase posterior.
 */
export async function firmarYEnviarDocumento(documentId: string) {
  const { error: procError } = await supabase
    .from('electronic_documents')
    .update({ estado: 'PROCESANDO' })
    .eq('id', documentId)
  if (procError) throw procError

  await new Promise((resolve) => setTimeout(resolve, 900))

  const { data: doc, error: fetchError } = await supabase
    .from('electronic_documents')
    .select('clave_acceso')
    .eq('id', documentId)
    .single()
  if (fetchError) throw fetchError

  const { error: authError } = await supabase
    .from('electronic_documents')
    .update({ estado: 'AUTORIZADO', numero_autorizacion: doc.clave_acceso })
    .eq('id', documentId)
  if (authError) throw authError
}

export function mensajeWhatsappCobro(nombreCliente: string, monto: number, numeroCompleto: string) {
  return (
    `✅ Hola *${nombreCliente}*, tu pago de *$${monto.toFixed(2)}* correspondiente a la ` +
    `factura *${numeroCompleto}* ha sido registrado exitosamente.\n` +
    `Gracias por tu pago puntual. 🙏\n_FOSMIKRO ISP_`
  )
}

export function descargarCsv(filename: string, rows: (string | number)[][]) {
  const content = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n')
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
