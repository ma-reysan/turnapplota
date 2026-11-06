import { describe, expect, it } from "vitest";
import { parseLunchMenuHtml } from "@/lib/lunch-menu";

const menu = `
  <section>
    <h1><span>Menú del día</span></h1>
    <p>ENTRADA</p><p>ENSALADA SURTIDA</p>
    <p>COMÚN</p><p>CHULETA DE CERDO CON PURÉ DE PAPAS</p>
    <p>LIVIANO</p><p>PECHUGA DE POLLO CON PURÉ DE PAPAS</p>
    <p>POSTRE</p><p>FRUTA NATURAL</p>
  </section>
`;

describe("lectura del menú de la Central de Alimentación", () => {
  it("lee la fecha de noviembre separada en párrafos y spans", () => {
    const html = `<section>
      <p>VIERNES 06</p>
      <p><span>NOVIEMBRE </span><span>DE </span><span>202</span><span>6</span></p>
    </section>${menu}`;

    expect(parseLunchMenuHtml(html)).toEqual({
      menuDate: "2026-11-06",
      content: "ENTRADA\nENSALADA SURTIDA\nCOMÚN\nCHULETA DE CERDO CON PURÉ DE PAPAS\nLIVIANO\nPECHUGA DE POLLO CON PURÉ DE PAPAS\nPOSTRE\nFRUTA NATURAL",
    });
  });

  it("conserva el formato anterior con DE entre el día y el mes", () => {
    expect(parseLunchMenuHtml(`<p>28 DE OCTUBRE DE 2026</p>${menu}`).menuDate).toBe("2026-10-28");
  });
});
