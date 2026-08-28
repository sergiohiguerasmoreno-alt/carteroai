import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import React from 'react';
import { z } from 'zod';
import { ReportDocument } from '@/lib/pdf/report-document';
import { PortfolioSchema, InvestorProfileSchema } from '@/lib/validation/schemas';
import { checkRateLimit, clientIdentifier } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 30;

// El análisis ya ha sido calculado por /api/analyze; aquí solo se valida su
// forma general (no se recalcula nada) para poder maquetarlo en PDF.
const ReportRequestSchema = z.object({
  analysis: z.record(z.string(), z.any()),
  portfolio: PortfolioSchema,
  profile: InvestorProfileSchema,
});

export async function POST(req: NextRequest) {
  const id = clientIdentifier(req.headers);
  const { allowed } = checkRateLimit(`pdf:${id}`);
  if (!allowed) {
    return NextResponse.json({ error: 'Demasiadas peticiones. Inténtalo de nuevo en un minuto.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Petición no válida.' }, { status: 400 });
  }

  const parsed = ReportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'No se ha podido generar el PDF: datos incompletos.' }, { status: 400 });
  }

  try {
    const element = React.createElement(ReportDocument, {
      analysis: parsed.data.analysis as never,
      portfolio: parsed.data.portfolio,
      profile: parsed.data.profile,
    }) as React.ReactElement<DocumentProps>;
    const buffer = await renderToBuffer(element);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="carteroai-informe.pdf"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('Error generando el PDF:', err instanceof Error ? err.message : 'error desconocido');
    return NextResponse.json({ error: 'No se ha podido generar el PDF del informe.' }, { status: 500 });
  }
}
