import { consoleBanner, emailDelivery, emailProviderId } from "../email-delivery";
import { renderPasswordResetEmail } from "../email-templates/password-reset";

describe("emailDelivery", () => {
  it.each([
    [{}, "console"],
    [{ NODE_ENV: "development" }, "console"],
    [{ NODE_ENV: "test", NOTIFICATION_PROVIDER: "local" }, "console"],
    // Producción sin provider real: no se envía ni se registra el enlace
    [{ NODE_ENV: "production" }, "suppressed"],
    [{ NODE_ENV: "production", NOTIFICATION_PROVIDER: " LOCAL " }, "suppressed"],
    [{ NODE_ENV: "production", NOTIFICATION_PROVIDER: "acs" }, "send"],
    [{ NODE_ENV: "development", NOTIFICATION_PROVIDER: "acs" }, "send"],
  ])("%p → %s", (env, expected) => {
    expect(emailDelivery(env as NodeJS.ProcessEnv)).toBe(expected);
  });

  it("el provider por defecto es local", () => {
    expect(emailProviderId({} as NodeJS.ProcessEnv)).toBe("local");
  });
});

describe("consoleBanner", () => {
  it("arma un recuadro con todas las líneas del mismo ancho", () => {
    const banner = consoleBanner("TÍTULO", ["corta", "una línea bastante más larga"]);
    const rows = banner.split("\n").filter(Boolean);

    expect(rows[0].startsWith("╔")).toBe(true);
    expect(new Set(rows.map((r) => r.length)).size).toBe(1);
    expect(banner).toContain("una línea bastante más larga");
  });
});

describe("renderPasswordResetEmail", () => {
  const url = "http://localhost:8000/cl/reset-password?token=abc.def";

  it("incluye el enlace, la vigencia y el saludo", () => {
    const { subject, text, html } = renderPasswordResetEmail({
      firstName: "Juana",
      resetUrl: url,
    });

    expect(subject).toMatch(/Sonríe Market/);
    expect(text).toContain(url);
    expect(text).toContain("15 minutos");
    expect(text).toContain("Hola Juana:");
    expect(html).toContain(`href="${url}"`);
  });

  it("escapa el HTML del nombre", () => {
    const { html } = renderPasswordResetEmail({
      firstName: "<script>x</script>",
      resetUrl: url,
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
