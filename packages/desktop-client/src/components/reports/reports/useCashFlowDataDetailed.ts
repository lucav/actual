// @ts-strict-ignore

import { useMemo } from 'react';

import * as d from 'date-fns';

import { type RuleConditionEntity } from 'loot-core/types/models';

import { cashFlowByDate } from '@desktop-client/components/reports/spreadsheets/cash-flow-spreadsheet';
import { futureCashFlowByDate } from '@desktop-client/components/reports/spreadsheets/future-cash-flow-spreadsheet';
import { useReport } from '@desktop-client/components/reports/useReport';
import { useFormat } from '@desktop-client/hooks/useFormat';
import { useLocale } from '@desktop-client/hooks/useLocale';

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

  return useReport('cash_flow', paramsDetailed);
};
