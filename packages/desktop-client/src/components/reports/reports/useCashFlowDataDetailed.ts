// @ts-strict-ignore

import { useMemo } from 'react';
import * as d from 'date-fns';
import { type RuleConditionEntity } from 'loot-core/types/models';

import { cashFlowByDate } from '../spreadsheets/cash-flow-spreadsheet';
import { useReport } from '../useReport';
import { futureCashFlowByDate } from '../spreadsheets/future-cash-flow-spreadsheet';
import { useLocale } from '@desktop-client/hooks/useLocale';
import { useFormat } from '@desktop-client/hooks/useFormat';

export const useCashFlowDataDetailed = (
  startMonth: string,
  endMonth: string,
  isConcise: boolean,
  conditions: RuleConditionEntity[] = [],
  conditionsOp: 'and' | 'or',
) => {
  const locale = useLocale();
  const format = useFormat();
  const paramsDetailed = useMemo(() => {
    const today = new Date();
    return d.isAfter(new Date(endMonth), today) ?
      futureCashFlowByDate(startMonth, endMonth, isConcise, conditions, conditionsOp) :
      cashFlowByDate(startMonth, endMonth, isConcise, conditions, conditionsOp, locale, format);
  }, [startMonth, endMonth, isConcise, conditions, conditionsOp, locale, format]);

  return useReport('cash_flow', paramsDetailed);
};
