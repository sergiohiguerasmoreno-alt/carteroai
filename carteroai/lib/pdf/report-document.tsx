import 'server-only';
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ConfirmedPortfolio, InvestorProfile, PortfolioAnalysis } from '@/lib/types';

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

        <Text style={styles.sectionTitle}>Análisis de tu cartera</Text>
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
        <Text style={styles.sectionTitle}>Sugerencias</Text>
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

        {analysis.dataLimitations.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Cosas a comprobar</Text>
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
