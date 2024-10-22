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
// Fine del mese corrente
const endOfCurrentMonth = getEndOfMonth(today);
const firstOfCurrentMonth = getFirstDayOfMonth(today);

// Fine del mese successivo
const endOfNextMonth = getEndOfMonth(new Date(today.getFullYear(), today.getMonth() + 1));
const firstOfNextMonth = getFirstDayOfMonth(new Date(today.getFullYear(), today.getMonth() + 1));

export function futureCashFlowByDate(
  startMonth: string,
  endMonth: string,
  isConcise: boolean,
  conditions: RuleConditionEntity[] = [],
  conditionsOp: 'and' | 'or',
) {
  const start = monthUtils.firstDayOfMonth(startMonth);
  const fixedEnd = monthUtils.lastDayOfMonth(endMonth);

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

    // balance mese odierno
    const actualMonth = monthUtils.monthFromDate(today);
    const sheetName = monthUtils.sheetForMonth(actualMonth);  
    
    const totsaved = await spreadsheet.get(sheetName, 'total-saved');

    projectedBalances.splice(0, projectedBalances.length);
    projectedExpenses.splice(0, projectedExpenses.length);
    projectedIncome.splice(0, projectedIncome.length);

    projectedBalances.push({ x: isConcise ? firstOfCurrentMonth : endOfCurrentMonth, 
      y: integerToAmount(startingBalance + parseInt(totsaved.value)), 
      premadeLabel: <span>Forecasted</span>, 
      amount: (startingBalance + parseInt(totsaved.value)) });

    // income budgeted mese odierno
    const totincome = await spreadsheet.get(sheetName, 'total-budget-income');
    projectedIncome.push({ x: isConcise ? firstOfCurrentMonth : endOfCurrentMonth, y: integerToAmount(parseInt(totincome.value)) });

    // expense budgeted mese odierno
    const totbudgeted = await spreadsheet.get(sheetName, 'total-budgeted');
    projectedExpenses.push({ x: isConcise ? firstOfCurrentMonth : endOfCurrentMonth, y: -integerToAmount(parseInt(totbudgeted.value)) });

    if(actualMonth != endMonth){
      // balance mese finale se diverso da mese odierno
      const sheetName2 = monthUtils.sheetForMonth(endMonth);  
      const totsaved2 = await spreadsheet.get(sheetName2, 'total-saved');
      projectedBalances.push({ x: isConcise ? firstOfNextMonth : endOfNextMonth, 
        y: (projectedBalances[0].y + integerToAmount(parseInt(totsaved2.value))), 
        premadeLabel: <span>Forecasted</span>, 
        amount: (projectedBalances[0].amount + parseInt(totsaved2.value)) });
      
      // income budgeted mese finale se diverso da mese odierno
      const totincome2 = await spreadsheet.get(sheetName2, 'total-budget-income');
      projectedIncome.push({ x: isConcise ? firstOfNextMonth : endOfNextMonth, y: integerToAmount(parseInt(totincome2.value)) });

      // expense budgeted mese finale se diverso da mese odierno
      const totbudgeted2 = await spreadsheet.get(sheetName2, 'total-budgeted');
      projectedExpenses.push({ x: isConcise ? firstOfNextMonth : endOfNextMonth, y: -integerToAmount(parseInt(totbudgeted2.value)) });
    }        

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
        setData(recalculate(data, start, fixedEnd, isConcise));        
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
  isConcise: boolean
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

  const forecast = populateForecast(graphData, isConcise);

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

function getEndOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0); // Il giorno '0' restituisce l'ultimo giorno del mese precedente
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
}, isConcise: boolean) {

  const newBalanceNextMonth = projectedBalances.find(
    (balance) => d.isSameDay(balance.x, endOfNextMonth) ||
     (isConcise && d.isSameDay(balance.x, firstOfNextMonth))
  );
  const newBalanceCurrentMonth = projectedBalances.find(
    (balance) => d.isSameDay(balance.x, endOfCurrentMonth) ||
      (isConcise && d.isSameDay(balance.x, firstOfCurrentMonth))
  );
  
  if (newBalanceCurrentMonth) {
    
    graphData.balances = graphData.balances.map((balance) => {
      if (d.isSameDay(balance.x, endOfNextMonth) || 
          (isConcise && d.isSameDay(balance.x, firstOfNextMonth))) {
        // Se l'elemento è nell'intervallo, lo sostituiamo con newBalanceNextMonth
        return { ...newBalanceNextMonth, x: balance.x };
      } else if (d.isSameDay(balance.x, endOfCurrentMonth) ||
          (isConcise && d.isSameDay(balance.x, firstOfCurrentMonth))) {
        return { ...newBalanceCurrentMonth, x: balance.x };
      } else if(!isConcise) { 
        
        // Troviamo l'elemento di domani in graphData.balances
        const nextDayBalance = graphData.balances.find(
          (balance) => d.isSameDay(balance.x, today)
        );

        const amountDifference = newBalanceCurrentMonth.amount - nextDayBalance.amount;
    
        // Calcoliamo la differenza in giorni tra endOfCurrentMonth e tomorrow
        const daysBetween = d.differenceInDays(endOfCurrentMonth, today);
        const dailyIncrement = amountDifference / daysBetween;
      
        const amountDifferenceNextMonth = newBalanceNextMonth.amount - newBalanceCurrentMonth.amount;
        
        // Calcoliamo la differenza in giorni tra endOfNextMonth e endOfCurrentMonth
        const daysBetweenNextMonth = d.differenceInDays(endOfNextMonth, endOfCurrentMonth);
        const dailyIncrementNextMonth = amountDifferenceNextMonth / daysBetweenNextMonth;
      
        if (d.isAfter(balance.x, today) && d.isBefore(balance.x, endOfCurrentMonth)) {
          const daysFromTomorrow = d.differenceInDays(balance.x, today);
          
          // Applichiamo la regressione lineare al campo amount
          balance.amount = nextDayBalance.amount + round(dailyIncrement * daysFromTomorrow, 0);
          balance.y = integerToAmount(balance.amount);
        } else if (d.isAfter(balance.x, endOfCurrentMonth) && d.isBefore(balance.x, endOfNextMonth)) {
          const daysFromTomorrow = d.differenceInDays(balance.x, endOfCurrentMonth);
          
          // Applichiamo la regressione lineare al campo amount
          balance.amount = newBalanceCurrentMonth.amount + round(dailyIncrementNextMonth * daysFromTomorrow, 0);
          balance.y = integerToAmount(balance.amount);
        }
      }
      // Altrimenti, lasciamo l'elemento invariato
      return balance;
    });
  }

  graphData.expenses = updateArray(graphData.expenses, projectedExpenses);
  graphData.income = updateArray(graphData.income, projectedIncome);

  return graphData;
}