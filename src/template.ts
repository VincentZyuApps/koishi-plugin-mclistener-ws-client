export interface TemplateVars {
  player?: string;
  content?: string;
  time?: string;
}

export function renderTemplate(template: string, vars: TemplateVars): string {
  return (template || '')
    .replace(/%PLAYER%/g, vars.player || '')
    .replace(/%CONTENT%/g, vars.content || '')
    .replace(/%TIME%/g, vars.time || '');
}
