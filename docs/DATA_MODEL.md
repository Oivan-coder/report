# Data model v0.1

Проект строится вокруг денежных потоков, а не вокруг классического месячного бюджета.

## Transactions

Сырьевая таблица операций. Единственный обязательный источник фактов.

Поля:
- id
- date
- type: expense | income | transfer
- category
- description
- amount
- account
- comment

## Accounts

Счета и текущие остатки. Нужны для ответа «сколько денег сейчас реально есть».

## IncomeSchedule

Регламент выплат:
- salaryDay = 15
- advanceDay = 30
- paydayMoveRule = previous-business-day

Если 15-е или 30-е попадает на выходной, выплата считается в предыдущий рабочий день.

## Obligations

Обязательные платежи: жилье, связь, кредиты, страховки, регулярные платежи.
Их нужно вычитать из остатка до расчета «свободно».

## Goals

Накопительные цели: НЗ, фонд машины, отпуск и т.д.
Это не расходы, а распределение денег.

## Core metrics

- accountBalance: деньги сейчас
- futureObligations: обязательства до следующей выплаты
- plannedGoals: плановые накопления
- freeMoney: accountBalance - futureObligations - plannedGoals
- dailyLimit: freeMoney / daysLeft
- burnRate: средний расход в день за текущий цикл
- forecastBalance: freeMoney - burnRate * daysLeft
