import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { View } from '@actual-app/components/view';
import * as d from 'date-fns';
import { ResponsiveContainer } from 'recharts';

import { type CashFlowForecastWidget } from 'loot-core/types/models';

import { defaultTimeFrame } from './CashFlowForecast';
import { renderCashFlowCardChartCondensed } from './renderCashFlowCardChartCondensed';
import { renderCashFlowCardChartDetailed } from './renderCashFlowCardChartDetailed';
import { renderCashFlowCardViewCondensed } from './renderCashFlowCardViewCondensed';
import { renderCashFlowCardViewDetailed } from './renderCashFlowCardViewDetailed';
import { useCashFlowDataDetailed } from './useCashFlowDataDetailed';

import { Container } from '@desktop-client/components/reports/Container';
import { DateRange } from '@desktop-client/components/reports/DateRange';
import { LoadingIndicator } from '@desktop-client/components/reports/LoadingIndicator';
import { ReportCard } from '@desktop-client/components/reports/ReportCard';
import { ReportCardName } from '@desktop-client/components/reports/ReportCardName';
import { calculateTimeRange } from '@desktop-client/components/reports/reportRanges';
import { simpleCashFlow } from '@desktop-client/components/reports/spreadsheets/cash-flow-spreadsheet';
import { useReport } from '@desktop-client/components/reports/useReport';

type CashFlowCardForecastProps = {
  widgetId: string;
  isEditing?: boolean;
  meta?: CashFlowForecastWidget['meta'];
  onMetaChange: (newMeta: CashFlowForecastWidget['meta']) => void;
  onRemove: () => void;
};

export function CashFlowCardForecast({
  widgetId,
  isEditing,
  meta = {},
  onMetaChange,
  onRemove,
}: CashFlowCardForecastProps) {
  const { t } = useTranslation();

  const MIN_DETAILED_CHART_HEIGHT = 290;

  // Usa i valori salvati nel widget se disponibili, altrimenti calcola i valori di default
  const [defaultStart, defaultEnd] = calculateTimeRange(
    meta?.timeFrame,
    defaultTimeFrame,
  );
  const start = meta?.timeFrame?.start || defaultStart;
  const end = meta?.timeFrame?.end || defaultEnd;
  
  // Assicurati che start e end siano sempre definiti
  if (!start || !end) {
    console.error('CashFlowCardForecast - start o end non definiti:', { start, end, meta });
    return <LoadingIndicator />;
  }
  
  // mode per la visualizzazione della card (condensed/full), non per il timeFrame
  const cardMode = meta?.mode;
  const [nameMenuOpen, setNameMenuOpen] = useState(false);

  const numDays = d.differenceInCalendarDays(
    d.parseISO(end),
    d.parseISO(start),
  );
  const isConcise = numDays > 31 * 3;

  const [isCardHovered, setIsCardHovered] = useState(false);
  const onCardHover = useCallback(() => setIsCardHovered(true), []);
  const onCardHoverEnd = useCallback(() => setIsCardHovered(false), []);

  const paramsCondensed = useMemo(
    () =>
      simpleCashFlow(start, end, meta?.conditions, meta?.conditionsOp ?? 'and'),
    [start, end, meta?.conditions, meta?.conditionsOp],
  );

  const dataCondensed = useReport('cash_flow_simple', paramsCondensed);

  const dataDetailed = useCashFlowDataDetailed(
    start,
    end,
    isConcise,
    meta?.conditions,
    meta?.conditionsOp ?? 'and',
  );

  // Memoizza graphDataDetailed per evitare re-render infiniti
  const defaultGraphData = useMemo(
    () => ({
      expenses: [{ x: new Date(), y: 0 }],
      income: [{ x: new Date(), y: 0 }],
      balances: [{ x: new Date(), y: 0 }],
      transfers: [{ x: new Date(), y: 0 }],
    }),
    [],
  );

  const switchFlag = useMemo(
    () => meta && cardMode !== undefined && cardMode === 'full',
    [meta, cardMode],
  );

  const graphDataDetailed = useMemo(() => {
    if (switchFlag && dataDetailed?.graphData) {
      return dataDetailed.graphData;
    }
    return defaultGraphData;
  }, [switchFlag, dataDetailed?.graphData, defaultGraphData]);

  const totalExpenses = useMemo(
    () => (switchFlag ? dataDetailed?.totalExpenses || 0 : 0),
    [switchFlag, dataDetailed?.totalExpenses],
  );

  const totalIncome = useMemo(
    () => (switchFlag ? dataDetailed?.totalIncome || 0 : 0),
    [switchFlag, dataDetailed?.totalIncome],
  );

  const totalTransfers = useMemo(
    () => (switchFlag ? dataDetailed?.totalTransfers || 0 : 0),
    [switchFlag, dataDetailed?.totalTransfers],
  );

  const graphDataCondensed = dataCondensed?.graphData || null;
  const income = useMemo(
    () => graphDataCondensed?.income || 0,
    [graphDataCondensed?.income],
  );
  const expenses = useMemo(
    () => -(graphDataCondensed?.expense || 0),
    [graphDataCondensed?.expense],
  );

  const dataOk = useMemo(() => {
    if (switchFlag) {
      return Boolean(dataDetailed);
    }
    if (graphDataCondensed && (cardMode === 'condensed' || cardMode === undefined)) {
      return true;
    }
    return false;
  }, [switchFlag, dataDetailed, graphDataCondensed, cardMode]);

  const isCondensedMode = (mode: string | undefined, height: number) =>
    mode === 'condensed' ||
    mode === undefined ||
    height < MIN_DETAILED_CHART_HEIGHT;

  return (
    <ReportCard
      isEditing={isEditing}
      disableClick={nameMenuOpen}
      to={`/reports/cash-flow-forecast/${widgetId}`}
      menuItems={[
        {
          name: 'change-view',
          text: switchFlag
            ? t('Switch to condensed graph')
            : t('Switch to detailed graph'),
        },
        {
          name: 'rename',
          text: t('Rename'),
        },
        {
          name: 'remove',
          text: t('Remove'),
        },
      ]}
      onMenuSelect={item => {
        switch (item) {
          case 'change-view': {
            const newValue = switchFlag ? 'condensed' : 'full';
            onMetaChange({
              ...meta,
              mode: newValue,
            });
            break;
          }
          case 'rename':
            setNameMenuOpen(true);
            break;
          case 'remove':
            onRemove();
            break;
          default:
            throw new Error(`Unrecognized selection: ${item}`);
        }
      }}
    >
      <View
        style={{ flex: 1 }}
        onPointerEnter={onCardHover}
        onPointerLeave={onCardHoverEnd}
      >
        <View style={{ flexDirection: 'row', padding: 20 }}>
          <View style={{ flex: 1 }}>
            <ReportCardName
              name={meta?.name || t('Cash Flow')}
              isEditing={nameMenuOpen}
              onChange={newName => {
                onMetaChange({
                  ...meta,
                  name: newName,
                });
                setNameMenuOpen(false);
              }}
              onClose={() => setNameMenuOpen(false)}
            />
            <DateRange start={start} end={end} />
          </View>
          {dataOk &&
            (cardMode === 'condensed' || cardMode === undefined
              ? renderCashFlowCardViewCondensed(isCardHovered, income, expenses)
              : renderCashFlowCardViewDetailed(
                  totalIncome,
                  totalExpenses,
                  totalTransfers,
                  isCardHovered,
                ))}
        </View>

        {dataOk ? (
          cardMode === 'full' ? (
            // FutureCashFlowGraph ha già il suo Container interno, passiamo lo stile per farlo espandere
            renderCashFlowCardChartDetailed(
              graphDataDetailed,
              isConcise,
              { flex: 1, minHeight: MIN_DETAILED_CHART_HEIGHT },
            )
          ) : (
            <Container style={{ flex: 1, minHeight: MIN_DETAILED_CHART_HEIGHT }}>
              {(width, height) => (
                width > 0 && height > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    {renderCashFlowCardChartCondensed(
                      width,
                      height,
                      income,
                      expenses,
                      t,
                      false,
                    )}
                  </ResponsiveContainer>
                ) : null
              )}
            </Container>
          )
        ) : (
          <LoadingIndicator />
        )}
      </View>
    </ReportCard>
  );
}
