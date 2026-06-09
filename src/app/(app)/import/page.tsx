"use client";

import { useActionState } from "react";
import { importDistributors, type ImportResult } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const initial: ImportResult | undefined = undefined;

export default function ImportPage() {
  const [result, action, pending] = useActionState(importDistributors, initial);

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-semibold">Импорт поставщиков (FBA Spain)</h1>
      <Card>
        <CardHeader>
          <CardTitle>distributor_candidates.csv</CardTitle>
          <CardDescription>
            Загрузите CSV из проекта «Claude fba Spain» (sourcing/…_distributor_candidates.csv). Дедуп по домену
            и по паре (бренд × домен). Поставщики попадут в статус CANDIDATE.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-3">
            <input type="file" name="file" accept=".csv,text/csv" required className="block text-sm" />
            <Button type="submit" disabled={pending}>
              {pending ? "Импорт…" : "Импортировать"}
            </Button>
          </form>

          {result ? (
            result.ok ? (
              <p className="mt-4 text-sm text-green-700">
                Готово: строк {result.rows}, брендов {result.brands}, поставщиков +{result.suppliers}, контактов +
                {result.contacts}, связей {result.links}.
              </p>
            ) : (
              <p className="mt-4 text-sm text-destructive">Ошибка: {result.error}</p>
            )
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}