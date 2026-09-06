import { useCallback, useEffect, useRef, useState } from "react";
import { celkem as celkemBloku, radky as radkyBloku, type MozneBlok, type VypisOpts } from "./reporty-api";

/** Kolik řádků si říct o jednu stránku. Shodné s výchozím `limit` na serveru. */
export const STRANKA = 20;

/**
 * Stránkování tabulek uvnitř jedné odpovědi.
 *
 * Server vrací všechny tabulky profilu najednou a posouvá se v nich přes `off_<blok>`,
 * takže „načíst další" u jedné tabulky znamená znovu si říct o celou odpověď a z ní
 * použít jen ten jeden blok. Načtené stránky se hromadí tady, aby se předchozí řádky
 * neztratily.
 *
 * `resetKey` shodí nahromaděné stránky, když se změní to, na co se ptáme (jiný subjekt,
 * jiný filtr) — jinak by se míchaly řádky ze dvou různých dotazů.
 */
export function useStrankovani<D extends Record<string, unknown>>(
  data: D | undefined,
  nacti: (opts: VypisOpts) => Promise<D>,
  resetKey: string,
) {
  const [extra, setExtra] = useState<Record<string, unknown[]>>({});
  const [nacita, setNacita] = useState<string | null>(null);
  // Ať `vice()` nemusí být závislé na `data` a nepřenačítalo se při každém renderu.
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    setExtra({});
  }, [resetKey]);

  /** Řádky bloku = první stránka z odpovědi + doložené další stránky. */
  const rows = useCallback(
    <T,>(klic: string): T[] => [
      ...radkyBloku<T>(dataRef.current?.[klic] as MozneBlok<T>),
      ...((extra[klic] ?? []) as T[]),
    ],
    [extra],
  );

  /** Kolik řádků je v datech celkem (ne na stránce). */
  const total = useCallback(
    (klic: string): number => celkemBloku(dataRef.current?.[klic] as MozneBlok<unknown>),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data],
  );

  const vice = useCallback(
    async (klic: string) => {
      if (!dataRef.current || nacita) return;
      const uz = [
        ...radkyBloku(dataRef.current[klic] as MozneBlok<unknown>),
        ...(extra[klic] ?? []),
      ].length;
      setNacita(klic);
      try {
        const d = await nacti({ limit: STRANKA, off: { [klic]: uz } });
        const nove = radkyBloku(d[klic] as MozneBlok<unknown>);
        if (nove.length) setExtra((p) => ({ ...p, [klic]: [...(p[klic] ?? []), ...nove] }));
      } catch {
        // Chybu stránkování neukazujeme jako pád obrazovky — data, co jsou, zůstanou.
      } finally {
        setNacita(null);
      }
    },
    [extra, nacita, nacti],
  );

  return { rows, total, vice, nacita };
}
