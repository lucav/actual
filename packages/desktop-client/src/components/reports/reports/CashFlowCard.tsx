import React, { useState, useMemo, useCallback } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import * as d from 'date-fns';
import { type TFunction } from 'i18next';
import { Bar, BarChart, LabelList, ResponsiveContainer } from 'recharts';

import { integerToCurrency } from 'loot-core/src/shared/util';
import { type CashFlowWidget } from 'loot-core/src/types/models';

import { useFeatureFlag } from '../../../hooks/useFeatureFlag';
import { theme } from '../../../style';
import { AlignedText } from '../../common/AlignedText';
import { Block } from '../../common/Block';
import { Text } from '../../common/Text';
import { View } from '../../common/View';
import { PrivacyFilter } from '../../PrivacyFilter';
import { Change } from '../Change';
import { chartTheme } from '../chart-theme';
import { Container } from '../Container';
import { DateRange } from '../DateRange';
import { CashFlowGraph } from '../graphs/CashFlowGraph';
import { LoadingIndicator } from '../LoadingIndicator';
import { ReportCard } from '../ReportCard';
import { ReportCardName } from '../ReportCardName';
import { calculateTimeRange } from '../reportRanges';
import {
  cashFlowByDate,
  simpleCashFlow,
} from '../spreadsheets/cash-flow-spreadsheet';
import { useReport } from '../useReport';

import { defaultTimeFrame } from './CashFlow';

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

function retViewCondensed(
  isCardHovered: boolean,
  income: number,
  expenses: number,
) {
  return (
    <View style={{ textAlign: 'right' }}>
      <PrivacyFilter activationFilters={[!isCardHovered]}>
        <Change amount={income - expenses} />
      </PrivacyFilter>
    </View>
  );
}

function retChartCondensed(
  width: number,
  height: number,
  income: number,
  expenses: number,
  t: TFunction,
) {
  return (
    <BarChart
      width={width}
      height={height}
      data={[
        {
          income,
          expenses,
        },
      ]}
      margin={{
        top: 10,
        bottom: 0,
      }}
    >
      <Bar dataKey="income" fill={chartTheme.colors.blue} barSize={14}>
        <LabelList
          dataKey="income"
          position="left"
          content={<CustomLabel name={t('Income')} />}
        />
      </Bar>

      <Bar dataKey="expenses" fill={chartTheme.colors.red} barSize={14}>
        <LabelList
          dataKey="expenses"
          position="right"
          content={<CustomLabel name={t('Expenses')} />}
        />
      </Bar>
    </BarChart>
  );
}

function retViewDetailed(
  totalIncome: number,
  totalExpenses: number,
  totalTransfers: number,
  isCardHovered: boolean,
) {
  return (
    <View
      style={{
        paddingTop: 20,
        alignItems: 'flex-end',
        color: theme.pageText,
      }}
    >
      <AlignedText
        style={{ marginBottom: 5, minWidth: 160 }}
        left={
          <Block>
            <Trans>Income:</Trans>
          </Block>
        }
        right={
          <Text style={{ fontWeight: 600 }}>
            <PrivacyFilter>{integerToCurrency(totalIncome)}</PrivacyFilter>
          </Text>
        }
      />

      <AlignedText
        style={{ marginBottom: 5, minWidth: 160 }}
        left={
          <Block>
            <Trans>Expenses:</Trans>
          </Block>
        }
        right={
          <Text style={{ fontWeight: 600 }}>
            <PrivacyFilter>{integerToCurrency(totalExpenses)}</PrivacyFilter>
          </Text>
        }
      />

      <AlignedText
        style={{ marginBottom: 5, minWidth: 160 }}
        left={
          <Block>
            <Trans>Transfers:</Trans>
          </Block>
        }
        right={
          <Text style={{ fontWeight: 600 }}>
            <PrivacyFilter>{integerToCurrency(totalTransfers)}</PrivacyFilter>
          </Text>
        }
      />
      <Text style={{ fontWeight: 600 }}>
        <PrivacyFilter activationFilters={[!isCardHovered]}>
          <Change amount={totalIncome + totalExpenses + totalTransfers} />
        </PrivacyFilter>
      </Text>
    </View>
  );
}

function retChartDetailed(
  graphData: {
    expenses: { x: Date; y: number }[];
    income: { x: Date; y: number }[];
    balances: { x: Date; y: number }[];
    transfers: { x: Date; y: number }[];
  },
  isConcise: boolean,
) {
  return (
    <CashFlowGraph
      graphData={graphData}
      isConcise={isConcise}
      showBalance={true}
    />
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
  const isDashboardsFeatureEnabled = useFeatureFlag('dashboards');
  const { t } = useTranslation();

  const [start, end] = calculateTimeRange(meta?.timeFrame, defaultTimeFrame);
  const [nameMenuOpen, setNameMenuOpen] = useState(false);

  const isConcise = (() => {
    const numDays = d.differenceInCalendarDays(
      d.parseISO(end),
      d.parseISO(start),
    );
    return numDays > 31 * 3;
  })();

  const [isCardHovered, setIsCardHovered] = useState(false);
  const onCardHover = useCallback(() => setIsCardHovered(true), []);
  const onCardHoverEnd = useCallback(() => setIsCardHovered(false), []);

  const paramsCondensed = useMemo(
    () =>
      simpleCashFlow(start, end, meta?.conditions, meta?.conditionsOp ?? 'and'),
    [start, end, meta?.conditions, meta?.conditionsOp],
  );

  const dataCondensed = useReport('cash_flow_simple', paramsCondensed);

  const paramsDetailed = useMemo(
    () =>
      cashFlowByDate(
        start,
        end,
        isConcise,
        meta?.conditions,
        meta?.conditionsOp ?? 'and',
      ),
    [start, end, isConcise, meta?.conditions, meta?.conditionsOp],
  );

  const dataDetailed = useReport('cash_flow', paramsDetailed);

  let dataOk: boolean = false,
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

  if (meta && meta?.isCondensed !== undefined && meta?.isCondensed === false) {
    graphDataDetailed = dataDetailed?.graphData || {
      expenses: [{ x: new Date(), y: 0 }],
      income: [{ x: new Date(), y: 0 }],
      balances: [{ x: new Date(), y: 0 }],
      transfers: [{ x: new Date(), y: 0 }],
    };
    totalExpenses = dataDetailed?.totalExpenses || 0;
    totalIncome = dataDetailed?.totalIncome || 0;
    totalTransfers = dataDetailed?.totalTransfers || 0;
    dataOk = dataDetailed ? true : false;
  } else {
    const graphData = dataCondensed?.graphData || null;
    income = graphData?.income || 0;
    expenses = -(graphData?.expense || 0);
    dataOk = graphData ? true : false;
  }

  return (
    <ReportCard
      isEditing={isEditing}
      to={
        isDashboardsFeatureEnabled
          ? `/reports/cash-flow/${widgetId}`
          : '/reports/cash-flow'
      }
      menuItems={[
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
            (meta?.isCondensed || meta?.isCondensed === undefined
              ? retViewCondensed(isCardHovered, income, expenses)
              : retViewDetailed(
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
                {meta?.isCondensed || meta?.isCondensed === undefined
                  ? retChartCondensed(width, height, income, expenses, t)
                  : retChartDetailed(graphDataDetailed, isConcise)}
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
