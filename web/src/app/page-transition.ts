export function pageTransitionTypes(info: {
  pathChanged: boolean;
}): string[] | false {
  return info.pathChanged ? ["page"] : false;
}
