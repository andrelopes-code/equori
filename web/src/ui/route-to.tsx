import { Link } from "@tanstack/react-router";
import type { LinkOptions } from "@tanstack/react-router";

// The render of a family's link: the router's anchor, which writes the href and navigates inside
// the application on a plain click.
export function routeTo(options: LinkOptions) {
  return (props: object) => <Link {...props} {...options} />;
}
