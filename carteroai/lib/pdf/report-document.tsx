import 'server-only';
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { AssetClass, ConfirmedPortfolio, InvestorProfile, PortfolioAnalysis } from '@/lib/types';
import { assetClassLabel } from '@/lib/format/asset-class-labels';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#111722' },
  coverTitle: { fontSize: 26, marginBottom: 6, fontFamily: 'Helvetica-Bold' },
  coverSubtitle: { fontSize: 12, color: '#5b6b7d', marginBottom: 24 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  metaLabel: { color: '#5b6b7d' },
  sectionTitle: { fontSize: 15, fontFamily: 'Helvetica-Bold', marginTop: 18, marginBottom: 8, color: '#0b5c51' },
  subTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 4 },
  paragraph: { marginBottom: 6, lineHeight: 1.5 },
  bullet: { flexDirection: 'row', marginBottom: 3 },
  bulletDot: { width: 10 },
  bulletText: { flex: 1, lineHeight: 1.4 },
  table: { marginTop: 6, marginBottom: 6 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#d6dee5', paddingVertical: 4 },
  tableHeaderRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#111722', paddingVertical: 4 },
  th: { flex: 1, fontFamily: 'Helvetica-Bold', fontSize: 9 },
  td: { flex: 1, fontSize: 9 },
  scoreBox: { padding: 12, backgroundColor: '#f7f9fa', borderRadius: 4, marginBottom: 10 },
  scoreNumber: { fontSize: 28, fontFamily: 'Helvetica-Bold', color: '#0f7a6b' },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 8, color: '#8595a6', textAlign: 'center' },
  recCard: { marginBottom: 10, padding: 8, backgroundColor: '#f7f9fa', borderRadius: 4 },
  recTitle: { fontFamily: 'Helvetica-Bold', fontSize: 10, marginBottom: 2 },
  badge: { fontSize: 8, color: '#5b6b7d', marginBottom: 4 },
  disclaimer: { fontSize: 8, lineHeight: 1.5, color: '#5b6b7d' },
});

const CATEGORY_LABEL: Record<string, string> = {
  maintain: 'MANTENER',
  watch: 'VIGILAR',
  review: 'REVISAR',
  change: 'CAMBIAR',
  remove: 'ELIMINAR',
};

function Footer() {
  return (
    <Text style={styles.footer} render={({ pageNumber, totalPages }) => `CarteroAI — Informe generado automáticamente — Página ${pageNumber} de ${totalPages}`} fixed />
  );
}

export function ReportDocument({
  analysis,
  portfolio,
  profile,
}: {
  analysis: PortfolioAnalysis;
  portfolio: ConfirmedPortfolio;
  profile: InvestorProfile;
}) {
  const date = new Date(analysis.generatedAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  const nonMaintainRecs = analysis.recommendations.filter((r) => r.category !== 'maintain');
  const assetClassByName = new Map<string, AssetClass>(portfolio.positions.map((p) => [p.name, p.assetClass]));

  return (
    <Document title={`CarteroAI — Informe de cartera — ${date}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.coverTitle}>CarteroAI</Text>
        <Text style={styles.coverSubtitle}>Informe de análisis de cartera de inversión</Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Fecha del análisis</Text>
          <Text>{date}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Objetivo declarado</Text>
          <Text>{profile.objective}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Horizonte aproximado</Text>
          <Text>{profile.horizonYearsApprox} años</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Pérdida máxima aceptada</Text>
          <Text>{profile.maxAcceptableLossPct}%</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Nº de posiciones analizadas</Text>
          <Text>{portfolio.positions.length}</Text>
        </View>

        <View style={styles.scoreBox}>
          <Text style={styles.scoreNumber}>{analysis.score.overall}/100</Text>
          <Text style={styles.paragraph}>{analysis.score.explanation}</Text>
        </View>

        <Text style={styles.sectionTitle}>Resumen ejecutivo</Text>
        <Text style={styles.paragraph}>{analysis.executiveSummary.headline}</Text>
        {analysis.executiveSummary.conservativeStatement && (
          <Text style={[styles.paragraph, { fontFamily: 'Helvetica-Bold' }]}>{analysis.executiveSummary.conservativeStatement}</Text>
        )}

        <Text style={styles.subTitle}>Qué está haciendo bien</Text>
        {analysis.executiveSummary.doingWell.map((t, i) => (
          <View style={styles.bullet} key={i}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>{t}</Text>
          </View>
        ))}

        {analysis.executiveSummary.problems.length > 0 && (
          <>
            <Text style={styles.subTitle}>Puntos a revisar</Text>
            {analysis.executiveSummary.problems.map((t, i) => (
              <View style={styles.bullet} key={i}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{t}</Text>
              </View>
            ))}
          </>
        )}

        <Footer />
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Composición de la cartera</Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.th}>Posición</Text>
            <Text style={[styles.th, { flex: 0.5 }]}>Clase</Text>
            <Text style={[styles.th, { flex: 0.5, textAlign: 'right' }]}>Peso</Text>
          </View>
          {analysis.composition.byAsset.slice(0, 30).map((a, i) => (
            <View style={styles.tableRow} key={i}>
              <Text style={styles.td}>{a.label}</Text>
              <Text style={[styles.td, { flex: 0.5 }]}>
                {assetClassByName.has(a.label) ? assetClassLabel(assetClassByName.get(a.label)!) : ''}
              </Text>
              <Text style={[styles.td, { flex: 0.5, textAlign: 'right' }]}>{(a.weightPct * 100).toFixed(1)}%</Text>
            </View>
          ))}
        </View>
        {analysis.composition.byAsset.length > 30 && (
          <Text style={styles.disclaimer}>
            Mostrando las 30 posiciones de mayor peso de {analysis.composition.byAsset.length} en total; las {analysis.composition.byAsset.length - 30} restantes, de menor peso, no se listan aquí.
          </Text>
        )}

        <Text style={styles.subTitle}>Distribución sectorial</Text>
        {analysis.composition.bySector.slice(0, 10).map((s, i) => (
          <View style={styles.bullet} key={i}>
            <Text style={styles.bulletText}>
              {s.label}: {(s.weightPct * 100).toFixed(1)}%
            </Text>
          </View>
        ))}
        {analysis.composition.bySector.length > 10 && (
          <Text style={styles.disclaimer}>
            Mostrando los 10 sectores de mayor peso de {analysis.composition.bySector.length} en total.
          </Text>
        )}

        <Text style={styles.subTitle}>Distribución geográfica</Text>
        {analysis.composition.byGeography.slice(0, 10).map((s, i) => (
          <View style={styles.bullet} key={i}>
            <Text style={styles.bulletText}>
              {s.label}: {(s.weightPct * 100).toFixed(1)}%
            </Text>
          </View>
        ))}
        {analysis.composition.byGeography.length > 10 && (
          <Text style={styles.disclaimer}>
            Mostrando las 10 regiones de mayor peso de {analysis.composition.byGeography.length} en total.
          </Text>
        )}

        <Text style={styles.sectionTitle}>Diversificación y riesgo</Text>
        <Text style={styles.paragraph}>{analysis.diversification.summary}</Text>
        <Text style={styles.paragraph}>{analysis.risk.summary}</Text>
        {analysis.risk.metrics.map((m, i) => (
          <View style={styles.bullet} key={i}>
            <Text style={styles.bulletText}>
              {m.label}: {m.available && m.value !== undefined ? `${m.value.toFixed(2)}${m.unit}` : 'no disponible'}
            </Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Rentabilidad y benchmark</Text>
        <Text style={styles.paragraph}>Benchmark seleccionado: {analysis.returns.benchmark.name}. {analysis.returns.benchmark.rationale}</Text>
        {analysis.returns.annualizedReturnPct !== undefined ? (
          <Text style={styles.paragraph}>
            Rentabilidad anualizada estimada: {analysis.returns.annualizedReturnPct.toFixed(1)}%. Volatilidad anualizada: {analysis.returns.annualizedVolatilityPct?.toFixed(1)}%.
          </Text>
        ) : (
          <Text style={styles.paragraph}>{analysis.returns.dataCoverageWarning ?? 'Sin datos suficientes para calcular la rentabilidad histórica.'}</Text>
        )}
        <Text style={styles.disclaimer}>{analysis.returns.disclaimer}</Text>

        <Footer />
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Recomendaciones</Text>
        {nonMaintainRecs.length === 0 && <Text style={styles.paragraph}>No se ha identificado ninguna posición que requiera cambio, revisión o vigilancia adicional.</Text>}
        {nonMaintainRecs.map((r) => (
          <View style={styles.recCard} key={r.id} wrap={false}>
            <Text style={styles.badge}>{CATEGORY_LABEL[r.category]} · Confianza {r.confidence.toUpperCase()}</Text>
            <Text style={styles.recTitle}>{r.targetLabel}</Text>
            {r.whatToChange && <Text style={styles.paragraph}>Qué cambiar: {r.whatToChange}</Text>}
            <Text style={styles.paragraph}>Por qué: {r.why}</Text>
            {r.portfolioImpact && <Text style={styles.paragraph}>Impacto: {r.portfolioImpact}</Text>}
            {r.taxOrCostConsiderations && <Text style={styles.paragraph}>Consideraciones fiscales/coste: {r.taxOrCostConsiderations}</Text>}
            <Text style={styles.paragraph}>Confianza: {r.confidenceRationale}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Plan de acción</Text>
        {analysis.actionPlan.noActionNeeded ? (
          <Text style={styles.paragraph}>No es necesaria ninguna acción en este momento.</Text>
        ) : (
          <>
            <Text style={styles.subTitle}>Ahora</Text>
            {analysis.actionPlan.now.map((t, i) => <Text key={i} style={styles.paragraph}>• {t}</Text>)}
            <Text style={styles.subTitle}>Próximos 3 meses</Text>
            {analysis.actionPlan.next3Months.map((t, i) => <Text key={i} style={styles.paragraph}>• {t}</Text>)}
            <Text style={styles.subTitle}>Próximos 6-12 meses</Text>
            {analysis.actionPlan.next6to12Months.map((t, i) => <Text key={i} style={styles.paragraph}>• {t}</Text>)}
          </>
        )}
        <Text style={styles.paragraph}>Rebalanceo: {analysis.actionPlan.rebalancing.rationale}</Text>

        <Footer />
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Fuentes utilizadas</Text>
        {analysis.sources.map((s, i) => (
          <View style={styles.bullet} key={i}>
            <Text style={styles.bulletText}>
              {s.provider} — {new Date(s.retrievedAt).toLocaleDateString('es-ES')} — {s.fieldsUsed.join(', ')}
            </Text>
          </View>
        ))}

        {analysis.dataLimitations.length > 0 && (
          <>
            <Text style={styles.subTitle}>Limitaciones de datos conocidas</Text>
            {analysis.dataLimitations.map((d, i) => (
              <View style={styles.bullet} key={i}>
                <Text style={styles.bulletText}>{d}</Text>
              </View>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>Aviso legal</Text>
        <Text style={styles.disclaimer}>{analysis.disclaimer}</Text>

        <Footer />
      </Page>
    </Document>
  );
}
