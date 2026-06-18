"use client";

import { useActionState } from "react";
import { importDistributors, importQualification, type ImportResult, type QualResult } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const initial: ImportResult | undefined = undefined;
const initialQ: QualResult | undefined = undefined;

export default function ImportPage() {
  const [result, action, pending] = useActionState(importDistributors, initial);
  const [qres, qaction, qpending] = useActionState(importQualification, initialQ);

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

      <Card>
        <CardHeader>
          <CardTitle>qualification.csv (Фаза A)</CardTitle>
          <CardDescription>
            Загрузите CSV квалификации (sourcing/…_qualification.csv). Сопоставление по домену/имени:
            проставит VIES-статус, чистый VAT и заметку; CANDIDATE → QUALIFIED или REJECTED по диспозиции
            (статусы выше CANDIDATE не трогаются).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={qaction} className="space-y-3">
            <input type="file" name="file" accept=".csv,text/csv" required className="block text-sm" />
            <Button type="submit" disabled={qpending}>
              {qpending ? "Импорт…" : "Импортировать квалификацию"}
            </Button>
          </form>

          {qres ? (
            qres.ok ? (
              <p className="mt-4 text-sm text-green-700">
                Готово: строк {qres.rows}, сопоставлено {qres.matched}, → QUALIFIED {qres.qualified}, → REJECTED{" "}
                {qres.rejected}, VIES-VALID {qres.viesValid}, не найдено {qres.notMatched}.
              </p>
            ) : (
              <p className="mt-4 text-sm text-destructive">Ошибка: {qres.error}</p>
            )
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}