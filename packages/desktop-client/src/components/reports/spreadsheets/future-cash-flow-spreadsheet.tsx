import React from 'react';

import * as d from 'date-fns';

import { useSpreadsheet } from 'loot-core/src/client/SpreadsheetProvider';
import { send } from 'loot-core/src/platform/client/fetch';
import * as monthUtils from 'loot-core/src/shared/months';
import { q } from 'loot-core/src/shared/query';
import { integerToCurrency, integerToAmount, toRelaxedNumber, getNumberFormat } from 'loot-core/src/shared/util';
import { type RuleConditionEntity } from 'loot-core/types/models';

import { AlignedText } from '../../common/AlignedText';
import { runAll, indexCashFlow } from '../util';
import { round } from 'lodash';


export function simpleCashFlow(
  startMonth: string,
  endMonth: string,
  conditions: RuleConditionEntity[] = [],
  conditionsOp: 'and' | 'or' = 'and',
) {
  const start = monthUtils.firstDayOfMonth(startMonth);
  const end = monthUtils.lastDayOfMonth(endMonth);

  return async (
    spreadsheet: ReturnType<typeof useSpreadsheet>,
    setData: (data: { graphData: { income: number; expense: number } }) => void,
  ) => {
    const { filters } = await send('make-filters-from-conditions', {
      conditions: conditions.filter(cond => !cond.customName),
    });
    const conditionsOpKey = conditionsOp === 'or' ? '$or' : '$and';

    function makeQuery() {
      return q('transactions')
        .filter({
          [conditionsOpKey]: filters,
          $and: [
            { date: { $gte: start } },
            {
              date: {
                $lte:
                  end > monthUtils.currentDay() ? monthUtils.currentDay() : end,
              },
            },
          ],
          'account.offbudget': false,
          'payee.transfer_acct': null,
        })
        .calculate({ $sum: '$amount' });
    }

    return runAll(
      [
        makeQuery().filter({ amount: { $gt: 0 } }),
        makeQuery().filter({ amount: { $lt: 0 } }),
      ],
      data => {
        setData({
          graphData: {
            income: data[0],
            expense: data[1],
          },
        });
      },
    );
  };
}

const projectedExpenses: Array<{ x: Date; y: number }> = new Array();
const projectedIncome: Array<{ x: Date; y: number }> = new Array();
const projectedBalances: Array<{
    x: Date,
    y: number,
    premadeLabel: JSX.Element,
    amount: number
}> = new Array();
const today = new Date();

export function futureCashFlowByDate(
  startMonth: string,
  endMonth: string,
  isConcise: boolean,
  conditions: RuleConditionEntity[] = [],
  conditionsOp: 'and' | 'or',
) {
  const start = monthUtils.firstDayOfMonth(startMonth);
  const fixedEnd = monthUtils.lastDayOfMonth(endMonth);
  const realFixedEnd = isConcise ? monthUtils.firstDayOfMonth(endMonth) : monthUtils.lastDayOfMonth(endMonth);

  return async (
    spreadsheet: ReturnType<typeof useSpreadsheet>,
    setData: (data: ReturnType<typeof recalculate>) => void,
  ) => {
    
    function makeQuery() {
      const query = q('transactions')
        .filter({
          [conditionsOpKey]: filters,
        })
        .filter({
          $and: [
            { date: { $transform: '$month', $gte: start } },
            { date: { $transform: '$month', $lte: fixedEnd } },
          ],
          'account.offbudget': false,
        });

      if (isConcise) {
        return query
          .groupBy([{ $month: '$date' }, 'payee.transfer_acct'])
          .select([
            { date: { $month: '$date' } },
            { isTransfer: 'payee.transfer_acct' },
            { amount: { $sum: '$amount' } },
          ]);
      }

      return query
        .groupBy(['date', 'payee.transfer_acct'])
        .select([
          'date',
          { isTransfer: 'payee.transfer_acct' },
          { amount: { $sum: '$amount' } },
        ]);
    }

    const { filters } = await send('make-filters-from-conditions', {
      conditions: conditions.filter(cond => !cond.customName),
    });
    const conditionsOpKey = conditionsOp === 'or' ? '$or' : '$and';
    
    let startingBalance:number = 0;
    await runAll(
      [
        q('transactions')
          .filter({
            [conditionsOpKey]: filters,
            date: { $transform: '$month', $lt: getFirstDayOfMonth(today) },
            'account.offbudget': false,
          })
          .calculate({ $sum: '$amount' })      
      ],
      data => {
        startingBalance = parseInt(data);    
      },
    );

    //console.log("*** futureCashFlowByDate");

    projectedBalances.splice(0, projectedBalances.length);
    projectedExpenses.splice(0, projectedExpenses.length);
    projectedIncome.splice(0, projectedIncome.length);

    for (let i = 0; i <= 6; i++) {
      const futureMonth = monthUtils.addMonths(today, i);
      const futureEnd = isConcise ? monthUtils.firstDayOfMonth(futureMonth) : monthUtils.lastDayOfMonth(futureMonth);
  
      //console.log(futureMonth, futureEnd, realFixedEnd);

      if(d.isAfter(monthUtils.parseDate(futureEnd), monthUtils.parseDate(realFixedEnd))){
        //console.log("break");
        break;
      }

      const dateEnd = monthUtils.parseDate(futureEnd);
      dateEnd.setHours(0, 0, 0, 0);

      // Calcolo proiezione per ogni mese
      const sheetName = monthUtils.sheetForMonth(futureMonth);
      const totsaved = await spreadsheet.get(sheetName, 'total-saved');
      projectedBalances.push({
        x: dateEnd,
        y: (projectedBalances[i - 1]?.y ?? integerToAmount(startingBalance)) + integerToAmount(parseInt(totsaved.value)),
        premadeLabel: <span>Forecasted</span>,
        amount: (projectedBalances[i - 1]?.amount ?? startingBalance) + parseInt(totsaved.value)
      });
  
      const totincome = await spreadsheet.get(sheetName, 'total-budget-income');
      projectedIncome.push({
        x: dateEnd,
        y: integerToAmount(parseInt(totincome.value))
      });
  
      const totbudgeted = await spreadsheet.get(sheetName, 'total-budgeted');
      projectedExpenses.push({
        x: dateEnd,
        y: -integerToAmount(parseInt(totbudgeted.value))
      });
    }

    //console.log(projectedBalances, projectedIncome, projectedExpenses);

    return await runAll(
      [
        q('transactions')
          .filter({
            [conditionsOpKey]: filters,
            date: { $transform: '$month', $lt: start },
            'account.offbudget': false,
          })
          .calculate({ $sum: '$amount' }),
        makeQuery().filter({ amount: { $gt: 0 } }),
        makeQuery().filter({ amount: { $lt: 0 } }),        
      ],
      data => {
        setData(recalculate(data, start, fixedEnd, isConcise, realFixedEnd));        
      },
    );
  };
}

function recalculate(
  data: [
    number,
    Array<{ date: string; isTransfer: string | null; amount: number }>,
    Array<{ date: string; isTransfer: string | null; amount: number }>,
  ],
  start: string,
  end: string,
  isConcise: boolean,
  realFixedEnd: string
) {
  const [startingBalance, income, expense] = data;
  const convIncome = income.map(t => {
    return { ...t, isTransfer: t.isTransfer !== null };
  });
  const convExpense = expense.map(t => {
    return { ...t, isTransfer: t.isTransfer !== null };
  });
  const dates = isConcise
    ? monthUtils.rangeInclusive(
        monthUtils.getMonth(start),
        monthUtils.getMonth(end),
      )
    : monthUtils.dayRangeInclusive(start, end);
  const incomes = indexCashFlow(convIncome);
  const expenses = indexCashFlow(convExpense);

  let balance = startingBalance;
  let totalExpenses = 0;
  let totalIncome = 0;
  let totalTransfers = 0;

  const graphData = dates.reduce<{
    expenses: Array<{ x: Date; y: number }>;
    income: Array<{ x: Date; y: number }>;
    transfers: Array<{ x: Date; y: number }>;
    balances: Array<{
      x: Date;
      y: number;
      premadeLabel: JSX.Element;
      amount: number;
    }>;
  }>(
    (res, date) => {
      let income:number = 0;
      let expense:number = 0;
      let creditTransfers:number = 0;
      let debitTransfers:number = 0;

      if (incomes[date]) {
        income = !incomes[date].false ? 0 : incomes[date].false;
        creditTransfers = !incomes[date].true ? 0 : incomes[date].true;
      }
      if (expenses[date]) {
        expense = !expenses[date].false ? 0 : expenses[date].false;
        debitTransfers = !expenses[date].true ? 0 : expenses[date].true;
      }

      totalExpenses += expense;
      totalIncome += income;
      balance += income + expense + creditTransfers + debitTransfers;
      totalTransfers += creditTransfers + debitTransfers;
      const x = d.parseISO(date);

      const label = (
        <div>
          <div style={{ marginBottom: 10 }}>
            <strong>
              {d.format(x, isConcise ? 'MMMM yyyy' : 'MMMM d, yyyy')}
            </strong>
          </div>
          <div style={{ lineHeight: 1.5 }}>
            <AlignedText left="Income:" right={integerToCurrency(income)} />
            <AlignedText left="Expenses:" right={integerToCurrency(expense)} />
            <AlignedText
              left="Change:"
              right={<strong>{integerToCurrency(income + expense)}</strong>}
            />
            {creditTransfers + debitTransfers !== 0 && (
              <AlignedText
                left="Transfers:"
                right={integerToCurrency(creditTransfers + debitTransfers)}
              />
            )}
            <AlignedText left="Balance:" right={integerToCurrency(balance)} />
          </div>
        </div>
      );

      res.income.push({ x, y: integerToAmount(income) });
      res.expenses.push({ x, y: integerToAmount(expense) });
      res.transfers.push({
        x,
        y: integerToAmount(creditTransfers + debitTransfers),
      });
      res.balances.push({
        x,
        y: integerToAmount(balance),
        premadeLabel: label,
        amount: balance,
      });
      return res;
    },
    { expenses: [], income: [], transfers: [], balances: [] },
  );

  const forecast = populateForecast(graphData, isConcise, realFixedEnd);

  const { balances } = forecast;

  return {
    graphData: forecast,
    balance: balances[balances.length - 1].amount,
    totalExpenses,
    totalIncome,
    totalTransfers,
    totalChange: balances[balances.length - 1].amount - balances[0].amount,
  };
}

function getEndOfPreviousMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 0); // Il giorno '0' restituisce l'ultimo giorno del mese precedente
}
function getFirstDayOfPreviousMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1);
}
function getFirstDayOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function updateArray(
  originalArray: Array<{ x: Date; y: number }>,
  newData: Array<{ x: Date; y: number }>
): Array<{ x: Date; y: number }> {
  newData.map((newItem) => {
    const index = originalArray.findIndex(
      (item) => d.isSameDay(item.x, newItem.x)
    );
    if (index !== -1) {
      // Sostituiamo l'elemento esistente
      originalArray[index] = newItem;
    } else {
      // Aggiungiamo il nuovo elemento
      originalArray.push(newItem);
    }
    return newItem;
  });

  return originalArray;
}

function populateForecast(graphData:{
  expenses: Array<{ x: Date; y: number }>;
  income: Array<{ x: Date; y: number }>;
  transfers: Array<{ x: Date; y: number }>;
  balances: Array<{
    x: Date;
    y: number;
    premadeLabel: JSX.Element;
    amount: number;
  }>;
}, isConcise: boolean, fixedEnd: string) {

  
  // Applica la proiezione lineare per ogni giorno del mese
  graphData.balances = graphData.balances.map((balance) => {

    const monthEnd = isConcise ? monthUtils.firstDayOfMonth(balance.x) : monthUtils.lastDayOfMonth(balance.x);
    const previousMonth = isConcise ? getFirstDayOfPreviousMonth(balance.x) : getEndOfPreviousMonth(balance.x);

    const dateMonthStart = monthUtils.parseDate(previousMonth);
    const dateMonthEnd = monthUtils.parseDate(monthEnd);  

    const newBalance = projectedBalances.find(
      (balance) => d.isSameDay(balance.x, dateMonthEnd)
    );

    const previousMonthBalance = projectedBalances.find(
      (balance) => d.isSameDay(balance.x, dateMonthStart)
    );

    if(previousMonthBalance && d.isSameDay(balance.x, dateMonthStart)){
      return { ...previousMonthBalance, x: balance.x };
    }else if(newBalance && d.isSameDay(balance.x, dateMonthEnd)){
      return { ...newBalance, x: balance.x };
    } else if (newBalance && previousMonthBalance && d.isAfter(balance.x, dateMonthStart) && d.isBefore(balance.x, dateMonthEnd)) {
      // Calcola l'incremento giornaliero per il mese attuale
      const daysInMonth = d.differenceInDays(dateMonthEnd, dateMonthStart);
      const dailyIncrement = (newBalance.amount - previousMonthBalance.amount) / daysInMonth;
      const daysFromStart = d.differenceInDays(balance.x, dateMonthStart);
      balance.amount = previousMonthBalance.amount + round(dailyIncrement * daysFromStart, 0);
      balance.y = integerToAmount(balance.amount);
    }
    return balance;
  });
      
  graphData.expenses = updateArray(graphData.expenses, projectedExpenses);
  graphData.income = updateArray(graphData.income, projectedIncome);

  return graphData;
}