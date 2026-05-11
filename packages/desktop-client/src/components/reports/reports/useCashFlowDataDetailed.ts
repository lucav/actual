// @ts-strict-ignore

import { useMemo, type JSX } from 'react';

import * as d from 'date-fns';

import { type RuleConditionEntity } from '@actual-app/core/types/models';

import { cashFlowByDate } from '#components/reports/spreadsheets/cash-flow-spreadsheet';
import { useReport } from '#components/reports/useReport';
import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';

import { futureCashFlowByDate } from '../spreadsheets/future-cash-flow-spreadsheet';

export type CashFlowData = {
  graphData: {
    expenses: Array<{ x: Date; y: number }>;
    income: Array<{ x: Date; y: number }>;
    transfers: Array<{ x: Date; y: number }>;
    balances: Array<{
      x: Date;
      y: number;
      premadeLabel: JSX.Element;
      amount: number;
    }>;
  };
  balance: number;
  totalExpenses: number;
  totalIncome: number;
  totalTransfers: number;
  totalChange: number;
};

type CashFlowReportLoader = Parameters<typeof useReport<CashFlowData>>[1];

export const useCashFlowDataDetailed = (
  startMonth: string,
  endMonth: string,
  isConcise: boolean,
  conditions: RuleConditionEntity[] = [],
  conditionsOp: 'and' | 'or',
) => {
  const locale = useLocale();
  const format = useFormat();
  const paramsDetailed = useMemo<CashFlowReportLoader>(() => {
    const today = new Date();
    return d.isAfter(new Date(endMonth), today)
      ? futureCashFlowByDate(
          startMonth,
          endMonth,
          isConcise,
          conditions,
          conditionsOp,
        )
      : cashFlowByDate(
          startMonth,
          endMonth,
          isConcise,
          conditions,
          conditionsOp,
          locale,
          format,
        );
  }, [
    startMonth,
    endMonth,
    isConcise,
    conditions,
    conditionsOp,
    locale,
    format,
  ]);

  return useReport<CashFlowData>('cash_flow', paramsDetailed);
};
