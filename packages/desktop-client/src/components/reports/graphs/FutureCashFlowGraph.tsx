import React, { type CSSProperties, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AlignedText } from '@actual-app/components/aligned-text';
import { theme } from '@actual-app/components/theme';
import { css } from '@emotion/css';
import * as d from 'date-fns';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { firstDayOfMonth } from 'loot-core/shared/months';
import {
  amountToCurrency,
  amountToCurrencyNoDecimal,
} from 'loot-core/shared/util';

import { chartTheme } from '@desktop-client/components/reports/chart-theme';
import { Container } from '@desktop-client/components/reports/Container';
import { usePrivacyMode } from '@desktop-client/hooks/usePrivacyMode';

const MAX_BAR_SIZE = 50;
const ANIMATION_DURATION = 1000; // in ms

type PayloadItem = {
  payload: {
    date: Date;
    income: number;
    expenses: number;
    balance: number;
    transfers: number;
    expensesForecast: number;
    incomeForecast: number;
  };
};

type CustomTooltipProps = {
  active?: boolean;
  payload?: PayloadItem[];
  isConcise: boolean;
};

function getFirstDayOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function CustomTooltip({ active, payload, isConcise }: CustomTooltipProps) {
  const { t } = useTranslation();

  if (!active || !payload || !Array.isArray(payload) || !payload[0]) {
    return null;
  }

  const [{ payload: data }] = payload;

  return (
    <div
      className={`${css({
        pointerEvents: 'none',
        borderRadius: 2,
        boxShadow: '0 1px 6px rgba(0, 0, 0, .20)',
        backgroundColor: theme.menuBackground,
        color: theme.menuItemText,
        padding: 10,
      })}`}
    >
      <div>
        <div style={{ marginBottom: 10 }}>
          <strong>
            {d.format(data.date, isConcise ? 'MMMM yyyy' : 'MMMM dd, yyyy')}
          </strong>
        </div>
        <div style={{ lineHeight: 1.5 }}>
          <AlignedText
            left={t('Income:')}
            right={amountToCurrency(
              data.income == 0 ? data.incomeForecast : data.income,
            )}
          />
          <AlignedText
            left={t('Expenses:')}
            right={amountToCurrency(
              data.expenses == 0 ? data.expensesForecast : data.expenses,
            )}
          />
          <AlignedText
            left={t('Change:')}
            right={
              <strong>
                {amountToCurrency(
                  (data.income == 0 ? data.incomeForecast : data.income) +
                    (data.expenses == 0
                      ? data.expensesForecast
                      : data.expenses),
                )}
              </strong>
            }
          />
          {data.transfers !== 0 && (
            <AlignedText
              left={t('Transfers:')}
              right={amountToCurrency(data.transfers)}
            />
          )}
          <AlignedText
            left={t('Balance:')}
            right={amountToCurrency(data.balance)}
          />
        </div>
      </div>
    </div>
  );
}

type CashFlowGraphProps = {
  graphData: {
    expenses: { x: Date; y: number }[];
    income: { x: Date; y: number }[];
    balances: { x: Date; y: number }[];
    transfers: { x: Date; y: number }[];
  };
  isConcise: boolean;
  showBalance?: boolean;
  style?: CSSProperties;
};
export function FutureCashFlowGraph({
  graphData,
  isConcise,
  showBalance = true,
  style,
}: CashFlowGraphProps) {
  const privacyMode = usePrivacyMode();
  const [yAxisIsHovered, setYAxisIsHovered] = useState(false);

  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  //console.log("graphData.expenses => ", graphData.expenses);
  //console.log("graphData.balances => ", graphData.balances);

  const data = useMemo(
    () =>
      graphData.expenses.map((row, idx) => ({
        date: row.x,
        expenses: d.isAfter(row.x, today) ? 0 : row.y,
        income: d.isAfter(row.x, today) ? 0 : graphData.income[idx].y,
        balance: graphData.balances[idx].y,
        transfers: graphData.transfers[idx] ? graphData.transfers[idx].y : 0,
        expensesForecast: d.isAfter(row.x, today) ? row.y : 0,
        incomeForecast: d.isAfter(row.x, today) ? graphData.income[idx].y : 0,
      })),
    [graphData.expenses, graphData.income, graphData.balances, graphData.transfers, today],
  );

  const pastData = useMemo(
    () => data.filter(dt => !d.isAfter(dt.date, today)),
    [data, today],
  );

  const futureData = useMemo(
    () =>
      data.map(dt =>
        !d.isBefore(dt.date, today) ||
        (isConcise && d.isSameDay(dt.date, getFirstDayOfMonth(today)))
          ? dt
          : { ...dt, balance: null },
      ),
    [data, today, isConcise],
  );

  //console.log(today, pastData, data);

  return (
    <Container style={style}>
      {(width, height) => (
        <ResponsiveContainer>
          <ComposedChart
            width={width}
            height={height}
            stackOffset="sign"
            data={data}
          >
            <defs>
              {/* Definizione di un pattern SVG con strisce bianche e rosse diagonali a 45° */}
              <pattern
                id="stripedPatternRed"
                width={8}
                height={8}
                patternUnits="userSpaceOnUse"
              >
                <rect width={8} height={8} fill={chartTheme.colors.red} />
                <line
                  x1={0}
                  y1={8}
                  x2={8}
                  y2={0}
                  stroke="white"
                  strokeWidth={2}
                />
              </pattern>
              {/* Definizione di un pattern SVG con strisce bianche e blu diagonali a 45° */}
              <pattern
                id="stripedPatternBlue"
                width={8}
                height={8}
                patternUnits="userSpaceOnUse"
              >
                <rect width={8} height={8} fill={chartTheme.colors.blue} />
                <line
                  x1={0}
                  y1={8}
                  x2={8}
                  y2={0}
                  stroke="white"
                  strokeWidth={2}
                />
              </pattern>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              allowDuplicatedCategory={false}
              dataKey="date"
              tick={{ fill: theme.reportsLabel }}
              tickFormatter={x => {
                // eslint-disable-next-line rulesdir/typography
                return d.format(x, isConcise ? "MMM ''yy" : 'MMM d');
              }}
              minTickGap={50}
            />
            <YAxis
              tick={{ fill: theme.reportsLabel }}
              tickCount={8}
              tickFormatter={value =>
                privacyMode && !yAxisIsHovered
                  ? '...'
                  : amountToCurrencyNoDecimal(value)
              }
              onMouseEnter={() => setYAxisIsHovered(true)}
              onMouseLeave={() => setYAxisIsHovered(false)}
            />
            <Tooltip
              labelFormatter={x => {
                // eslint-disable-next-line rulesdir/typography
                return d.format(x, isConcise ? "MMM ''yy" : 'MMM d');
              }}
              content={<CustomTooltip isConcise={isConcise} />}
              isAnimationActive={false}
            />

            <ReferenceLine y={0} stroke="#000" />
            <Bar
              dataKey="income"
              stackId="a"
              fill={chartTheme.colors.blue}
              maxBarSize={MAX_BAR_SIZE}
              animationDuration={ANIMATION_DURATION}
            />
            <Bar
              dataKey="expenses"
              stackId="a"
              fill={chartTheme.colors.red}
              maxBarSize={MAX_BAR_SIZE}
              animationDuration={ANIMATION_DURATION}
            />

            <Bar
              dataKey="incomeForecast"
              stackId="a"
              fill="url(#stripedPatternBlue)"
              maxBarSize={MAX_BAR_SIZE}
              animationDuration={ANIMATION_DURATION}
              opacity="0.7"
            />
            <Bar
              dataKey="expensesForecast"
              stackId="a"
              fill="url(#stripedPatternRed)"
              maxBarSize={MAX_BAR_SIZE}
              animationDuration={ANIMATION_DURATION}
              opacity="0.7"
            />

            <Line
              type="monotone"
              isAnimationActive={false}
              data={pastData}
              dataKey="balance"
              strokeDasharray="none"
              dot={false}
              hide={!showBalance}
              stroke={theme.pageTextLight}
              strokeWidth={2}
              animationDuration={ANIMATION_DURATION}
            />

            <Line
              type="monotone"
              data={futureData}
              dataKey="balance"
              dot={false}
              hide={!showBalance}
              stroke={theme.pageTextLight}
              strokeWidth={2}
              strokeDasharray="5 5"
              animationDuration={ANIMATION_DURATION}
              activeDot={{ fill: 'red', r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </Container>
  );
}
