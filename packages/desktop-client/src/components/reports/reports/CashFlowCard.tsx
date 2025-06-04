import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import * as d from 'date-fns';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { ResponsiveContainer } from 'recharts';

import { integerToCurrency } from 'loot-core/shared/util';
import { type CashFlowWidget } from 'loot-core/types/models';

import { defaultTimeFrame } from './CashFlow';
import { renderCashFlowCardChartCondensed } from './renderCashFlowCardChartCondensed';
import { renderCashFlowCardChartDetailed } from './renderCashFlowCardChartDetailed';
import { renderCashFlowCardViewCondensed } from './renderCashFlowCardViewCondensed';
import { renderCashFlowCardViewDetailed } from './renderCashFlowCardViewDetailed';
import { useCashFlowDataDetailed } from './useCashFlowDataDetailed';

import { PrivacyFilter } from '@desktop-client/components/PrivacyFilter';
import { Change } from '@desktop-client/components/reports/Change';
import { chartTheme } from '@desktop-client/components/reports/chart-theme';
import { Container } from '@desktop-client/components/reports/Container';
import { DateRange } from '@desktop-client/components/reports/DateRange';
import { LoadingIndicator } from '@desktop-client/components/reports/LoadingIndicator';
import { ReportCard } from '@desktop-client/components/reports/ReportCard';
import { ReportCardName } from '@desktop-client/components/reports/ReportCardName';
import { calculateTimeRange } from '@desktop-client/components/reports/reportRanges';
import { simpleCashFlow } from '@desktop-client/components/reports/spreadsheets/cash-flow-spreadsheet';
import { useReport } from '@desktop-client/components/reports/useReport';

type CustomLabelProps = {
  value?: number;
  name: string;
  position?: 'left' | 'right';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

function CustomLabel({
  value = 0,
  name,
  position = 'left',
  x = 0,
  y = 0,
  width: barWidth = 0,
  height: barHeight = 0,
}: CustomLabelProps) {
  const valueLengthOffset = 20;

  const yOffset = barHeight < 25 ? 105 : y;

  const labelXOffsets = {
    right: 6,
    left: -valueLengthOffset + 1,
  };

  const valueXOffsets = {
    right: 6,
    left: -valueLengthOffset + 2,
  };

  const anchorValue = {
    right: 'start',
    left: 'end',
  };

  return (
    <>
      <text
        x={x + barWidth + labelXOffsets[position]}
        y={yOffset + 10}
        textAnchor={anchorValue[position]}
        fill={theme.tableText}
      >
        {name}
      </text>
      <text
        x={x + barWidth + valueXOffsets[position]}
        y={yOffset + 26}
        textAnchor={anchorValue[position]}
        fill={theme.tableText}
      >
        <PrivacyFilter>{integerToCurrency(value)}</PrivacyFilter>
      </text>
    </>
  );
}

type CashFlowCardProps = {
  widgetId: string;
  isEditing?: boolean;
  meta?: CashFlowWidget['meta'];
  onMetaChange: (newMeta: CashFlowWidget['meta']) => void;
  onRemove: () => void;
};

export function CashFlowCard({
  widgetId,
  isEditing,
  meta = {},
  onMetaChange,
  onRemove,
}: CashFlowCardProps) {
  const { t } = useTranslation();

  const MIN_DETAILED_CHART_HEIGHT = 290;

  const [start, end] = calculateTimeRange(meta?.timeFrame, defaultTimeFrame);
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

  let dataOk: boolean = false,
    switchFlag: boolean = false,
    graphDataDetailed = {
      expenses: [{ x: new Date(), y: 0 }],
      income: [{ x: new Date(), y: 0 }],
      balances: [{ x: new Date(), y: 0 }],
      transfers: [{ x: new Date(), y: 0 }],
    },
    totalExpenses: number = 0,
    totalIncome: number = 0,
    totalTransfers: number = 0,
    expenses: number = 0,
    income: number = 0;

  if (meta && meta?.mode !== undefined && meta?.mode === 'full') {
    switchFlag = true;
    graphDataDetailed = dataDetailed?.graphData || {
      expenses: [{ x: new Date(), y: 0 }],
      income: [{ x: new Date(), y: 0 }],
      balances: [{ x: new Date(), y: 0 }],
      transfers: [{ x: new Date(), y: 0 }],
    };
    totalExpenses = dataDetailed?.totalExpenses || 0;
    totalIncome = dataDetailed?.totalIncome || 0;
    totalTransfers = dataDetailed?.totalTransfers || 0;
    dataOk = Boolean(dataDetailed);
  }

  const isCondensedMode = (mode: string | undefined, height: number) =>
    mode === 'condensed' ||
    mode === undefined ||
    height < MIN_DETAILED_CHART_HEIGHT;

  const graphDataCondensed = dataCondensed?.graphData || null;
  income = graphDataCondensed?.income || 0;
  expenses = -(graphDataCondensed?.expense || 0);
  if (
    graphDataCondensed &&
    (meta?.mode === 'condensed' || meta?.mode === undefined)
  ) {
    dataOk = true;
  }

  return (
    <ReportCard
      isEditing={isEditing}
      disableClick={nameMenuOpen}
      to={`/reports/cash-flow/${widgetId}`}
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
            (meta?.mode === 'condensed' || meta?.mode === undefined
              ? renderCashFlowCardViewCondensed(isCardHovered, income, expenses)
              : renderCashFlowCardViewDetailed(
                  totalIncome,
                  totalExpenses,
                  totalTransfers,
                  isCardHovered,
                ))}
        </View>

        {dataOk ? (
          <Container style={{ height: 'auto', flex: 1 }}>
            {(width, height) => (
              <ResponsiveContainer>
                {isCondensedMode(meta?.mode, height)
                  ? renderCashFlowCardChartCondensed(
                      width,
                      height,
                      income,
                      expenses,
                      t,
                      Boolean(
                        height < MIN_DETAILED_CHART_HEIGHT &&
                          meta?.mode === 'full',
                      ),
                    )
                  : renderCashFlowCardChartDetailed(
                      graphDataDetailed,
                      isConcise,
                    )}
              </ResponsiveContainer>
            )}
          </Container>
        ) : (
          <LoadingIndicator />
        )}
      </View>
    </ReportCard>
  );
}
