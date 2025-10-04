import React, { useState, useEffect } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { AlignedText } from '@actual-app/components/aligned-text';
import { Block } from '@actual-app/components/block';
import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { Paragraph } from '@actual-app/components/paragraph';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as d from 'date-fns';

import { send } from 'loot-core/platform/client/fetch';
import * as monthUtils from 'loot-core/shared/months';
import {
  type CashFlowForecastWidget,
  type RuleConditionEntity,
  type TimeFrame,
} from 'loot-core/types/models';

import { useCashFlowDataDetailed } from './useCashFlowDataDetailed';

import { EditablePageHeaderTitle } from '@desktop-client/components/EditablePageHeaderTitle';
import { MobileBackButton } from '@desktop-client/components/mobile/MobileBackButton';
import {
  MobilePageHeader,
  Page,
  PageHeader,
} from '@desktop-client/components/Page';
import { PrivacyFilter } from '@desktop-client/components/PrivacyFilter';
import { Change } from '@desktop-client/components/reports/Change';
import { CashFlowGraph } from '@desktop-client/components/reports/graphs/CashFlowGraph';
import { FutureCashFlowGraph } from '@desktop-client/components/reports/graphs/FutureCashFlowGraph';
import { Header } from '@desktop-client/components/reports/Header';
import { LoadingIndicator } from '@desktop-client/components/reports/LoadingIndicator';
import { calculateTimeRange } from '@desktop-client/components/reports/reportRanges';
import { useFormat } from '@desktop-client/hooks/useFormat';
import { useLocale } from '@desktop-client/hooks/useLocale';
import { useNavigate } from '@desktop-client/hooks/useNavigate';
import { useRuleConditionFilters } from '@desktop-client/hooks/useRuleConditionFilters';
import { useSyncedPref } from '@desktop-client/hooks/useSyncedPref';
import { useWidget } from '@desktop-client/hooks/useWidget';
import { addNotification } from '@desktop-client/notifications/notificationsSlice';
import { useDispatch } from '@desktop-client/redux';

export const defaultTimeFrame = {
  start: monthUtils.dayFromDate(monthUtils.currentMonth()),
  end: monthUtils.currentDay(),
  mode: 'sliding-window',
} satisfies TimeFrame;

export function CashFlowForecast() {
  const params = useParams();
  const { data: widget, isLoading } = useWidget<CashFlowForecastWidget>(
    params.id ?? '',
    'cash-flow-card-forecast',
  );

  if (isLoading) {
    return <LoadingIndicator />;
  }

  return <CashFlowInner widget={widget} />;
}

type CashFlowInnerProps = {
  widget?: CashFlowForecastWidget;
};

function CashFlowInner({ widget }: CashFlowInnerProps) {
  const locale = useLocale();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const format = useFormat();

  const {
    conditions,
    conditionsOp,
    onApply: onApplyFilter,
    onDelete: onDeleteFilter,
    onUpdate: onUpdateFilter,
    onConditionsOpChange,
  } = useRuleConditionFilters<RuleConditionEntity>(
    widget?.meta?.conditions,
    widget?.meta?.conditionsOp,
  );

  const [allMonths, setAllMonths] = useState<null | Array<{
    name: string;
    pretty: string;
  }>>(null);

  const offset = widget?.meta?.timeFrame?.forecastOffsetMonths ?? 0;

  const [initialStart, initialEnd, initialMode] = calculateTimeRange(
    widget?.meta?.timeFrame,
    defaultTimeFrame,
  );
  
  // Usa i valori salvati nel widget se disponibili, altrimenti usa i valori calcolati
  const [start, setStart] = useState(
    widget?.meta?.timeFrame?.start || initialStart
  );
  const [end, setEnd] = useState(
    widget?.meta?.timeFrame?.end || initialEnd
  );
  const [mode, setMode] = useState(
    widget?.meta?.timeFrame?.mode || initialMode
  );
  const [showBalance, setShowBalance] = useState(
    widget?.meta?.showBalance ?? true,
  );
  const today = new Date();
  const [isFutureCashFlow, setisFutureCashFlow] = useState(() => {
    const endDate = widget?.meta?.timeFrame?.end || initialEnd;
    return d.isAfter(new Date(endDate), today);
  });
  const [forecastOffsetMonths, setForecastOffsetMonths] = useState(offset);

  const [isConcise, setIsConcise] = useState(() => {
    const numDays = d.differenceInCalendarDays(
      d.parseISO(end),
      d.parseISO(start),
    );
    return numDays > 31 * 3;
  });

  const data = useCashFlowDataDetailed(
    start,
    end,
    isConcise,
    conditions,
    conditionsOp,
  );

  useEffect(() => {
    async function run() {
      const earliestTrans = await send('get-earliest-transaction');
      const _latestTrans = await send('get-latest-transaction');

      const earliestMonth = earliestTrans
        ? monthUtils.monthFromDate(d.parseISO(earliestTrans.date))
        : monthUtils.currentMonth();

      const ddate = new Date();
      ddate.setMonth(ddate.getMonth() + 6);

      const allMonths = monthUtils
        .rangeInclusive(earliestMonth, d.format(ddate, 'yyyy-MM'))
        .map(month => ({
          name: month,
          pretty: monthUtils.format(month, 'MMMM, yyyy', locale),
        }))
        .reverse();

      setAllMonths(allMonths);
    }
    run();
  }, [locale]);

  function onChangeDates(start: string, end: string, mode: TimeFrame['mode']) {
    const numDays = d.differenceInCalendarDays(
      d.parseISO(end),
      d.parseISO(start),
    );
    const isConcise = numDays > 31 * 3;
    const today = new Date();

    setStart(start);
    setEnd(end);

    setIsConcise(isConcise);
    if (d.isAfter(new Date(end), today)) {
      setisFutureCashFlow(true);
      setMode('sliding-window');
      const offset = monthUtils.differenceInCalendarMonths(end, today);
      setForecastOffsetMonths(offset);
    } else {
      setMode(mode);
      setisFutureCashFlow(false);
    }
  }

  const navigate = useNavigate();
  const { isNarrowWidth } = useResponsive();

  async function onSaveWidget() {
    if (!widget) {
      throw new Error('No widget that could be saved.');
    }

    await send('dashboard-update-widget', {
      id: widget.id,
      meta: {
        ...(widget.meta ?? {}),
        conditions,
        conditionsOp,
        timeFrame: {
          start,
          end,
          mode,
          forecastOffsetMonths,
        },
        showBalance,
      },
    });
    dispatch(
      addNotification({
        notification: {
          type: 'message',
          message: t('Dashboard widget successfully saved.'),
        },
      }),
    );
  }

  const title = widget?.meta?.name || t('Cash Flow');
  const onSaveWidgetName = async (newName: string) => {
    if (!widget) {
      throw new Error('No widget that could be saved.');
    }

    const name = newName || t('Cash Flow');
    await send('dashboard-update-widget', {
      id: widget.id,
      meta: {
        ...(widget.meta ?? {}),
        name,
      },
    });
  };

  const [earliestTransaction, _] = useState('');
  const [latestTransaction, __] = useState('');
  const [_firstDayOfWeekIdx] = useSyncedPref('firstDayOfWeekIdx');
  const firstDayOfWeekIdx = _firstDayOfWeekIdx || '0';

  if (!allMonths || !data) {
    return null;
  }

  const { graphData, totalExpenses, totalIncome, totalTransfers } = data;

  return (
    <Page
      header={
        isNarrowWidth ? (
          <MobilePageHeader
            title={title}
            leftContent={
              <MobileBackButton onPress={() => navigate('/reports')} />
            }
          />
        ) : (
          <PageHeader
            title={
              widget ? (
                <EditablePageHeaderTitle
                  title={title}
                  onSave={onSaveWidgetName}
                />
              ) : (
                title
              )
            }
          />
        )
      }
      padding={0}
    >
      <Header
        allMonths={allMonths}
        start={start}
        end={end}
        earliestTransaction={earliestTransaction}
        latestTransaction={latestTransaction}
        firstDayOfWeekIdx={firstDayOfWeekIdx}
        mode={mode}
        show1Month
        onChangeDates={onChangeDates}
        onApply={onApplyFilter}
        filters={conditions}
        onUpdateFilter={onUpdateFilter}
        onDeleteFilter={onDeleteFilter}
        conditionsOp={conditionsOp}
        onConditionsOpChange={onConditionsOpChange}
      >
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button onPress={() => setShowBalance(state => !state)}>
            {showBalance ? t('Hide balance') : t('Show balance')}
          </Button>

          {widget && (
            <Button variant="primary" onPress={onSaveWidget}>
              <Trans>Save widget</Trans>
            </Button>
          )}
        </View>
      </Header>
      <View
        style={{
          backgroundColor: theme.tableBackground,
          padding: 20,
          paddingTop: 0,
          flex: '1 0 auto',
          overflowY: 'auto',
        }}
      >
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
                <PrivacyFilter>
                  {format(totalIncome, 'financial')}
                </PrivacyFilter>
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
                <PrivacyFilter>
                  {format(totalExpenses, 'financial')}
                </PrivacyFilter>
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
                <PrivacyFilter>
                  {format(totalTransfers, 'financial')}
                </PrivacyFilter>
              </Text>
            }
          />
          <Text style={{ fontWeight: 600 }}>
            <PrivacyFilter>
              <Change amount={totalIncome + totalExpenses + totalTransfers} />
            </PrivacyFilter>
          </Text>
        </View>

        {isFutureCashFlow ? (
          <FutureCashFlowGraph
            graphData={graphData}
            isConcise={isConcise}
            showBalance={showBalance}
          />
        ) : (
          <CashFlowGraph
            graphData={graphData}
            isConcise={isConcise}
            showBalance={showBalance}
          />
        )}

        <View
          style={{
            marginTop: 30,
            userSelect: 'none',
          }}
        >
          <Trans>
            <Paragraph>
              <strong>How is cash flow calculated?</strong>
            </Paragraph>
            <Paragraph>
              Cash flow shows the balance of your budgeted accounts over time,
              and the amount of expenses/income each day or month. Your budgeted
              accounts are considered to be “cash on hand,” so this gives you a
              picture of how available money fluctuates.
            </Paragraph>
          </Trans>
        </View>
      </View>
    </Page>
  );
}
