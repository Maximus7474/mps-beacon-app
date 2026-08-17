export function resourceExport(resource: string, functionName: string): Function {
  return global.exports[resource][functionName] as Function;
}
