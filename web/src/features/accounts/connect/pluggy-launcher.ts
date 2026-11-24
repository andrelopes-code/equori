// The connector of Meu Pluggy, the personal use of the aggregator (ADR 039).
const meuPluggy = 200;

// Opens Pluggy Connect and answers the id of the new item, or null when the reader closes it.
export async function launchPluggy(
  token: string,
  language: string,
): Promise<string | null> {
  const { PluggyConnect } = await import("pluggy-connect-sdk");

  return new Promise((resolve, reject) => {
    const sheets: CSSStyleSheet[] = [];
    const finish = (item: string | null) => {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
        (sheet) => !sheets.includes(sheet),
      );
      resolve(item);
    };

    const connect = new PluggyConnect({
      connectToken: token,
      connectorIds: [meuPluggy],
      selectedConnectorId: meuPluggy,
      language,
      // The SDK types the item by pluggy-js, which it does not install.
      onSuccess: ({ item }: { item: { id: string } }) => {
        finish(item.id);
        void connect.destroy();
      },
      onClose: () => {
        finish(null);
      },
    });

    connect
      .init()
      .then(() => {
        sheets.push(...adoptStyles());
      })
      .catch(reject);
  });
}

// The page policy blocks the <style> element the SDK injects; its text becomes a constructed
// sheet, which the policy allows, so style-src stays closed to inline styles (ADR 039).
function adoptStyles(): CSSStyleSheet[] {
  const elements = document.querySelectorAll<HTMLStyleElement>(
    "[id^='zoid-pluggy-connect'] style",
  );

  return [...elements].map((element) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(element.textContent);
    document.adoptedStyleSheets.push(sheet);

    return sheet;
  });
}
