// @ts-strict-ignore

import { useMemo } from 'react';
import * as d from 'date-fns';
import { type RuleConditionEntity } from 'loot-core/types/models';

import { cashFlowByDate } from '../spreadsheets/cash-flow-spreadsheet';
import { useReport } from '../useReport';
import { futureCashFlowByDate } from '../spreadsheets/future-cash-flow-spreadsheet';

export const useCashFlowDataDetailed = (
  startMonth: string,
  endMonth: string,
  isConcise: boolean,
  conditions: RuleConditionEntity[] = [],
  conditionsOp: 'and' | 'or',
) => {
  const today = new Date();
  const paramsDetailed = useMemo(
    () => 
      (d.isAfter(new Date(endMonth), today) ?
      futureCashFlowByDate(startMonth, endMonth, isConcise, conditions, conditionsOp) :
      cashFlowByDate(startMonth, endMonth, isConcise, conditions, conditionsOp)),
    [startMonth, endMonth, isConcise, conditions, conditionsOp],
  );

  return useReport('cash_flow', paramsDetailed);
};
