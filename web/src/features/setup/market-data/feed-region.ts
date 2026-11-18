// The region a feed serves, by its id: a case of the feed's region code. A source without a case,
// such as a new one, belongs to the global group. docs/contributing/regions.md, "Feed region".
export function feedRegion(id: string): string {
  switch (id) {
    case "b3_cotahist":
    case "b3_consolidated":
    case "bcb_ptax":
    case "tesouro_direto":
    case "cvm_funds":
    case "br_cdi":
    case "br_ipca":
    case "br_focus":
    case "br_focus_ipca":
    case "br_tesouro":
    case "br_ifdata":
    case "br_cvm_fii":
    case "br_cvm_cia":
      return "BR";
    case "ecb":
    case "eu_estr":
    case "ea_hicp":
      return "EU";
    case "us_sofr":
    case "us_cpi":
      return "US";
    default:
      return "global";
  }
}
