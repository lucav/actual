import { Menu } from '@actual-app/components/menu';
import { describe, expect, it } from 'vitest';

import { getDashboardWidgetItems } from './getDashboardWidgetItems';

function getNames(items: ReturnType<typeof getDashboardWidgetItems>) {
  return items.filter(item => item !== Menu.line).map(item => item.name);
}

const baseParams = {
  t: (value: string) => value,
  customReports: [] as { id: string; name: string }[],
  formulaMode: false,
  crossoverReportEnabled: false,
  budgetAnalysisReportEnabled: false,
  balanceForecastReportEnabled: false,
  cashFlowForecastReportEnabled: false,
};

describe('getDashboardWidgetItems', () => {
  it('includes the balance forecast card only when the flag is enabled', () => {
    const disabled = getDashboardWidgetItems(baseParams);

    const enabled = getDashboardWidgetItems({
      ...baseParams,
      balanceForecastReportEnabled: true,
    });

    expect(getNames(disabled)).not.toContain('balance-forecast-card');
    expect(getNames(enabled)).toContain('balance-forecast-card');
  });

  it('includes the cash flow forecast card only when the flag is enabled', () => {
    const disabled = getDashboardWidgetItems(baseParams);

    const enabled = getDashboardWidgetItems({
      ...baseParams,
      cashFlowForecastReportEnabled: true,
    });

    expect(getNames(disabled)).not.toContain('cash-flow-card-forecast');
    expect(getNames(enabled)).toContain('cash-flow-card-forecast');
  });

  it('keeps custom report entries after a divider', () => {
    const items = getDashboardWidgetItems({
      ...baseParams,
      customReports: [{ id: 'abc', name: 'Custom Budget Review' }],
    });

    expect(items).toContain(Menu.line);
    expect(getNames(items)).toContain('custom-report-abc');
  });
});
